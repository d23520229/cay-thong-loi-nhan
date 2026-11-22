import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import sharp from 'sharp';
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

  it('400 ký tự treo được, 401 → 400 invalid_body, 9 lần xuống dòng → 400', async () => {
    const { id } = await setup();
    const ok = await post(id, body(0, { content: '🎄'.repeat(400) }));
    expect(ok.statusCode).toBe(201);
    const long = await post(id, body(1, { content: '🎄'.repeat(401) }));
    expect(long.statusCode).toBe(400);
    expect(long.json().error.code).toBe('invalid_body');
    const lines = await post(id, body(2, { content: 'a\n'.repeat(9) + 'b' }));
    expect(lines.statusCode).toBe(400);
    expect(lines.json().error.code).toBe('invalid_body');
    expect((await post(id, body(3, { content: 'a\n'.repeat(8) + 'b' }))).statusCode).toBe(201);
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
      content: 'Chúc mừng Giáng sinh', editUntil, hasPhoto: false,
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

// Ảnh thật nhỏ (JPEG 8×8) để server giải mã bằng sharp.
let JPEG = '';
beforeAll(async () => {
  JPEG = (await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } }).jpeg().toBuffer()).toString('base64');
});
const photoGet = (mid: string, token?: string) =>
  t.app.inject({ method: 'GET', url: `/api/messages/${mid}/photo`, headers: tok(token) });
const keyOf = async (mid: string) =>
  (await t.h.db.select({ k: messages.photoKey }).from(messages).where(eq(messages.id, Number(mid))))[0]?.k ?? null;

