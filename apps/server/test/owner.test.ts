import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { catalog } from '@ctln/shared';
import { makeTestApp, deviceHeaders } from './helpers.js';
import { blockedDevices, events, messages, reports } from '../src/db/schema.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const ORN = Object.keys(catalog.ornaments)[0]!;
const room = () => ({
  ...structuredClone(catalog.defaultRoom),
  items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })),
});

async function mkTree() {
  const r = await t.app.inject({
    method: 'POST', url: '/api/trees', headers: JSON_CT,
    payload: { ownerName: 'Lan', title: 'Cây', recovery: { type: 'pin', pin: '123456' }, room: room() },
  });
  const id = r.json().id as string;
  const token = /ctln_owner_[a-z2-9]+=([^;]+)/.exec(String(r.headers['set-cookie']))![1]!;
  return { id, cookies: { [`ctln_owner_${id}`]: token } };
}
const setup = async (at?: string) => { t = await makeTestApp(at ? { at } : {}); return mkTree(); };
const post = async (id: string, slotIndex: number, deviceId?: string, extra: object = {}) => {
  const r = await t.app.inject({
    method: 'POST', url: `/api/trees/${id}/messages`, headers: { ...JSON_CT, ...deviceHeaders(deviceId) },
    payload: { slotIndex, ornament: ORN, anonymous: false, authorName: 'Minh', content: 'Chúc mừng Giáng sinh', ...extra },
  });
  return r;
};
const open = (id: string, mid: string, cookies?: Record<string, string>) =>
  t.app.inject({ method: 'POST', url: `/api/trees/${id}/messages/${mid}/open`, cookies });
const delMsg = (id: string, mid: string, cookies?: Record<string, string>) =>
  t.app.inject({ method: 'DELETE', url: `/api/trees/${id}/messages/${mid}`, cookies });
const block = (id: string, payload: object, cookies?: Record<string, string>) =>
  t.app.inject({ method: 'POST', url: `/api/trees/${id}/block`, headers: JSON_CT, cookies, payload });
const report = (id: string, payload: object, headers: object = {}, cookies?: Record<string, string>) =>
  t.app.inject({ method: 'POST', url: `/api/trees/${id}/reports`, headers: { ...JSON_CT, ...headers }, cookies, payload });

describe('global block', () => {
  it('khách bị chặn toàn cục không báo cáo được', async () => {
    const { id } = await setup();
    const dev = '123e4567-e89b-42d3-a456-426614174000';
    const { globalBlocks } = await import('../src/db/schema.js');
    const { deviceHash } = await import('../src/security.js');
    await t.h.db.insert(globalBlocks).values({ kind: 'device', valueHash: deviceHash(t.app.deps.env, dev) });
    t.clock.set('2026-12-01T10:02:00+07:00');
    const r = await report(id, { reason: 'x' }, deviceHeaders(dev));
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('blocked');
  });
});

