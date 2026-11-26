import { describe, it, expect, vi } from 'vitest';
import { connectPglite } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { adminSessions, adminUsers, authAttempts, errorCounts, events, ownerSessions, rateCounters } from '../src/db/schema.js';
import { cleanup, startCleanup } from '../src/cleanup.js';
import { seedTree } from './helpers.js';

const at = new Date('2026-12-10T12:00:00Z');
const ago = (ms: number) => new Date(at.getTime() - ms);
const H = 3_600_000;
const D = 24 * H;

async function setup() {
  const h = await connectPglite();
  await runMigrations(h);
  return h;
}

describe('cleanup (đặc tả 6.9.3)', () => {
  it('rate_counters: xoá khung cũ hơn 1 ngày, kể cả pin:tree:, giữ khung 23 giờ', async () => {
    const h = await setup();
    await h.db.insert(rateCounters).values([
      { bucket: 'msg:ip:a', windowStart: ago(23 * H), hits: 1 },
      { bucket: 'msg:ip:a', windowStart: ago(25 * H), hits: 1 },
      { bucket: 'pin:tree:abcd2345', windowStart: ago(23 * H), hits: 1 },
      { bucket: 'pin:tree:abcd2345', windowStart: ago(25 * H), hits: 1 },
    ]);
    const r = await cleanup(h.db, at);
    expect(r.rateCounters).toBe(2);
    const left = await h.db.select().from(rateCounters);
    expect(left.map((x) => x.windowStart.getTime())).toEqual([ago(23 * H).getTime(), ago(23 * H).getTime()]);
  });

  it('auth_attempts: giữ 6 ngày, xoá 8 ngày', async () => {
    const h = await setup();
    await h.db.insert(authAttempts).values([
      { ipHash: 'i', method: 'admin', success: false, createdAt: ago(6 * D) },
      { ipHash: 'i', method: 'admin', success: false, createdAt: ago(8 * D) },
    ]);
    const r = await cleanup(h.db, at);
    expect(r.authAttempts).toBe(1);
    const left = await h.db.select().from(authAttempts);
    expect(left).toHaveLength(1);
    expect(left[0]!.createdAt.getTime()).toBe(ago(6 * D).getTime());
  });

  it('admin_sessions: xoá phiên hết hạn và bị thu hồi, giữ phiên còn hạn', async () => {
    const h = await setup();
    const [u] = await h.db.insert(adminUsers).values({ email: 'a@x.vn' }).returning({ id: adminUsers.id });
    await h.db.insert(adminSessions).values([
      { adminId: u!.id, tokenHash: 'expired', expiresAt: ago(60_000) },
      { adminId: u!.id, tokenHash: 'revoked', expiresAt: new Date(at.getTime() + H), revokedAt: ago(H) },
      { adminId: u!.id, tokenHash: 'live', expiresAt: new Date(at.getTime() + H) },
    ]);
    const r = await cleanup(h.db, at);
    expect(r.adminSessions).toBe(2);
    const left = await h.db.select().from(adminSessions);
    expect(left.map((x) => x.tokenHash)).toEqual(['live']);
  });

  it('không đụng events, error_counts, owner_sessions; gọi lần hai không xoá gì', async () => {
    const h = await setup();
    await seedTree(h, 'abcd2345');
    const old = ago(30 * D);
    await h.db.insert(events).values({ type: 'tree_created', treeId: 'abcd2345', createdAt: old });
    await h.db.insert(errorCounts).values({ hour: old, count: 1, lastAt: old, lastStatus: 500 });
    await h.db.insert(ownerSessions).values({ treeId: 'abcd2345', tokenHash: 't', method: 'pin', createdAt: old, expiresAt: old });
    await h.db.insert(rateCounters).values({ bucket: 'x', windowStart: ago(2 * D), hits: 1 });
    await cleanup(h.db, at);
    expect(await h.db.select().from(events)).toHaveLength(1);
    expect(await h.db.select().from(errorCounts)).toHaveLength(1);
    expect(await h.db.select().from(ownerSessions)).toHaveLength(1);
    expect(await cleanup(h.db, at)).toEqual({ rateCounters: 0, authAttempts: 0, adminSessions: 0 });
  });
});

describe('startCleanup', () => {
  it('CSDL lỗi: log chỉ { name, code }, vẫn chạy lần sau; dừng thì thôi', async () => {
    const boom = () => { throw Object.assign(new Error('boom chứa dữ liệu'), { code: '57P01' }); };
    const db = { delete: boom } as unknown as Parameters<typeof cleanup>[0];
    const log = { info: vi.fn(), error: vi.fn() };
    const stop = startCleanup({ db, now: () => at, log, everyMs: 20 });
    await new Promise((r) => setTimeout(r, 70));
    stop();
    const calls = log.error.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(2);
    for (const [obj] of log.error.mock.calls) expect(obj).toEqual({ name: 'Error', code: '57P01' });
    await new Promise((r) => setTimeout(r, 60));
    expect(log.error.mock.calls.length).toBe(calls);
    expect(log.info).not.toHaveBeenCalled();
  });

  it('có dòng bị xoá thì log info số lượng', async () => {
    const h = await setup();
    await h.db.insert(rateCounters).values({ bucket: 'x', windowStart: ago(2 * D), hits: 1 });
    const log = { info: vi.fn(), error: vi.fn() };
    const stop = startCleanup({ db: h.db, now: () => at, log, everyMs: 60_000 });
    await vi.waitFor(() => expect(log.info).toHaveBeenCalled());
    stop();
    expect(log.info.mock.calls[0]![0]).toEqual({ rateCounters: 1, authAttempts: 0, adminSessions: 0 });
  });
});