describe('Lời nhắn kèm ảnh', () => {
  it('treo kèm ảnh → 201, photo_key có, đúng 1 khoá m/{treeId}/{id}-…webp', async () => {
    const { id } = await setup();
    const r = await post(id, body(0, { photo: JPEG }));
    expect(r.statusCode).toBe(201);
    const mid = r.json().messageId as string;
    const key = await keyOf(mid);
    expect(key).toMatch(new RegExp(`^m/${id}/${mid}-[A-Za-z0-9_-]+\\.webp$`));
    expect(t.photos.keys()).toEqual([key]);
    expect((await mine(mid, r.json().editToken)).json().hasPhoto).toBe(true);
  });

  it('treo không ảnh → hasPhoto false, không có khoá', async () => {
    const { id } = await setup();
    const r = await post(id, body(0));
    expect((await mine(r.json().messageId, r.json().editToken)).json().hasPhoto).toBe(false);
    expect(t.photos.keys()).toEqual([]);
  });

  it('treo kèm ảnh mà slot_taken → 409, không còn khoá', async () => {
    const { id } = await setup();
    expect((await post(id, body(3), deviceHeaders())).statusCode).toBe(201);
    const r = await post(id, body(3, { photo: JPEG }), deviceHeaders());
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('slot_taken');
    expect(t.photos.keys()).toEqual([]);
  });

  it('treo kèm ảnh mà device_limit → 409, không còn khoá', async () => {
    const { id } = await setup();
    const h = deviceHeaders();
    for (const s of [0, 1, 2]) expect((await post(id, body(s), h)).statusCode).toBe(201);
    const r = await post(id, body(5, { photo: JPEG }), h);
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('device_limit');
    expect(t.photos.keys()).toEqual([]);
  });

  it('lưu ảnh lỗi → 500, giao dịch lỗi, không có dòng nào', async () => {
    const { id } = await setup();
    t.photos.put = async () => { throw new Error('blob hỏng'); };
    const r = await post(id, body(0, { photo: JPEG }));
    expect(r.statusCode).toBe(500);
    expect(await count()).toBe(0);
  });

  it('ảnh hỏng → 400 bad_photo, không có dòng nào', async () => {
    const { id } = await setup();
    const r = await post(id, body(0, { photo: Buffer.from('không phải ảnh').toString('base64') }));
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('bad_photo');
    expect(await count()).toBe(0);
    expect(t.photos.keys()).toEqual([]);
  });

  it('body > 4,5 MB → 413 body_too_large; ~4,1 MB vẫn qua giới hạn route', async () => {
    const { id } = await setup();
    const big = await post(id, body(0, { photo: 'A'.repeat(4_800_000) }));
    expect(big.statusCode).toBe(413);
    expect(big.json().error.code).toBe('body_too_large');
    // Qua bodyLimit, tới bước kiểm ảnh → 400 bad_photo (không phải 413).
    const ok = await post(id, body(0, { photo: 'A'.repeat(4_100_000) }));
    expect(ok.statusCode).toBe(400);
    expect(ok.json().error.code).toBe('bad_photo');
  });

  it('route khác vẫn giới hạn 64 KB', async () => {
    t = await makeTestApp();
    const r = await t.app.inject({
      method: 'POST', url: '/api/trees', headers: JSON_CT,
      payload: { ownerName: 'Lan', title: 'x'.repeat(70_000), recovery: { type: 'pin', pin: '123456' }, room: room() },
    });
    expect(r.statusCode).toBe(413);
    expect(r.json().error.code).toBe('body_too_large');
  });

  it('honeypot kèm ảnh → 201 giả, không có khoá', async () => {
    const { id } = await setup();
    const r = await post(id, body(0, { website: 'http://spam', photo: JPEG }));
    expect(r.statusCode).toBe(201);
    expect(await count()).toBe(0);
    expect(t.photos.keys()).toEqual([]);
  });

  it('photo:ip vượt 30/giờ → 429; lời nhắn không ảnh không bị đếm', async () => {
    const { id } = await setup();
    const { loadEnv } = await import('../src/env.js');
    const at = new Date('2026-12-01T10:00:00+07:00');
    await t.h.db.insert(rateCounters).values({
      bucket: 'photo:ip:' + ipHash(loadEnv({}), '127.0.0.1', at),
      windowStart: new Date(Math.floor(at.getTime() / 3600_000) * 3600_000),
      hits: 29,
    });
    expect((await post(id, body(0, { photo: JPEG }))).statusCode).toBe(201);
    const r = await post(id, body(1, { photo: JPEG }));
    expect(r.statusCode).toBe(429);
    expect(r.json().error.code).toBe('rate_limited');
    expect((await post(id, body(1))).statusCode).toBe(201);
    expect(t.photos.keys()).toHaveLength(1);
  });

  it('PUT thay ảnh → khoá cũ bị xoá, khoá mới có; không gửi photo → giữ; photo:null → không còn khoá', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1, { photo: JPEG }))).json();
    const old = await keyOf(messageId);
    expect((await edit(messageId, editToken, body(1, { photo: JPEG }))).statusCode).toBe(200);
    const now = await keyOf(messageId);
    expect(now).toBeTruthy();
    expect(now).not.toBe(old);
    expect(t.photos.keys()).toEqual([now]);
    expect((await edit(messageId, editToken, body(1, { content: 'chữ mới' }))).statusCode).toBe(200);
    expect(await keyOf(messageId)).toBe(now);
    expect(t.photos.keys()).toEqual([now]);
    expect((await edit(messageId, editToken, body(1, { photo: null }))).statusCode).toBe(200);
    expect(await keyOf(messageId)).toBeNull();
    expect(t.photos.keys()).toEqual([]);
    expect((await mine(messageId, editToken)).json().hasPhoto).toBe(false);
  });

  it('PUT thêm ảnh cho lời nhắn chưa có ảnh', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1))).json();
    expect((await edit(messageId, editToken, body(1, { photo: JPEG }))).statusCode).toBe(200);
    const key = await keyOf(messageId);
    expect(key).toBeTruthy();
    expect(t.photos.keys()).toEqual([key]);
  });

  it('PUT sai token / hết 15 phút / đã mở kèm ảnh → lỗi như cũ, không sót khoá mới', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1, { photo: JPEG }))).json();
    const old = await keyOf(messageId);
    expect((await edit(messageId, 'sai', body(1, { photo: JPEG }))).json().error.code).toBe('bad_token');
    expect((await edit('999999', 'sai', body(1, { photo: JPEG }))).statusCode).toBe(404);
    expect((await edit(messageId, 'sai', body(1, { photo: null }))).json().error.code).toBe('bad_token');
    expect(t.photos.keys()).toEqual([old]);
    t.clock.set('2026-12-01T10:15:01+07:00');
    expect((await edit(messageId, editToken, body(1, { photo: JPEG }))).json().error.code).toBe('edit_expired');
    expect(t.photos.keys()).toEqual([old]);
    t.clock.set('2026-12-01T10:05:00+07:00');
    await t.h.db.update(messages).set({ readAt: new Date() }).where(eq(messages.id, Number(messageId)));
    expect((await edit(messageId, editToken, body(1, { photo: JPEG }))).json().error.code).toBe('already_opened');
    expect(t.photos.keys()).toEqual([old]);
    expect(await keyOf(messageId)).toBe(old);
  });

  it('PUT sai token kèm ảnh hỏng → 403 bad_token (không giải mã ảnh), không đếm photo:ip', async () => {
    const { id } = await setup();
    const { messageId } = (await post(id, body(1))).json();
    const r = await edit(messageId, 'sai', body(1, { photo: 'aGVsbG8=' }));
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('bad_token');
    expect((await edit('999999', 'sai', body(1, { photo: 'aGVsbG8=' }))).statusCode).toBe(404);
    const rows = await t.h.db.select().from(rateCounters);
    expect(rows.filter((x) => x.bucket.startsWith('photo:ip:'))).toEqual([]);
  });

  it('PUT kèm ảnh vượt 30/giờ → 429; PUT photo:null không bị đếm', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1))).json();
    const { loadEnv } = await import('../src/env.js');
    const at = new Date('2026-12-01T10:00:00+07:00');
    const bucket = 'photo:ip:' + ipHash(loadEnv({}), '127.0.0.1', at);
    await t.h.db.insert(rateCounters).values({
      bucket, windowStart: new Date(Math.floor(at.getTime() / 3600_000) * 3600_000), hits: 29,
    });
    expect((await edit(messageId, editToken, body(1, { photo: JPEG }))).statusCode).toBe(200);
    const r = await edit(messageId, editToken, body(1, { photo: JPEG }));
    expect(r.statusCode).toBe(429);
    expect(r.json().error.code).toBe('rate_limited');
    const hits = async () => (await t.h.db.select().from(rateCounters).where(eq(rateCounters.bucket, bucket)))[0]!.hits;
    const before = await hits();
    expect((await edit(messageId, editToken, body(1, { photo: null }))).statusCode).toBe(200);
    expect(await hits()).toBe(before);
    expect(t.photos.keys()).toEqual([]);
  });

  it('POST: ảnh đã lưu rồi giao dịch lỗi → dọn khoá, không có dòng', async () => {
    const { id } = await setup();
    const orig = t.photos.put;
    t.photos.put = async (k, d) => { await orig(k, d); throw new Error('lỗi sau khi lưu'); };
    const r = await post(id, body(0, { photo: JPEG }));
    expect(r.statusCode).toBe(500);
    expect(t.photos.keys()).toEqual([]);
    expect(await count()).toBe(0);
  });

  it('PUT: ảnh mới đã lưu rồi giao dịch lỗi → dọn khoá mới, giữ ảnh cũ', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1, { photo: JPEG }))).json();
    const old = await keyOf(messageId);
    const orig = t.photos.put;
    t.photos.put = async (k, d) => { await orig(k, d); throw new Error('lỗi sau khi lưu'); };
    const r = await edit(messageId, editToken, body(1, { photo: JPEG, content: 'mới' }));
    expect(r.statusCode).toBe(500);
    expect(t.photos.keys()).toEqual([old]);
    expect(await keyOf(messageId)).toBe(old);
    expect((await mine(messageId, editToken)).json().content).toBe('Chúc mừng Giáng sinh');
  });

  it('PUT ảnh hỏng → 400 bad_photo, giữ ảnh cũ', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1, { photo: JPEG }))).json();
    const old = await keyOf(messageId);
    const r = await edit(messageId, editToken, body(1, { photo: 'aGVsbG8=' }));
    expect(r.json().error.code).toBe('bad_photo');
    expect(t.photos.keys()).toEqual([old]);
  });

  it('PUT body > 4,5 MB → 413', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1))).json();
    expect((await edit(messageId, editToken, body(1, { photo: 'A'.repeat(4_800_000) }))).statusCode).toBe(413);
  });

  it('GET /api/messages/:mid/photo: đúng token → image/webp + private, no-store; sai → 403; không ảnh → 404', async () => {
    const { id } = await setup();
    const a = (await post(id, body(1, { photo: JPEG }))).json();
    const r = await photoGet(a.messageId, a.editToken);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/webp');
    expect(r.headers['cache-control']).toBe('private, no-store');
    expect((await sharp(r.rawPayload).metadata()).format).toBe('webp');
    const bad = await photoGet(a.messageId, 'sai');
    expect(bad.statusCode).toBe(403);
    expect(bad.json().error.code).toBe('bad_token');
    expect((await photoGet(a.messageId)).statusCode).toBe(403);
    expect((await photoGet('999999', 'sai')).statusCode).toBe(404);
    const b = (await post(id, body(2))).json();
    const none = await photoGet(b.messageId, b.editToken);
    expect(none.statusCode).toBe(404);
  });
});

describe('Người viết xoá lời nhắn kèm ảnh', () => {
  it('xoá → 204, không còn khoá ảnh', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1, { photo: JPEG }))).json();
    expect(t.photos.keys()).toHaveLength(1);
    expect((await del(messageId, editToken)).statusCode).toBe(204);
    expect(t.photos.keys()).toEqual([]);
  });

  it('store.delete ném lỗi → vẫn 204', async () => {
    const { id } = await setup();
    const { messageId, editToken } = (await post(id, body(1, { photo: JPEG }))).json();
    t.photos.delete = async () => { throw Object.assign(new Error('blob hỏng'), { code: 'EIO' }); };
    expect((await del(messageId, editToken)).statusCode).toBe(204);
    expect(await count()).toBe(0);
  });
});