describe('open', () => {
  it('trước 0h 24/12: 423 locked kèm unlockAt; đúng 0h: 200 có content, unread:false, tác giả không sửa được', async () => {
    const { id, cookies } = await setup();
    const p = (await post(id, 1)).json();
    t.clock.set('2026-12-23T23:59:59+07:00');
    const r1 = await open(id, p.messageId, cookies);
    expect(r1.statusCode).toBe(423);
    expect(r1.json().error.code).toBe('locked');
    expect(r1.json().error.unlockAt).toBe('2026-12-23T17:00:00.000Z');
    expect(r1.body).not.toContain('Chúc mừng');

    t.clock.set('2026-12-24T00:00:00+07:00');
    const r2 = await open(id, p.messageId, cookies);
    expect(r2.statusCode).toBe(200);
    expect(r2.json()).toMatchObject({
      messageId: p.messageId, slotIndex: 1, ornament: ORN, anonymous: false, authorName: 'Minh',
      content: 'Chúc mừng Giáng sinh',
    });
    expect(typeof r2.json().createdAt).toBe('string');
    const o = await t.app.inject({ method: 'GET', url: `/api/trees/${id}/owner`, cookies });
    expect(o.json().slots.find((s: { index: number }) => s.index === 1).unread).toBe(false);
    const e = await t.app.inject({
      method: 'PUT', url: `/api/messages/${p.messageId}`, headers: { ...JSON_CT, 'x-edit-token': p.editToken },
      payload: { ornament: ORN, anonymous: false, authorName: 'Minh', content: 'sửa' },
    });
    expect(e.statusCode).toBe(403);
    expect(e.json().error.code).toBe('already_opened');
  });

  it('mở lần hai không đổi read_at', async () => {
    const { id, cookies } = await setup();
    const p = (await post(id, 1)).json();
    t.clock.set('2026-12-24T01:00:00+07:00');
    await open(id, p.messageId, cookies);
    const [a] = await t.h.db.select().from(messages);
    t.clock.set('2026-12-24T02:00:00+07:00');
    expect((await open(id, p.messageId, cookies)).statusCode).toBe(200);
    const [b] = await t.h.db.select().from(messages);
    expect(b!.readAt).toEqual(a!.readAt);
    const ev = await t.h.db.select().from(events).where(eq(events.type, 'message_opened'));
    expect(ev).toHaveLength(1);
  });

  it('NOTICE: 200', async () => {
    const { id, cookies } = await setup();
    const p = (await post(id, 1)).json();
    t.clock.set('2026-12-28T10:00:00+07:00');
    expect((await open(id, p.messageId, cookies)).statusCode).toBe(200);
  });

  it('khách không cookie: 401', async () => {
    const { id } = await setup();
    const p = (await post(id, 1)).json();
    t.clock.set('2026-12-24T01:00:00+07:00');
    const r = await open(id, p.messageId);
    expect(r.statusCode).toBe(401);
    expect(r.body).not.toContain('Chúc mừng');
  });

  it('mid của phòng khác hoặc không tồn tại: 404', async () => {
    const a = await setup();
    const b = await mkTree();
    const p = (await post(b.id, 1)).json();
    t.clock.set('2026-12-24T01:00:00+07:00');
    expect((await open(a.id, p.messageId, a.cookies)).statusCode).toBe(404);
    expect((await open(a.id, '999999', a.cookies)).statusCode).toBe(404);
    expect((await open(a.id, 'abc', a.cookies)).statusCode).toBe(404);
  });
});

describe('delete / block', () => {
  it('xoá: 204, lời nhắn mất; phòng khác 404; khách 401', async () => {
    const a = await setup();
    const b = await mkTree();
    const p = (await post(a.id, 1)).json();
    expect((await delMsg(a.id, p.messageId)).statusCode).toBe(401);
    expect((await delMsg(b.id, p.messageId, b.cookies)).statusCode).toBe(404);
    expect((await delMsg(a.id, p.messageId, a.cookies)).statusCode).toBe(204);
    expect(await t.h.db.select().from(messages)).toHaveLength(0);
  });

  it('xoá được ở NOTICE', async () => {
    const { id, cookies } = await setup();
    const p = (await post(id, 1)).json();
    t.clock.set('2026-12-28T10:00:00+07:00');
    expect((await delMsg(id, p.messageId, cookies)).statusCode).toBe(204);
  });

  it('chặn: lời nhắn mất, cùng thiết bị 403 blocked, thiết bị khác treo được', async () => {
    const { id, cookies } = await setup();
    const dev = '11111111-1111-4111-8111-111111111111';
    const p = (await post(id, 1, dev)).json();
    expect((await block(id, { messageId: p.messageId })).statusCode).toBe(401);
    expect((await block(id, { messageId: p.messageId }, cookies)).statusCode).toBe(204);
    expect(await t.h.db.select().from(messages)).toHaveLength(0);
    expect(await t.h.db.select().from(blockedDevices)).toHaveLength(1);
    const again = await post(id, 2, dev);
    expect(again.statusCode).toBe(403);
    expect(again.json().error.code).toBe('blocked');
    expect((await post(id, 2)).statusCode).toBe(201);
  });

  it('chặn hai lần cùng thiết bị không lỗi; mid sai 404; body sai 400', async () => {
    const { id, cookies } = await setup();
    const dev = '22222222-2222-4222-8222-222222222222';
    const p1 = (await post(id, 1, dev)).json();
    const p2 = (await post(id, 2, dev)).json();
    expect((await block(id, { messageId: p1.messageId }, cookies)).statusCode).toBe(204);
    expect((await block(id, { messageId: p2.messageId }, cookies)).statusCode).toBe(204);
    expect(await t.h.db.select().from(blockedDevices)).toHaveLength(1);
    expect((await block(id, { messageId: '999999' }, cookies)).statusCode).toBe(404);
    expect((await block(id, {}, cookies)).statusCode).toBe(400);
  });

  it('mid phòng khác khi chặn: 404, không chặn gì', async () => {
    const a = await setup();
    const b = await mkTree();
    const p = (await post(b.id, 1)).json();
    expect((await block(a.id, { messageId: p.messageId }, a.cookies)).statusCode).toBe(404);
    expect(await t.h.db.select().from(blockedDevices)).toHaveLength(0);
    expect(await t.h.db.select().from(messages)).toHaveLength(1);
  });
});

