import { describe, it, expect, afterEach } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { catalog } from '@ctln/shared';
import { adminLogin, makeTestApp, ADMIN_ENV } from './helpers.js';
import { adminAudit, events, messages, ownerSessions, rateCounters, reports } from '../src/db/schema.js';
import { windowEnd, windowStart } from '../src/security.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const NOW = new Date('2026-12-01T03:00:00Z');
const DAY = 86_400_000;
const room = () => ({ ...structuredClone(catalog.defaultRoom), items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })) });

/** Cây tạo qua API (PIN 123456, 1 phiên chủ cây) + 2 lời nhắn (1 đã mở, 1 có ảnh) + 1 phiên đã thu hồi + 2 báo cáo (1 mở). */
async function seed() {
  const c = await t.app.inject({ method: 'POST', url: '/api/trees', headers: JSON_CT, payload: { ownerName: 'Lan', title: 'Cây Lan', recovery: { type: 'pin', pin: '123456' }, room: room() } });
  const id = c.json().id as string;
  const ownerCookie = String(c.headers['set-cookie']).split(';')[0]!;
  const msg = (slotIndex: number, readAt: Date | null, photoKey: string | null) => ({
    treeId: id, slotIndex, ornament: 'bell', isAnonymous: false, authorName: 'Người viết bí mật', content: 'nội dung bí mật',
    editTokenHash: `h${slotIndex}`, editUntil: NOW, deviceHash: `d${slotIndex}`, createdAt: NOW, updatedAt: NOW, readAt, photoKey,
  });
  await t.h.db.insert(messages).values([msg(0, NOW, null), msg(1, null, `m/${id}/2-x.webp`)]);
  await t.photos.put(`m/${id}/2-x.webp`, Buffer.from('p'));
  await t.h.db.insert(ownerSessions).values({ treeId: id, tokenHash: 'cu', method: 'pin', expiresAt: new Date(NOW.getTime() + DAY), revokedAt: NOW });
  await t.h.db.insert(reports).values([{ treeId: id, reporter: 'guest', status: 'open' }, { treeId: id, reporter: 'guest', status: 'dismissed' }]);
  return { id, ownerCookie };
}

const get = (cookie: string, id: string) => t.app.inject({ url: `/api/admin/trees/${id}`, headers: { cookie } });
const act = (a: { cookie: string; csrf: string }, method: 'POST' | 'DELETE', url: string, payload: object = {}) =>
  t.app.inject({ method, url, headers: { ...JSON_CT, cookie: a.cookie, 'x-csrf-token': a.csrf }, payload });

const KEYS = ['id', 'ownerName', 'title', 'createdAt', 'lastOwnerVisitAt', 'itemCount', 'messages', 'recovery', 'activeSessions', 'reports', 'pin'];

describe('GET /api/admin/trees/:id', () => {
  it('số liệu đúng, không có nội dung lời nhắn / tên người viết / khoá ảnh', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const { id } = await seed();
    const a = await adminLogin(t.app);
    const r = await get(a.cookie, id);
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(Object.keys(j).sort()).toEqual([...KEYS].sort());
    expect(j).toMatchObject({
      id, ownerName: 'Lan', title: 'Cây Lan', itemCount: catalog.defaultRoom.items.length,
      messages: { opened: 1, unopened: 1 }, recovery: { pin: true, google: false }, activeSessions: 1,
      reports: { open: 1, total: 2 }, pin: { failsToday: 0, lockedUntil: null },
    });
    const text = JSON.stringify(j);
    for (const secret of ['nội dung bí mật', 'Người viết bí mật', '2-x.webp']) expect(text).not.toContain(secret);
  });

  it('không có cây → 404; không phiên → 401', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    expect((await t.app.inject('/api/admin/trees/abcdefgh')).statusCode).toBe(401);
    const a = await adminLogin(t.app);
    expect((await get(a.cookie, 'abcdefgh')).statusCode).toBe(404);
  });
});

