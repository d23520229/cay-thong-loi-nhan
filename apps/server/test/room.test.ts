import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { catalog } from '@ctln/shared';
import { deviceHeaders, makeTestApp } from './helpers.js';
import { messages, ownerSessions, rateCounters, roomItems, trees } from '../src/db/schema.js';
import { runMigrations } from '../src/db/migrate.js';
import { connectPglite } from '../src/db/client.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const room = () => ({
  ...structuredClone(catalog.defaultRoom),
  items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })),
});
const NEW_ITEM = { clientId: 'n1', type: 'gift', variant: 'gold', x: 400, y: 1000, scale: 1, flip: false };

async function create(name = 'Lan') {
  const r = await t.app.inject({
    method: 'POST', url: '/api/trees', headers: JSON_CT,
    payload: { ownerName: name, title: 'Cây', recovery: { type: 'pin', pin: '123456' }, room: room() },
  });
  const id = r.json().id as string;
  const token = /ctln_owner_[a-z2-9]+=([^;]+)/.exec(String(r.headers['set-cookie']))![1]!;
  return { id, token, cookies: { [`ctln_owner_${id}`]: token } };
}
async function setup() {
  t = await makeTestApp();
  return create();
}
const put = (id: string, cookies: Record<string, string> | undefined, roomVersion: number, rm: unknown) =>
  t.app.inject({ method: 'PUT', url: `/api/trees/${id}/room`, headers: JSON_CT, cookies, payload: { roomVersion, room: rm } as object });
const getOwner = (id: string, cookies?: Record<string, string>) =>
  t.app.inject({ method: 'GET', url: `/api/trees/${id}/owner`, cookies });
const visit = (id: string, cookies?: Record<string, string>) =>
  t.app.inject({ method: 'POST', url: `/api/trees/${id}/owner/visit`, cookies });
const putSettings = (id: string, cookies: Record<string, string> | undefined, v: unknown) =>
  t.app.inject({ method: 'PUT', url: `/api/trees/${id}/settings`, headers: JSON_CT, cookies, payload: { showMessageCount: v } });

async function addMsg(id: string, slot: number, createdAt?: Date, anon = false) {
  await t.h.db.insert(messages).values({
    treeId: id, slotIndex: slot, ornament: Object.keys(catalog.ornaments)[0]!, isAnonymous: anon,
    authorName: anon ? null : 'Bạn', content: 'bí mật', editTokenHash: 'x', editUntil: new Date(), deviceHash: 'd',
    ...(createdAt ? { createdAt } : {}),
  });
}

describe('updated_at của cây', () => {
  it('updated_at của cây chỉ đổi khi lưu phòng: PIN sai, ghé thăm (owner/visit) không đổi; lưu phòng đặt = giờ giả', async () => {
    const { id, cookies } = await setup();
    const get = async () => (await t.h.db.select().from(trees).where(eq(trees.id, id)))[0]!.updatedAt;
    const before = await get();
    t.clock.set('2026-12-01T10:05:00+07:00');
    const bad = await t.app.inject({ method: 'POST', url: `/api/trees/${id}/auth/pin`, headers: JSON_CT, payload: { pin: '000000' } });
    expect(bad.statusCode).toBe(401);
    expect((await visit(id, cookies)).statusCode).toBe(204);
    expect((await putSettings(id, cookies, false)).statusCode).toBe(200);
    expect(await get()).toEqual(before);
    expect((await put(id, cookies, 1, room())).statusCode).toBe(200);
    expect((await get()).toISOString()).toBe('2026-12-01T03:05:00.000Z');
  });
});

