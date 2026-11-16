import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { catalog } from '@ctln/shared';
import { makeTestApp } from './helpers.js';
import { authAttempts, ownerSessions, trees } from '../src/db/schema.js';
import { getOwnerSession } from '../src/guards.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const room = () => ({
  ...structuredClone(catalog.defaultRoom),
  items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })),
});
const create = async (recovery: object) => {
  const r = await t.app.inject({
    method: 'POST', url: '/api/trees', headers: JSON_CT,
    payload: { ownerName: 'Lan', recovery, room: room() },
  });
  const j = r.json();
  return { id: j.id as string, key: String(j.privateUrl).split('#k=')[1]! };
};
const post = (url: string, payload: object, cookie?: string) =>
  t.app.inject({ method: 'POST', url, headers: { ...JSON_CT, ...(cookie ? { cookie } : {}) }, payload });
const pin = (id: string, p: string) => post(`/api/trees/${id}/auth/pin`, { pin: p });
const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers['set-cookie']).split(';')[0]!;

describe('auth link', () => {
  it('đúng khoá → 204 + cookie, sai → 401, ghi auth_attempts', async () => {
    t = await makeTestApp();
    const { id, key } = await create({ type: 'pin', pin: '123456' });
    const ok = await post(`/api/trees/${id}/auth/link`, { key });
    expect(ok.statusCode).toBe(204);
    expect(String(ok.headers['set-cookie'])).toContain(`ctln_owner_${id}=`);
    const bad = await post(`/api/trees/${id}/auth/link`, { key: 'sai' });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe('bad_key');
    const rows = await t.h.db.select().from(authAttempts).where(eq(authAttempts.method, 'link'));
    expect(rows.map((r) => r.success).sort()).toEqual([false, true]);
  });

  it('cây không tồn tại → 404', async () => {
    t = await makeTestApp();
    const r = await post('/api/trees/khongco1/auth/link', { key: 'x' });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe('not_found');
  });
});

describe('auth pin', () => {
  it('đúng PIN → 204 + cookie', async () => {
    t = await makeTestApp();
    const { id } = await create({ type: 'pin', pin: '123456' });
    const r = await pin(id, '123456');
    expect(r.statusCode).toBe(204);
    expect(String(r.headers['set-cookie'])).toContain(`ctln_owner_${id}=`);
  });

  it('cây tạo bằng Google (không PIN) → 400 pin_not_set', async () => {
    t = await makeTestApp();
    const { id } = await create({ type: 'google', idToken: 'ok:sub-1' });
    const r = await pin(id, '123456');
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('pin_not_set');
  });

  it('sai 5 lần → lần 5 vẫn 401, lần 6 (đúng PIN) 429 pin_locked + retryAt; sau 15 phút 1 giây mở lại', async () => {
    t = await makeTestApp();
    const { id } = await create({ type: 'pin', pin: '123456' });
    for (let i = 0; i < 5; i++) {
      const r = await pin(id, '000000');
      expect(r.statusCode).toBe(401);
      expect(r.json().error.code).toBe('bad_pin');
    }
    const locked = await pin(id, '123456');
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe('pin_locked');
    expect(locked.json().error.retryAt).toBe(new Date('2026-12-01T10:15:00+07:00').toISOString());
    const [row] = await t.h.db.select().from(trees).where(eq(trees.id, id));
    expect(row!.pinFailedCount).toBe(0);
    t.clock.set('2026-12-01T10:15:01+07:00');
    expect((await pin(id, '123456')).statusCode).toBe(204);
  });

  it('PIN đúng đặt lại bộ đếm', async () => {
    t = await makeTestApp();
    const { id } = await create({ type: 'pin', pin: '123456' });
    for (let i = 0; i < 4; i++) await pin(id, '000000');
    expect((await pin(id, '123456')).statusCode).toBe(204);
    const [row] = await t.h.db.select().from(trees).where(eq(trees.id, id));
    expect(row!.pinFailedCount).toBe(0);
    for (let i = 0; i < 4; i++) expect((await pin(id, '000000')).statusCode).toBe(401);
  });

  it('20 lần sai trên 5 phòng từ cùng IP → lần 21 là 429 rate_limited', async () => {
    t = await makeTestApp();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await create({ type: 'pin', pin: '123456' })).id);
    for (const id of ids) for (let i = 0; i < 4; i++) expect((await pin(id, '000000')).statusCode).toBe(401);
    const r = await pin(ids[0]!, '123456');
    expect(r.statusCode).toBe(429);
    expect(r.json().error.code).toBe('rate_limited');
  });
});

describe('auth google', () => {
  it('không treeId → danh sách phòng của sub-1; có treeId của người khác → 403', async () => {
    t = await makeTestApp();
    const a = await create({ type: 'google', idToken: 'ok:sub-1' });
    const b = await create({ type: 'google', idToken: 'ok:sub-1' });
    const other = await create({ type: 'google', idToken: 'ok:sub-2' });
    const list = await post('/api/auth/google', { idToken: 'ok:sub-1' });
    expect(list.statusCode).toBe(200);
    expect(list.json().trees.map((x: { id: string }) => x.id).sort()).toEqual([a.id, b.id].sort());
    const forbidden = await post('/api/auth/google', { idToken: 'ok:sub-1', treeId: other.id });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe('not_owner');
    const ok = await post('/api/auth/google', { idToken: 'ok:sub-1', treeId: a.id });
    expect(ok.statusCode).toBe(204);
    expect(String(ok.headers['set-cookie'])).toContain(`ctln_owner_${a.id}=`);
  });

  it('token sai → 400 google_invalid', async () => {
    t = await makeTestApp();
    const r = await post('/api/auth/google', { idToken: 'bad' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('google_invalid');
  });

  it('chưa cấu hình Google → 503', async () => {
    t = await makeTestApp({ google: null });
    const r = await post('/api/auth/google', { idToken: 'ok:sub-1' });
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe('google_unavailable');
  });
});

describe('auth logout', () => {
  it('đăng xuất rồi dùng lại cookie cũ → không còn phiên', async () => {
    t = await makeTestApp();
    const { id, key } = await create({ type: 'pin', pin: '123456' });
    const login = await post(`/api/trees/${id}/auth/link`, { key });
    const cookie = cookieOf(login);
    const fakeReq = { cookies: { [`ctln_owner_${id}`]: cookie.split('=')[1] } } as never;
    expect(await getOwnerSession(t.app, fakeReq, id)).not.toBeNull();
    const out = await post(`/api/trees/${id}/auth/logout`, {}, cookie);
    expect(out.statusCode).toBe(204);
    expect(String(out.headers['set-cookie'])).toContain(`ctln_owner_${id}=;`);
    expect(await getOwnerSession(t.app, fakeReq, id)).toBeNull();
    const revoked = (await t.h.db.select().from(ownerSessions)).filter((s) => s.revokedAt !== null);
    expect(revoked).toHaveLength(1);
  });

  it('không có phiên vẫn 204', async () => {
    t = await makeTestApp();
    const { id } = await create({ type: 'pin', pin: '123456' });
    expect((await post(`/api/trees/${id}/auth/logout`, {})).statusCode).toBe(204);
  });
});
