import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { catalog } from '@ctln/shared';
import { adminLogin, makeTestApp, ADMIN_EMAIL, ADMIN_ENV } from './helpers.js';
import { adminAudit, adminUsers } from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { memoryStore } from '../src/storage/memory.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const login = (idToken: string) =>
  t.app.inject({ method: 'POST', url: '/api/admin/auth/google', headers: JSON_CT, payload: { idToken } });
const me = (cookie?: string) => t.app.inject({ url: '/api/admin/me', headers: cookie ? { cookie } : {} });
const actions = async () => (await t.h.db.select().from(adminAudit)).map((r) => r.action);

describe('đăng nhập quản trị', () => {
  it('email trong danh sách → 200, cookie đúng thuộc tính, ghi google_sub và audit login', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const r = await login(`ok:admin-sub:${ADMIN_EMAIL}`);
    expect(r.statusCode).toBe(200);
    expect(r.json().email).toBe(ADMIN_EMAIL);
    expect(typeof r.json().csrfToken).toBe('string');
    const c = String(r.headers['set-cookie']);
    expect(c).toContain('ctln_admin=');
    expect(c).toContain('Path=/api/admin');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Strict');
    const [u] = await t.h.db.select().from(adminUsers);
    expect(u!.googleSub).toBe('admin-sub');
    expect(u!.lastLoginAt).not.toBeNull();
    expect(await actions()).toEqual(['login']);
  });

  it('email lạ / chưa xác minh / bị khoá / sub khác sau lần đầu → 403 not_admin', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    expect((await login('ok:x:la@test.vn')).json().error.code).toBe('not_admin');
    expect((await login(`unverified:admin-sub:${ADMIN_EMAIL}`)).statusCode).toBe(403);
    expect((await login(`ok:admin-sub:${ADMIN_EMAIL.toUpperCase()}`)).statusCode).toBe(200);
    expect((await login(`ok:sub-khac:${ADMIN_EMAIL}`)).statusCode).toBe(403);
    await t.h.db.update(adminUsers).set({ disabled: true });
    expect((await login(`ok:admin-sub:${ADMIN_EMAIL}`)).statusCode).toBe(403);
  });

  it('token hỏng → 400 google_invalid; không cấu hình Google → 503', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    expect((await login('hỏng')).json().error.code).toBe('google_invalid');
    await t.app.close(); await t.h.close();
    t = await makeTestApp({ env: ADMIN_ENV, google: null });
    expect((await login(`ok:admin-sub:${ADMIN_EMAIL}`)).statusCode).toBe(503);
  });

  it('lần thất bại thứ 11 trong giờ từ cùng IP → 429; thành công không tính', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    for (let i = 0; i < 3; i++) expect((await login(`ok:admin-sub:${ADMIN_EMAIL}`)).statusCode).toBe(200);
    for (let i = 0; i < 10; i++) expect((await login('ok:x:la@test.vn')).statusCode).toBe(403);
    expect((await login('ok:x:la@test.vn')).json().error.code).toBe('rate_limited');
  });

  it('bootstrap chạy hai lần chỉ tạo một dòng; không đặt biến → không có ai', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const again = await buildApp({ db: t.h, env: loadEnv(ADMIN_ENV), now: () => new Date(), google: null, photos: memoryStore() });
    await again.close();
    expect(await t.h.db.select().from(adminUsers)).toHaveLength(1);
    await t.app.close(); await t.h.close();
    t = await makeTestApp();
    expect(await t.h.db.select().from(adminUsers)).toHaveLength(0);
  });
});

describe('phiên quản trị', () => {
  it('me: không cookie → 401; có → email + csrf; quá 12 giờ → 401', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    expect((await me()).json().error.code).toBe('admin_required');
    const a = await adminLogin(t.app);
    const ok = await me(a.cookie);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ email: ADMIN_EMAIL, csrfToken: a.csrf });
    expect(ok.headers['x-robots-tag']).toBe('noindex');
    expect(ok.headers['cache-control']).toBe('no-store');
    t.clock.set('2026-12-01T22:00:01+07:00');
    expect((await me(a.cookie)).statusCode).toBe(401);
  });

  it('cookie chủ cây không vào được API quản trị; cookie quản trị không vào được API chủ cây', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const room = { ...structuredClone(catalog.defaultRoom), items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })) };
    const c = await t.app.inject({ method: 'POST', url: '/api/trees', headers: JSON_CT, payload: { ownerName: 'Lan', recovery: { type: 'pin', pin: '123456' }, room } });
    const id = c.json().id as string;
    const ownerCookie = String(c.headers['set-cookie']).split(';')[0]!;
    expect((await me(ownerCookie)).statusCode).toBe(401);
    const a = await adminLogin(t.app);
    expect((await t.app.inject({ url: `/api/trees/${id}/owner`, headers: { cookie: a.cookie } })).statusCode).toBe(401);
  });

  it('đăng xuất: thiếu / sai CSRF → 403 csrf; đúng → 204, phiên hết dùng được, audit logout', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const a = await adminLogin(t.app);
    const out = (h: Record<string, string>) => t.app.inject({ method: 'POST', url: '/api/admin/auth/logout', headers: { cookie: a.cookie, ...h } });
    expect((await out({})).json().error.code).toBe('csrf');
    expect((await out({ 'x-csrf-token': 'sai' })).statusCode).toBe(403);
    expect((await out({ 'x-csrf-token': a.csrf })).statusCode).toBe(204);
    expect((await me(a.cookie)).statusCode).toBe(401);
    expect(await actions()).toEqual(['login', 'logout']);
  });

  it('sau ENDED: API quản trị vẫn chạy, API khác 410', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    t.clock.set('2027-01-02T00:00:00+07:00');
    const a = await adminLogin(t.app);
    expect((await me(a.cookie)).statusCode).toBe(200);
    expect((await t.app.inject('/api/trees/abcdefgh')).statusCode).toBe(410);
  });

  it('admin_users bị khoá giữa phiên → 401', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const a = await adminLogin(t.app);
    await t.h.db.update(adminUsers).set({ disabled: true }).where(eq(adminUsers.email, ADMIN_EMAIL));
    expect((await me(a.cookie)).statusCode).toBe(401);
  });
});
