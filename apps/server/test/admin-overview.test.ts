import { describe, it, expect, afterEach } from 'vitest';
import { adminLogin, makeTestApp, ADMIN_ENV } from './helpers.js';
import { errorCounts, events, messages, reports, trees } from '../src/db/schema.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

// Đồng hồ test mặc định: 2026-12-01T10:00:00+07:00 (03:00Z).
const NOW = new Date('2026-12-01T03:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

async function seed() {
  const db = t.h.db;
  const tree = (id: string, createdAt: Date, refTreeId: string | null = null) =>
    ({ id, ownerName: 'Chủ', privateKeyHash: 'x', pinHash: 'x', createdAt, refTreeId });
  await db.insert(trees).values([tree('aaaaaaaa', ago(48)), tree('bbbbbbbb', ago(2), 'aaaaaaaa'), tree('cccccccc', ago(1))]);
  const msg = (slotIndex: number, createdAt: Date, photoKey: string | null, photoBytes: number | null) => ({
    treeId: 'aaaaaaaa', slotIndex, ornament: 'bell', isAnonymous: true, content: 'bí mật', editTokenHash: `h${slotIndex}`,
    editUntil: createdAt, deviceHash: `d${slotIndex}`, createdAt, updatedAt: createdAt, photoKey, photoBytes,
  });
  await db.insert(messages).values([msg(0, ago(30), 'm/aaaaaaaa/1-x.webp', 1000), msg(1, ago(3), 'm/aaaaaaaa/2-y.webp', null)]);
  await db.insert(events).values([
    { type: 'tree_viewed_guest', treeId: 'aaaaaaaa', createdAt: ago(1) },
    { type: 'tree_viewed_guest', treeId: 'aaaaaaaa', createdAt: ago(30) },
    { type: 'tree_created', treeId: 'aaaaaaaa', createdAt: ago(1) },
  ]);
  await db.insert(reports).values([
    { treeId: 'aaaaaaaa', reporter: 'owner', status: 'open', photoSnapshotKey: 'r/1.webp' },
    { treeId: 'aaaaaaaa', reporter: 'guest', status: 'dismissed' },
  ]);
  await db.insert(errorCounts).values({ hour: ago(30), count: 4, lastAt: ago(30), lastRoute: '/api/cu', lastStatus: 500 });
}

const overview = async (cookie: string) => {
  const r = await t.app.inject({ url: '/api/admin/overview', headers: { cookie } });
  expect(r.statusCode).toBe(200);
  return r.json();
};

describe('GET /api/admin/overview', () => {
  it('không có phiên quản trị → 401', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    expect((await t.app.inject('/api/admin/overview')).statusCode).toBe(401);
  });

  it('số liệu người dùng: tổng, 24 giờ, báo cáo chờ, lan truyền, mốc kế tiếp', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    await seed();
    const a = await adminLogin(t.app);
    const o = await overview(a.cookie);
    expect(o.phase).toBe('BUILD');
    expect(o.next).toEqual({ key: 'unlockAt', at: '2026-12-23T17:00:00.000Z' });
    expect(o.users.trees).toEqual({ total: 3, last24h: 2 });
    expect(o.users.messages).toEqual({ total: 2, last24h: 1 });
    expect(o.users.views).toEqual({ total: 2, last24h: 1 });
    expect(o.users.openReports).toBe(1);
    expect(o.users.viral).toBeCloseTo(1 / 3);
    expect(JSON.stringify(o)).not.toContain('bí mật');
  });

  it('khối máy chủ: CSDL, kho ảnh, Azure, hạn mức theo env', async () => {
    t = await makeTestApp({ env: { ...ADMIN_ENV, DB_QUOTA_GB: '10', ADMIN_AZURE_URL: 'https://portal.azure.com/rg' } });
    await seed();
    const a = await adminLogin(t.app);
    const s = (await overview(a.cookie)).server;
    expect(s.dbBytes).toBeGreaterThan(0);
    expect(s.dbQuotaBytes).toBe(10 * 1024 ** 3);
    expect(s.photos).toEqual({ count: 2, bytes: 1000, unknown: 1, reportSnapshots: 1 });
    expect(s.azureUrl).toBe('https://portal.azure.com/rg');
    expect(typeof s.p95Ms).toBe('number');
    expect(typeof s.latencySince).toBe('string');
  });

  it('lỗi 5xx được đếm theo giờ, ghi mẫu route, không đếm lỗi cũ hơn 24 giờ', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    await seed();
    t.app.get('/api/__boom/:id', async () => { throw new Error('nổ'); });
    expect((await t.app.inject('/api/__boom/abcdefgh')).statusCode).toBe(500);
    expect((await t.app.inject('/api/__boom/khac')).statusCode).toBe(500);
    const a = await adminLogin(t.app);
    const s = (await overview(a.cookie)).server;
    expect(s.errors24h).toBe(2);
    expect(s.lastError).toEqual({ at: NOW.toISOString(), route: '/api/__boom/:id', status: 500 });
  });

  it('không có phòng nào → lan truyền null, không lỗi', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const a = await adminLogin(t.app);
    const o = await overview(a.cookie);
    expect(o.users.viral).toBeNull();
    expect(o.server.lastError).toBeNull();
  });
});
