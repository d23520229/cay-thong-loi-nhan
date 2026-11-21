import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { catalog } from '@ctln/shared';
import { makeTestApp, deviceHeaders } from './helpers.js';
import { blockedDevices, messages, rateCounters } from '../src/db/schema.js';
import { deviceHash, ipHash } from '../src/security.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const ORN = Object.keys(catalog.ornaments)[0]!;
const room = () => ({
  ...structuredClone(catalog.defaultRoom),
  items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })),
});

async function setup(at?: string) {
  t = await makeTestApp(at ? { at } : {});
  const r = await t.app.inject({
    method: 'POST', url: '/api/trees', headers: JSON_CT,
    payload: { ownerName: 'Lan', title: 'Cây', recovery: { type: 'pin', pin: '123456' }, room: room() },
  });
  const id = r.json().id as string;
  const token = /ctln_owner_[a-z2-9]+=([^;]+)/.exec(String(r.headers['set-cookie']))![1]!;
  return { id, cookies: { [`ctln_owner_${id}`]: token } };
}
const body = (slotIndex: number, extra: object = {}) => ({
  slotIndex, ornament: ORN, anonymous: false, authorName: 'Minh', content: 'Chúc mừng Giáng sinh', ...extra,
});
const post = (id: string, payload: object, headers: object = deviceHeaders(), cookies?: Record<string, string>) =>
  t.app.inject({ method: 'POST', url: `/api/trees/${id}/messages`, headers: { ...JSON_CT, ...headers }, cookies, payload });
const tok = (token?: string) => (token ? { 'x-edit-token': token } : {});
const mine = (mid: string, token?: string) =>
  t.app.inject({ method: 'GET', url: `/api/messages/${mid}/mine`, headers: tok(token) });
const edit = (mid: string, token: string | undefined, payload: object) =>
  t.app.inject({ method: 'PUT', url: `/api/messages/${mid}`, headers: { ...JSON_CT, ...tok(token) }, payload });
const del = (mid: string, token?: string) =>
  t.app.inject({ method: 'DELETE', url: `/api/messages/${mid}`, headers: tok(token) });
const count = async () => (await t.h.db.select().from(messages)).length;