describe('reports', () => {
  it('chủ cây kèm messageId: snapshot đúng, reporter owner, hash NULL', async () => {
    const { id, cookies } = await setup();
    const p = (await post(id, 1)).json();
    const r = await report(id, { messageId: p.messageId, reason: '  spam  ' }, {}, cookies);
    expect(r.statusCode).toBe(201);
    expect(typeof r.json().reportId).toBe('string');
    const [row] = await t.h.db.select().from(reports);
    expect(row).toMatchObject({
      reporter: 'owner', reporterHash: null, messageSnapshot: 'Chúc mừng Giáng sinh', reason: 'spam', status: 'open',
    });
    expect(String(row!.messageId)).toBe(p.messageId);
  });

  it('chủ cây báo cáo mid phòng khác: 404', async () => {
    const a = await setup();
    const b = await mkTree();
    const p = (await post(b.id, 1)).json();
    expect((await report(a.id, { messageId: p.messageId }, {}, a.cookies)).statusCode).toBe(404);
  });

  it('khách: message_id NULL, reporter guest, hash thiết bị; cần X-Device-Id; không được gửi messageId', async () => {
    const { id } = await setup();
    expect((await report(id, { reason: 'x' })).statusCode).toBe(400);
    const bad = await report(id, { messageId: '1' }, deviceHeaders());
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('invalid_body');
    const r = await report(id, { reason: '' }, deviceHeaders());
    expect(r.statusCode).toBe(201);
    const [row] = await t.h.db.select().from(reports);
    expect(row).toMatchObject({ reporter: 'guest', messageId: null, messageSnapshot: null, reason: null });
    expect(row!.reporterHash).toBeTruthy();
  });

  it('khách: lý do > 200 ký tự 400; cây không tồn tại 404; giới hạn 10/giờ/IP', async () => {
    const { id } = await setup();
    expect((await report(id, { reason: 'a'.repeat(201) }, deviceHeaders())).statusCode).toBe(400);
    expect((await report('khongco', { reason: 'x' }, deviceHeaders())).statusCode).toBe(404);
    for (let i = 0; i < 10; i++) expect((await report(id, { reason: 'x' }, deviceHeaders())).statusCode).toBe(201);
    const r = await report(id, { reason: 'x' }, deviceHeaders());
    expect(r.statusCode).toBe(429);
    expect(r.json().error.code).toBe('rate_limited');
  });

  it('khách báo cáo được ở NOTICE', async () => {
    const { id } = await setup();
    t.clock.set('2026-12-28T10:00:00+07:00');
    expect((await report(id, { reason: 'x' }, deviceHeaders())).statusCode).toBe(201);
  });
});