describe('PUT /api/trees/:id/room', () => {
  it('401 không cookie; lưu được, tăng version, bỏ/thêm món', async () => {
    const { id, cookies } = await setup();
    const base = room();
    expect((await put(id, undefined, 1, base)).statusCode).toBe(401);
    const next = { ...base, items: [...base.items.slice(1), NEW_ITEM] };
    const dropped = base.items[0]!.clientId;
    const r = await put(id, cookies, 1, next);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ roomVersion: 2 });
    const rows = await t.h.db.select().from(roomItems).where(eq(roomItems.treeId, id));
    const ids = rows.map((x) => x.clientId);
    expect(ids).toContain('n1');
    expect(ids).not.toContain(dropped);
    expect(rows).toHaveLength(7);
  });

  it('dùng lại clientId của cây cho món khác loại (cây ↔ quà) vẫn lưu được, không 500', async () => {
    const { id, cookies } = await setup();
    const base = room();
    const tree = base.items.find((i: { type: string }) => i.type === 'tree')!;
    // Cây mới mang mã mới, mã cũ của cây giờ là một hộp quà.
    const next = {
      ...base,
      items: [
        ...base.items.filter((i: { type: string }) => i.type !== 'tree'),
        { ...tree, clientId: 'newtree' },
        { ...NEW_ITEM, clientId: tree.clientId },
      ],
    };
    const r = await put(id, cookies, 1, next);
    expect(r.statusCode).toBe(200);
    const rows = await t.h.db.select().from(roomItems).where(eq(roomItems.treeId, id));
    expect(rows.find((x) => x.clientId === tree.clientId)?.itemType).toBe('gift');
    expect(rows.find((x) => x.clientId === 'newtree')?.itemType).toBe('tree');
    // Và ngược lại: quà quay về làm cây.
    const back = await put(id, cookies, 2, base);
    expect(back.statusCode).toBe(200);
    const rows2 = await t.h.db.select().from(roomItems).where(eq(roomItems.treeId, id));
    expect(rows2.find((x) => x.clientId === tree.clientId)?.itemType).toBe('tree');
    expect(rows2.some((x) => x.clientId === 'newtree')).toBe(false);
  });

  it('409 version_conflict kèm room mới (error.room)', async () => {
    const { id, cookies } = await setup();
    await put(id, cookies, 1, room());
    const r = await put(id, cookies, 1, room());
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('version_conflict');
    expect(r.json().error.message).toBe('Phòng vừa được sửa ở thiết bị khác.');
    expect(r.json().error.room.roomVersion).toBe(2);
    expect(r.json().error.room.phase).toBe('BUILD');
  });

  it('slots_in_use khi giảm số điểm dưới lời nhắn; tăng lên thì được', async () => {
    const { id, cookies } = await setup();
    await t.h.db.update(trees).set({ slotCount: 16 }).where(eq(trees.id, id));
    await addMsg(id, 10);
    const small = { ...room(), tree: { ...room().tree, slotCount: 9 } };
    const r1 = await put(id, cookies, 1, small);
    expect(r1.statusCode).toBe(409);
    expect(r1.json().error.code).toBe('slots_in_use');
    const big = { ...room(), tree: { ...room().tree, slotCount: 16 } };
    expect((await put(id, cookies, 1, big)).statusCode).toBe(200);
  });

  it('400 wall_only: window ở y 900', async () => {
    const { id, cookies } = await setup();
    const rm = room();
    rm.items = [
      ...rm.items.filter((i: { type: string }) => i.type !== 'window'),
      { clientId: 'w1', type: 'window', variant: Object.keys(catalog.items.window.variants)[0]!, x: 300, y: 900, scale: 1, flip: false },
    ];
    const r = await put(id, cookies, 1, rm);
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('wall_only');
  });

  it('lưu được đến 23:59:59 ngày 25/12, từ 26/12 thì 403', async () => {
    const { id, cookies } = await setup();
    t.clock.set('2026-12-25T23:59:59+07:00');
    expect((await put(id, cookies, 1, room())).statusCode).toBe(200);
    t.clock.set('2026-12-26T00:00:00+07:00');
    const r = await put(id, cookies, 2, room());
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('write_closed');
  });

  it('lần lưu thứ 601 trong giờ → 429', async () => {
    const { id, cookies } = await setup();
    const at = t.app.deps.now().getTime();
    // Dựng sẵn 598 lần đã lưu trong giờ này thay vì gửi 598 request.
    await t.h.db.insert(rateCounters).values({
      bucket: 'save:tree:' + id, windowStart: new Date(Math.floor(at / 3600_000) * 3600_000), hits: 598,
    });
    expect((await put(id, cookies, 1, room())).statusCode).toBe(200);
    expect((await put(id, cookies, 2, room())).statusCode).toBe(200);
    expect((await put(id, cookies, 3, room())).statusCode).toBe(429);
  });
});