describe('hành động trên phòng', () => {
  it('PIN chạm trần ngày → hiện khoá; mở khoá xoá đúng bucket của cây này, PIN đúng vào lại được', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const { id } = await seed();
    await t.h.db.insert(rateCounters).values([
      { bucket: `pin:tree:${id}`, windowStart: windowStart(NOW, DAY), hits: 50 },
      { bucket: `pin:tree:${id}:ip:xyz`, windowStart: windowStart(NOW, 15 * 60_000), hits: 3 },
      { bucket: 'pin:tree:khacnua2', windowStart: windowStart(NOW, DAY), hits: 7 },
    ]);
    const a = await adminLogin(t.app);
    expect((await get(a.cookie, id)).json().pin).toEqual({ failsToday: 50, lockedUntil: windowEnd(NOW, DAY).toISOString() });
    expect((await t.app.inject({ method: 'POST', url: `/api/trees/${id}/auth/pin`, headers: JSON_CT, payload: { pin: '123456' } })).statusCode).toBe(429);
    expect((await act(a, 'POST', `/api/admin/trees/${id}/unlock-pin`, { note: 'chủ cây nhờ' })).statusCode).toBe(204);
    expect(await t.h.db.select().from(rateCounters).where(like(rateCounters.bucket, `pin:tree:${id}%`))).toHaveLength(0);
    expect(await t.h.db.select().from(rateCounters).where(eq(rateCounters.bucket, 'pin:tree:khacnua2'))).toHaveLength(1);
    expect((await t.app.inject({ method: 'POST', url: `/api/trees/${id}/auth/pin`, headers: JSON_CT, payload: { pin: '123456' } })).statusCode).toBe(204);
    const [log] = await t.h.db.select().from(adminAudit).where(eq(adminAudit.action, 'pin_unlock'));
    expect(log).toMatchObject({ targetType: 'tree', targetId: id, note: 'chủ cây nhờ' });
  });

  it('thu hồi mọi phiên: cookie chủ cây cũ hết dùng được, trả số phiên đã thu hồi, có audit', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const { id, ownerCookie } = await seed();
    expect((await t.app.inject({ url: `/api/trees/${id}/owner`, headers: { cookie: ownerCookie } })).statusCode).toBe(200);
    const a = await adminLogin(t.app);
    const r = await act(a, 'POST', `/api/admin/trees/${id}/revoke-sessions`);
    expect(r.json()).toEqual({ revoked: 1 });
    expect((await t.app.inject({ url: `/api/trees/${id}/owner`, headers: { cookie: ownerCookie } })).statusCode).toBe(401);
    expect(await t.h.db.select().from(adminAudit).where(eq(adminAudit.action, 'sessions_revoke'))).toHaveLength(1);
  });

  it('xoá phòng: bắt buộc ghi chú; xoá cây và ảnh; audit tree_delete; không có cây → 404', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const { id } = await seed();
    const a = await adminLogin(t.app);
    expect((await act(a, 'DELETE', `/api/admin/trees/${id}`, {})).statusCode).toBe(400);
    expect((await act(a, 'DELETE', `/api/admin/trees/${id}`, { note: 'chủ cây xin xoá, đã xác minh' })).statusCode).toBe(204);
    expect((await get(a.cookie, id)).statusCode).toBe(404);
    expect(t.photos.keys()).toEqual([]);
    const [log] = await t.h.db.select().from(adminAudit).where(eq(adminAudit.action, 'tree_delete'));
    expect(log).toMatchObject({ targetId: id, note: 'chủ cây xin xoá, đã xác minh' });
    expect((await act(a, 'DELETE', `/api/admin/trees/${id}`, { note: 'x' })).statusCode).toBe(404);
  });

  it('thiếu CSRF → 403, không làm gì', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const { id } = await seed();
    const a = await adminLogin(t.app);
    const r = await act({ cookie: a.cookie, csrf: 'sai' }, 'POST', `/api/admin/trees/${id}/revoke-sessions`);
    expect(r.statusCode).toBe(403);
    expect(await t.h.db.select().from(adminAudit).where(eq(adminAudit.action, 'sessions_revoke'))).toHaveLength(0);
  });
});

describe('GET /api/admin/audit', () => {
  it('mới nhất trước, 50 dòng một trang, nextBefore phân trang, có email', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const a = await adminLogin(t.app); // 1 dòng login
    await t.h.db.insert(adminAudit).values(Array.from({ length: 55 }, (_, i) => ({ adminId: 1, action: 'pin_unlock', targetType: 'tree', targetId: `t${i}` })));
    const p1 = (await t.app.inject({ url: '/api/admin/audit', headers: { cookie: a.cookie } })).json();
    expect(p1.items).toHaveLength(50);
    expect(p1.items[0]).toMatchObject({ action: 'pin_unlock', targetId: 't54', email: 'admin@test.vn' });
    expect(p1.nextBefore).toBe(p1.items[49].id);
    const p2 = (await t.app.inject({ url: `/api/admin/audit?before=${p1.nextBefore}`, headers: { cookie: a.cookie } })).json();
    expect(p2.items).toHaveLength(6);
    expect(p2.items[5].action).toBe('login');
    expect(p2.nextBefore).toBeNull();
  });
});

describe('GET /api/admin/trees/:id/room.png', () => {
  it('ảnh phòng cho quản trị: không ghi event tải ảnh, vẫn chạy sau ENDED, cần phiên quản trị', async () => {
    t = await makeTestApp({ env: ADMIN_ENV, renderRoomImage: async () => Buffer.from('PNG') });
    const { id } = await seed();
    expect((await t.app.inject(`/api/admin/trees/${id}/room.png`)).statusCode).toBe(401);
    t.clock.set('2027-01-02T00:00:00+07:00');
    const a = await adminLogin(t.app);
    const r = await t.app.inject({ url: `/api/admin/trees/${id}/room.png`, headers: { cookie: a.cookie } });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect(r.headers['content-disposition']).toBeUndefined();
    expect(await t.h.db.select().from(events).where(eq(events.type, 'image_downloaded'))).toHaveLength(0);
    expect((await t.app.inject({ url: '/api/admin/trees/zzzzzzzz/room.png', headers: { cookie: a.cookie } })).statusCode).toBe(404);
  });
});
