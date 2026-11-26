import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { catalog } from '@ctln/shared';
import { makeTestApp } from './helpers.js';
import { ownerAccounts, roomItems, siteSettings, trees, messages } from '../src/db/schema.js';
import { makeGoogleVerifier } from '../src/google.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const room = () => ({
  ...structuredClone(catalog.defaultRoom),
  items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })),
});
const pinBody = () => ({ ownerName: 'Lan', title: 'Cây của Lan', recovery: { type: 'pin', pin: '123456' }, room: room() });
const googleBody = (tok = 'ok:sub-1') => ({ ownerName: 'Lan', recovery: { type: 'google', idToken: tok }, room: room() });
const create = (body: unknown) =>
  t.app.inject({ method: 'POST', url: '/api/trees', headers: JSON_CT, payload: body as object });

describe('POST /api/trees', () => {
  it('tạo bằng PIN', async () => {
    t = await makeTestApp();
    const r = await create(pinBody());
    expect(r.statusCode).toBe(201);
    const j = r.json();
    expect(j.id).toMatch(/^[a-z2-9]{8}$/);
    expect(j.publicUrl).toBe(`http://localhost:3000/c/${j.id}`);
    expect(j.privateUrl).toContain(`/c/${j.id}#k=`);
    expect(j.roomVersion).toBe(1);
    const sc = String(r.headers['set-cookie']);
    expect(sc).toContain(`ctln_owner_${j.id}=`);
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    const items = await t.h.db.select().from(roomItems).where(eq(roomItems.treeId, j.id));
    expect(items).toHaveLength(7);
    const [row] = await t.h.db.select().from(trees).where(eq(trees.id, j.id));
    expect(row!.pinHash).toMatch(/^scrypt\$/);
    expect(row!.title).toBe('Cây của Lan');
  });

  it('Google hai lần → hai phòng, một owner_accounts', async () => {
    t = await makeTestApp();
    const a = await create(googleBody());
    const b = await create(googleBody());
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(await t.h.db.select().from(ownerAccounts)).toHaveLength(1);
    const rows = await t.h.db.select().from(trees);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.ownerAccountId).toBe(rows[1]!.ownerAccountId);
    expect(rows[0]!.pinHash).toBeNull();
  });

  it('Google: không lưu tên hiển thị Google (chỉ mã người dùng — đặc tả 6.9.2)', async () => {
    t = await makeTestApp({ google: async () => ({ sub: 'sub-name', name: 'Tên Thật Google' }) });
    expect((await create(googleBody())).statusCode).toBe(201);
    const [acc] = await t.h.db.select().from(ownerAccounts);
    expect(acc!.googleSub).toBe('sub-name');
    expect(acc!.displayName).toBeNull();
  });

  it('token Google sai → 400 google_invalid', async () => {
    t = await makeTestApp();
    const r = await create(googleBody('bad'));
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('google_invalid');
  });

  it('google null → 503 google_unavailable', async () => {
    t = await makeTestApp({ google: null });
    const r = await create(googleBody());
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe('google_unavailable');
  });

  it('thiếu GOOGLE_CLIENT_ID → không có verifier', async () => {
    t = await makeTestApp();
    expect(makeGoogleVerifier()).toBeNull();
    expect(makeGoogleVerifier('abc.apps.googleusercontent.com')).toBeTypeOf('function');
  });

  it('lần thứ 21 cùng IP → 429', async () => {
    t = await makeTestApp();
    for (let i = 0; i < 20; i++) expect((await create(pinBody())).statusCode).toBe(201);
    const r = await create(pinBody());
    expect(r.statusCode).toBe(429);
    expect(r.json().error.code).toBe('rate_limited');
  });

  it('body sai không tốn lượt: 25 lần 400 rồi vẫn tạo được', async () => {
    t = await makeTestApp();
    for (let i = 0; i < 25; i++) expect((await create({ ...pinBody(), room: undefined })).statusCode).toBe(400);
    expect((await create(pinBody())).statusCode).toBe(201);
  });

  it('XFF giả ở đầu danh sách không đổi nhóm giới hạn (chỉ tin 1 bước proxy)', async () => {
    t = await makeTestApp();
    const post = (i: number) =>
      t.app.inject({
        method: 'POST', url: '/api/trees', headers: { ...JSON_CT, 'x-forwarded-for': `6.6.6.${i}, 9.9.9.9` },
        remoteAddress: '10.0.0.1', payload: pinBody() as object,
      });
    for (let i = 0; i < 20; i++) expect((await post(i)).statusCode).toBe(201);
    expect((await post(99)).statusCode).toBe(429);
  });

  it('write_closed ở NOTICE', async () => {
    t = await makeTestApp({ at: '2026-12-26T00:00:00+07:00' });
    const r = await create(pinBody());
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('write_closed');
  });

  it('pause_create → 503 paused', async () => {
    t = await makeTestApp();
    await t.h.db.insert(siteSettings).values({ key: 'pause_create', value: 'true' });
    const r = await create(pinBody());
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe('paused');
  });

  it('phòng sai → 400 với code của validateRoom', async () => {
    t = await makeTestApp();
    const b = pinBody();
    b.room.items = b.room.items.filter((i: { type: string }) => i.type !== 'tree');
    const r = await create(b);
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('tree_count');
  });

  it('body sai → 400 invalid_body', async () => {
    t = await makeTestApp();
    const r = await create({ ...pinBody(), recovery: { type: 'pin', pin: '12' } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('invalid_body');
  });

  it('ref tồn tại được lưu, không tồn tại thì bỏ qua', async () => {
    t = await makeTestApp();
    const first = (await create(pinBody())).json();
    const ok = (await create({ ...pinBody(), ref: first.id })).json();
    const missing = await create({ ...pinBody(), ref: 'zzzzzzzz' });
    expect(missing.statusCode).toBe(201);
    const [a] = await t.h.db.select().from(trees).where(eq(trees.id, ok.id));
    const [b] = await t.h.db.select().from(trees).where(eq(trees.id, missing.json().id));
    expect(a!.refTreeId).toBe(first.id);
    expect(b!.refTreeId).toBeNull();
  });
});

describe('GET /api/trees/:id', () => {
  it('công khai: 12 slot trống, không lộ nội dung/tên/băm', async () => {
    t = await makeTestApp();
    const { id } = (await create(pinBody())).json();
    const r = await t.app.inject(`/api/trees/${id}`);
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.slots).toHaveLength(12);
    expect(j.slots.every((s: { occupied: boolean }) => !s.occupied)).toBe(true);
    expect(j.items).toHaveLength(7);
    expect(j.phase).toBe('BUILD');
    expect(j.ownerName).toBe('Lan');
    expect(j.roomVersion).toBe(1);
    expect(r.body).not.toMatch(/content|authorName|pinHash|privateKeyHash|deviceHash|ipHash|creatorIp/i);
  });

  it('slot có lời nhắn chỉ lộ occupied + ornament', async () => {
    t = await makeTestApp();
    const { id } = (await create(pinBody())).json();
    await t.h.db.insert(messages).values({
      treeId: id, slotIndex: 3, ornament: 'star', content: 'bí mật', authorName: 'Ai đó',
      editTokenHash: 'x', editUntil: new Date(), deviceHash: 'd',
    });
    const r = await t.app.inject(`/api/trees/${id}`);
    const j = r.json();
    expect(j.slots[3]).toEqual({ index: 3, occupied: true, ornament: 'star' });
    expect(r.body).not.toContain('bí mật');
    expect(r.body).not.toContain('Ai đó');
  });

  it('không có → 404 not_found', async () => {
    t = await makeTestApp();
    const r = await t.app.inject('/api/trees/nope');
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toEqual({ code: 'not_found', message: 'Không tìm thấy cây này.' });
  });
});