describe('DELETE /api/trees/:id', () => {
  it('401 không cookie; 204 xoá sạch và xoá cookie', async () => {
    const { id, cookies } = await setup();
    await addMsg(id, 0);
    expect((await t.app.inject({ method: 'DELETE', url: `/api/trees/${id}` })).statusCode).toBe(401);
    const r = await t.app.inject({ method: 'DELETE', url: `/api/trees/${id}`, cookies });
    expect(r.statusCode).toBe(204);
    expect(String(r.headers['set-cookie'])).toMatch(new RegExp(`ctln_owner_${id}=;`));
    expect((await t.app.inject({ method: 'GET', url: `/api/trees/${id}` })).statusCode).toBe(404);
    expect(await t.h.db.select().from(messages).where(eq(messages.treeId, id))).toHaveLength(0);
    expect(await t.h.db.select().from(roomItems).where(eq(roomItems.treeId, id))).toHaveLength(0);
  });
});

describe('DELETE /api/trees/:id — ảnh', () => {
  it('xoá cây → không còn khoá ảnh của cây đó; cây khác giữ nguyên; delete ném lỗi vẫn 204', async () => {
    const a = await setup();
    const b = await create('Mai');
    await addMsg(a.id, 0);
    await addMsg(a.id, 1);
    await addMsg(b.id, 0);
    const rows = await t.h.db.select({ id: messages.id, treeId: messages.treeId }).from(messages);
    for (const m of rows) {
      const k = `m/${m.treeId}/${m.id}-x.webp`;
      await t.photos.put(k, Buffer.from('w'));
      await t.h.db.update(messages).set({ photoKey: k }).where(eq(messages.id, m.id));
    }
    const bKey = `m/${b.id}/${rows.find((m) => m.treeId === b.id)!.id}-x.webp`;
    expect(t.photos.keys()).toHaveLength(3);
    expect((await t.app.inject({ method: 'DELETE', url: `/api/trees/${a.id}`, cookies: a.cookies })).statusCode).toBe(204);
    expect(t.photos.keys()).toEqual([bKey]);
    t.photos.delete = async () => { throw Object.assign(new Error('blob hỏng'), { code: 'EIO' }); };
    expect((await t.app.inject({ method: 'DELETE', url: `/api/trees/${b.id}`, cookies: b.cookies })).statusCode).toBe(204);
  });
});