describe('POST /api/trees/:id/messages', () => {
  it('treo hợp lệ: 201, slot công khai occupied với ornament đúng', async () => {
    const { id } = await setup();
    const r = await post(id, body(2));
    expect(r.statusCode).toBe(201);
    const j = r.json();
    expect(typeof j.messageId).toBe('string');
    expect(j.editToken).toBeTruthy();
    expect(j.editUntil).toBe('2026-12-01T03:15:00.000Z');
    const pub = await t.app.inject({ method: 'GET', url: `/api/trees/${id}` });
    expect(pub.json().slots[2]).toEqual({ index: 2, occupied: true, ornament: ORN });
    expect(pub.body).not.toContain('Chúc mừng');
  });

  it('ẩn danh: không lưu tên', async () => {
    const { id } = await setup();
    const r = await post(id, { slotIndex: 0, ornament: ORN, anonymous: true, content: 'x' });
    expect(r.statusCode).toBe(201);
    const [m] = await t.h.db.select().from(messages);
    expect(m!.authorName).toBeNull();
    expect(m!.isAnonymous).toBe(true);
    expect(m!.ipHash).toBeTruthy();
  });

  it('2 thiết bị cùng slot song song: một 201, một 409 slot_taken', async () => {
    const { id } = await setup();
    const rs = await Promise.all([post(id, body(3), deviceHeaders()), post(id, body(3), deviceHeaders())]);
    expect(rs.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const lose = rs.find((r) => r.statusCode === 409)!;
    expect(lose.json().error.code).toBe('slot_taken');
    expect(await count()).toBe(1);
  });

  it('thiết bị thứ tư cùng deviceId: 409 device_limit', async () => {
    const { id } = await setup();
    const h = deviceHeaders();
    for (const s of [0, 1, 2]) expect((await post(id, body(s), h)).statusCode).toBe(201);
    const r = await post(id, body(3), h);
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('device_limit');
  });

  it('cookie chủ cây: 403 owner_cannot_post', async () => {
    const { id, cookies } = await setup();
    const r = await post(id, body(0), deviceHeaders(), cookies);
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('owner_cannot_post');
  });

  it('website có giá trị: 201 nhưng không lưu', async () => {
    const { id } = await setup();
    const r = await post(id, body(0, { website: 'x' }));
    expect(r.statusCode).toBe(201);
    expect(r.json().messageId).toMatch(/^\d+$/);
    expect(await count()).toBe(0);
  });

  it('honeypot kiểm trước chặn theo cây và ≤3/thiết bị: thiết bị bị chặn vẫn nhận 201 giả, không lưu', async () => {
    const { id } = await setup();
    const dev = randomUUID();
    for (let s = 0; s < 3; s++) expect((await post(id, body(s), deviceHeaders(dev))).statusCode).toBe(201);
    const full = await post(id, body(3, { website: 'x' }), deviceHeaders(dev));
    expect(full.statusCode).toBe(201);
    await t.h.db.insert(blockedDevices).values({ treeId: id, deviceHash: deviceHash(t.app.deps.env, dev) });
    const blocked = await post(id, body(4, { website: 'x' }), deviceHeaders(dev));
    expect(blocked.statusCode).toBe(201);
    expect(await count()).toBe(3);
    expect((await post(id, body(5), deviceHeaders(dev))).json().error.code).toBe('blocked');
  });

  it('thiếu X-Device-Id: 400; cây không có: 404', async () => {
    const { id } = await setup();
    const r = await post(id, body(0), {});
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('device_id_required');
    expect((await post('khongco', body(0))).statusCode).toBe(404);
  });

  it('slotIndex >= slotCount: 400 bad_slot', async () => {
    const { id } = await setup();
    const pub = await t.app.inject({ method: 'GET', url: `/api/trees/${id}` });
    const n = pub.json().tree.slotCount as number;
    expect(n).toBe(12);
    const r = await post(id, body(12));
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('bad_slot');
  });

  it('thiết bị bị chặn trên cây: 403 blocked', async () => {
    const { id } = await setup();
    const dev = randomUUID();
    const { blockedDevices } = await import('../src/db/schema.js');
    const { deviceHash } = await import('../src/security.js');
    const { loadEnv } = await import('../src/env.js');
    await t.h.db.insert(blockedDevices).values({ treeId: id, deviceHash: deviceHash(loadEnv({}), dev) });
    const r = await post(id, body(0), deviceHeaders(dev));
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('blocked');
  });

  it('lời nhắn thứ 101 trong giờ từ cùng IP → 429 rate_limited', async () => {
    const { id } = await setup();
    const { loadEnv } = await import('../src/env.js');
    const at = new Date('2026-12-01T10:00:00+07:00');
    await t.h.db.insert(rateCounters).values({
      bucket: 'msg:ip:' + ipHash(loadEnv({}), '127.0.0.1', at),
      windowStart: new Date(Math.floor(at.getTime() / 3600_000) * 3600_000),
      hits: 99,
    });
    expect((await post(id, body(0))).statusCode).toBe(201);
    const r = await post(id, body(1));
    expect(r.statusCode).toBe(429);
    expect(r.json().error.code).toBe('rate_limited');
  });

  it('khoá ghi từ 26/12: 403 write_closed', async () => {
    const { id } = await setup();
    t.clock.set('2026-12-26T01:00:00+07:00');
    const r = await post(id, body(0));
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('write_closed');
  });

  it('nội dung <script> lưu và trả nguyên văn', async () => {
    const { id } = await setup();
    const c = '<script>alert(1)</script>';
    const r = await post(id, body(0, { content: c }));
    const { messageId, editToken } = r.json();
    const m = await mine(messageId, editToken);
    expect(m.json().content).toBe(c);
  });
});

describe('GET /api/messages/:mid/mine', () => {
  it('đúng token có nội dung; sai/thiếu token 403 bad_token', async () => {
    const { id } = await setup();
    const { messageId, editToken, editUntil } = (await post(id, body(5))).json();
    const ok = await mine(messageId, editToken);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({
      messageId, slotIndex: 5, ornament: ORN, anonymous: false, authorName: 'Minh',
      content: 'Chúc mừng Giáng sinh', editUntil,
    });
    expect((await mine(messageId, 'sai')).json().error.code).toBe('bad_token');
    expect((await mine(messageId)).statusCode).toBe(403);
  });

  it('GET /mine: lời nhắn không tồn tại → 404 not_found; sai token → 403 bad_token', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(5))).json();
    const nf = await mine('999999', editToken);
    expect(nf.statusCode).toBe(404);
    expect(nf.json().error.code).toBe('not_found');
    const bad = await mine(messageId, 'sai');
    expect(bad.statusCode).toBe(403);
    expect(bad.json().error.code).toBe('bad_token');
  });

  it('hết hạn sửa vẫn xem được của mình', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(5))).json();
    t.clock.set('2026-12-01T11:00:00+07:00');
    expect((await mine(messageId, editToken)).statusCode).toBe(200);
  });
});