describe('GET /api/trees/:id/owner', () => {
  it('BUILD: slot có lời nhắn có messageId, locked, không có content', async () => {
    const { id, cookies } = await setup();
    await addMsg(id, 2);
    const r = await getOwner(id, cookies);
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.phase).toBe('BUILD');
    const s = j.slots.find((x: { index: number }) => x.index === 2);
    expect(s.occupied).toBe(true);
    expect(typeof s.messageId).toBe('string');
    expect(s.locked).toBe(true);
    expect(s.content).toBeUndefined();
    expect(JSON.stringify(j)).not.toContain('bí mật');
  });

  it('O10: showMessageCount mặc định true; đếm mới từ lần xem trước', async () => {
    const { id, cookies } = await setup();
    const first = (await getOwner(id, cookies)).json();
    expect(first).toMatchObject({ showMessageCount: true, messageCount: 0, newSinceLastVisit: 0 });
    await t.h.db.update(trees).set({ lastOwnerVisitAt: null }).where(eq(trees.id, id));
    await addMsg(id, 0, new Date('2026-12-01T02:30:00Z'));
    await addMsg(id, 1, new Date('2026-12-01T02:31:00Z'), true);
    expect((await getOwner(id, cookies)).json()).toMatchObject({ messageCount: 2, newSinceLastVisit: 2 });
    expect((await getOwner(id, cookies)).json()).toMatchObject({ messageCount: 2, newSinceLastVisit: 2 });
    expect((await visit(id, cookies)).statusCode).toBe(204);
    expect((await getOwner(id, cookies)).json()).toMatchObject({ messageCount: 2, newSinceLastVisit: 0 });
    t.clock.set('2026-12-01T11:00:00+07:00');
    await addMsg(id, 2, new Date('2026-12-01T11:00:00+07:00'));
    t.clock.set('2026-12-01T11:05:00+07:00');
    expect((await getOwner(id, cookies)).json()).toMatchObject({ messageCount: 3, newSinceLastVisit: 1 });
  });

  it('O10: lời nhắn treo qua API được tính "mới" theo đồng hồ app (FAKE_NOW), không theo giờ CSDL', async () => {
    t = await makeTestApp({ at: '2026-12-10T10:00:00+07:00' });
    const { id, cookies } = await create();
    expect((await visit(id, cookies)).statusCode).toBe(204);
    t.clock.set('2026-12-10T11:00:00+07:00');
    const m = await t.app.inject({
      method: 'POST', url: `/api/trees/${id}/messages`, headers: { ...JSON_CT, ...deviceHeaders() },
      payload: { slotIndex: 0, ornament: Object.keys(catalog.ornaments)[0], anonymous: true, content: 'chào' },
    });
    expect(m.statusCode).toBe(201);
    expect((await getOwner(id, cookies)).json()).toMatchObject({ messageCount: 1, newSinceLastVisit: 1 });
    const [row] = await t.h.db.select().from(messages).where(eq(messages.treeId, id));
    expect(row!.createdAt.toISOString()).toBe('2026-12-10T04:00:00.000Z');
  });

  it('POST /owner/visit: 401 không cookie; 204 và ghi last_owner_visit_at = now', async () => {
    const { id, cookies } = await setup();
    expect((await visit(id)).statusCode).toBe(401);
    t.clock.set('2026-12-01T11:00:00+07:00');
    const r = await visit(id, cookies);
    expect(r.statusCode).toBe(204);
    expect(r.body).toBe('');
    const [row] = await t.h.db.select().from(trees).where(eq(trees.id, id));
    expect(row!.lastOwnerVisitAt).toEqual(new Date('2026-12-01T11:00:00+07:00'));
  });

  it('401: cookie của cây khác, không cookie, hết hạn, bị thu hồi', async () => {
    const A = await setup();
    const B = await create('B');
    expect((await getOwner(B.id, { [`ctln_owner_${B.id}`]: A.token })).statusCode).toBe(401);
    expect((await getOwner(A.id)).statusCode).toBe(401);
    expect((await getOwner(A.id, A.cookies)).statusCode).toBe(200);
    await t.h.db.update(ownerSessions).set({ expiresAt: new Date('2026-12-01T09:00:00+07:00') }).where(eq(ownerSessions.treeId, A.id));
    expect((await getOwner(A.id, A.cookies)).statusCode).toBe(401);
    await t.h.db.update(ownerSessions).set({ expiresAt: new Date('2027-01-07T00:00:00+07:00') }).where(eq(ownerSessions.treeId, A.id));
    expect((await getOwner(A.id, A.cookies)).statusCode).toBe(200);
    await t.h.db.update(ownerSessions).set({ revokedAt: new Date() }).where(eq(ownerSessions.treeId, A.id));
    expect((await getOwner(A.id, A.cookies)).statusCode).toBe(401);
  });
});

describe('PUT /api/trees/:id/settings', () => {
  it('401 không cookie; đổi được, không đổi room_version; NOTICE vẫn 200', async () => {
    const { id, cookies } = await setup();
    expect((await putSettings(id, undefined, false)).statusCode).toBe(401);
    const r = await putSettings(id, cookies, false);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ showMessageCount: false });
    expect((await getOwner(id, cookies)).json().showMessageCount).toBe(false);
    const [row] = await t.h.db.select().from(trees).where(eq(trees.id, id));
    expect(row!.roomVersion).toBe(1);
    t.clock.set('2026-12-26T12:00:00+07:00');
    expect((await putSettings(id, cookies, true)).statusCode).toBe(200);
  });

  it('400 khi body sai', async () => {
    const { id, cookies } = await setup();
    expect((await putSettings(id, cookies, 'x')).statusCode).toBe(400);
  });
});

describe('migration 0001', () => {
  it('trả đúng 0001 trên DB đã có 0000', async () => {
    t = await makeTestApp();
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));
    copyFileSync(fileURLToPath(new URL('../src/db/migrations/0000_init.sql', import.meta.url)), join(dir, '0000_init.sql'));
    const h = await connectPglite();
    expect(await runMigrations(h, dir)).toEqual(['0000_init.sql']);
    expect(await runMigrations(h)).toEqual(['0001_show_message_count.sql', '0002_pin_failed_at.sql', '0003_pin_rate_counters.sql', '0004_card_photo.sql']);
    await h.close();
  });
});