describe('PUT/DELETE /api/messages/:mid', () => {
  it('sửa phút 14: 200, editUntil không đổi; phút 15 giây 1: 403 edit_expired', async () => {
    const { id } = await setup();
    const { messageId, editToken, editUntil } = (await post(id, body(1))).json();
    t.clock.set('2026-12-01T10:14:00+07:00');
    const r = await edit(messageId, editToken, { ornament: ORN, anonymous: true, content: 'mới' });
    expect(r.statusCode).toBe(200);
    const m = (await mine(messageId, editToken)).json();
    expect(m.content).toBe('mới');
    expect(m.anonymous).toBe(true);
    expect(m.authorName).toBeNull();
    expect(m.editUntil).toBe(editUntil);
    t.clock.set('2026-12-01T10:15:01+07:00');
    const late = await edit(messageId, editToken, { ornament: ORN, anonymous: true, content: 'trễ' });
    expect(late.statusCode).toBe(403);
    expect(late.json().error.code).toBe('edit_expired');
    expect(late.json().error.message).toBe('Đã quá 15 phút, không sửa được nữa.');
    expect((await del(messageId, editToken)).json().error.code).toBe('edit_expired');
  });

  it('thiết bị bị chặn toàn cục: sửa/xoá đều 403 blocked', async () => {
    const { id } = await setup();
    const dev = randomUUID();
    const { messageId, editToken } = (await post(id, body(1), deviceHeaders(dev))).json();
    const { globalBlocks } = await import('../src/db/schema.js');
    const { deviceHash } = await import('../src/security.js');
    await t.h.db.insert(globalBlocks).values({ kind: 'device', valueHash: deviceHash(t.app.deps.env, dev) });
    t.clock.set('2026-12-01T10:02:00+07:00'); // quá đệm 60 giây
    const h = { ...JSON_CT, ...tok(editToken), ...deviceHeaders(dev) };
    const e = await t.app.inject({ method: 'PUT', url: `/api/messages/${messageId}`, headers: h, payload: body(1) });
    expect(e.statusCode).toBe(403);
    expect(e.json().error.code).toBe('blocked');
    const d = await t.app.inject({ method: 'DELETE', url: `/api/messages/${messageId}`, headers: { ...tok(editToken), ...deviceHeaders(dev) } });
    expect(d.statusCode).toBe(403);
    expect(d.json().error.code).toBe('blocked');
  });

  it('token sai/thiếu: 403 bad_token; không có: 404', async () => {
    const { id } = await setup();
    const { messageId } = (await post(id, body(1))).json();
    expect((await edit(messageId, 'sai', body(1))).json().error.code).toBe('bad_token');
    expect((await edit(messageId, undefined, body(1))).json().error.code).toBe('bad_token');
    expect((await del(messageId, 'sai')).json().error.code).toBe('bad_token');
    expect((await del('999999', 'sai')).statusCode).toBe(404);
  });

  it('đã mở: 403 already_opened', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1))).json();
    await t.h.db.update(messages).set({ readAt: new Date() }).where(eq(messages.id, Number(messageId)));
    expect((await edit(messageId, editToken, { ornament: ORN, anonymous: true, content: 'a' })).json().error.code).toBe('already_opened');
    expect((await del(messageId, editToken)).json().error.code).toBe('already_opened');
  });

  it('gỡ trong hạn: 204, slot trống lại', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(4))).json();
    const r = await del(messageId, editToken);
    expect(r.statusCode).toBe(204);
    const pub = await t.app.inject({ method: 'GET', url: `/api/trees/${id}` });
    expect(pub.json().slots[4]).toEqual({ index: 4, occupied: false });
    expect((await post(id, body(4))).statusCode).toBe(201);
  });

  it('sửa/gỡ khi đã khoá ghi: 403 write_closed', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1))).json();
    t.clock.set('2026-12-26T01:00:00+07:00');
    expect((await edit(messageId, editToken, body(1))).json().error.code).toBe('write_closed');
    expect((await del(messageId, editToken)).json().error.code).toBe('write_closed');
  });
});
