import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { adminLogin, makeTestApp, ADMIN_ENV } from './helpers.js';
import { adminAudit, messages, reports, trees } from '../src/db/schema.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };
const at = new Date('2026-12-01T03:00:00Z');

/** Cây + 1 lời nhắn có ảnh + báo cáo của chủ cây (có bản chụp ảnh) + báo cáo cả phòng của khách. */
async function seed() {
  const db = t.h.db;
  await db.insert(trees).values({ id: 'aaaaaaaa', ownerName: 'Chủ', privateKeyHash: 'x', pinHash: 'x' });
  const [m] = await db.insert(messages).values({
    treeId: 'aaaaaaaa', slotIndex: 0, ornament: 'bell', isAnonymous: false, authorName: 'Tên người viết',
    content: 'lời nhắn xấu', editTokenHash: 'h', editUntil: at, deviceHash: 'd', createdAt: at, updatedAt: at,
    photoKey: 'm/aaaaaaaa/1-x.webp', photoBytes: 3,
  }).returning({ id: messages.id });
  await t.photos.put('m/aaaaaaaa/1-x.webp', Buffer.from('abc'));
  const [r1] = await db.insert(reports).values({
    treeId: 'aaaaaaaa', messageId: m!.id, messageSnapshot: 'lời nhắn xấu', reason: 'thô tục', reporter: 'owner', photoSnapshotKey: 'r/1.webp',
  }).returning({ id: reports.id });
  await t.photos.put('r/1.webp', Buffer.from('snap'));
  const [r2] = await db.insert(reports).values({ treeId: 'aaaaaaaa', reporter: 'guest', reason: 'phòng xấu', reporterHash: 'g' }).returning({ id: reports.id });
  return { mid: m!.id, ownerReport: String(r1!.id), guestReport: String(r2!.id) };
}

const list = (cookie: string, status = 'open') =>
  t.app.inject({ url: `/api/admin/reports?status=${status}`, headers: { cookie } });
const resolve = (a: { cookie: string; csrf: string }, rid: string, payload: object, csrf = a.csrf) =>
  t.app.inject({ method: 'POST', url: `/api/admin/reports/${rid}/resolve`, headers: { ...JSON_CT, cookie: a.cookie, 'x-csrf-token': csrf }, payload });
const auditRows = () => t.h.db.select().from(adminAudit).where(eq(adminAudit.action, 'report_resolve'));

const ALLOWED = ['id', 'createdAt', 'reporter', 'reason', 'treeId', 'messageId', 'snapshot', 'hasPhoto', 'messageExists', 'status', 'resolution', 'handledAt', 'note'];

describe('GET /api/admin/reports', () => {
  it('liệt kê báo cáo mở, chỉ có bản chụp — không có nội dung nào khác của lời nhắn', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const s = await seed();
    const a = await adminLogin(t.app);
    const items = (await list(a.cookie)).json().items as Record<string, unknown>[];
    expect(items.map((i) => i.id).sort()).toEqual([s.ownerReport, s.guestReport].sort());
    for (const i of items) expect(Object.keys(i).sort()).toEqual([...ALLOWED].sort());
    const o = items.find((i) => i.id === s.ownerReport)!;
    expect(o).toMatchObject({ reporter: 'owner', snapshot: 'lời nhắn xấu', hasPhoto: true, messageExists: true, messageId: String(s.mid), treeId: 'aaaaaaaa' });
    expect(JSON.stringify(items)).not.toContain('Tên người viết');
    const g = items.find((i) => i.id === s.guestReport)!;
    expect(g).toMatchObject({ reporter: 'guest', messageId: null, snapshot: null, hasPhoto: false });
  });

  it('không có phiên → 401; status không hợp lệ → 400', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    expect((await t.app.inject('/api/admin/reports')).statusCode).toBe(401);
    const a = await adminLogin(t.app);
    expect((await list(a.cookie, 'xyz')).statusCode).toBe(400);
  });

  it('ảnh bản chụp: đọc bằng phiên quản trị, không cache; không phiên → 401; không có ảnh → 404', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const s = await seed();
    expect((await t.app.inject(`/api/admin/reports/${s.ownerReport}/photo`)).statusCode).toBe(401);
    const a = await adminLogin(t.app);
    const r = await t.app.inject({ url: `/api/admin/reports/${s.ownerReport}/photo`, headers: { cookie: a.cookie } });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/webp');
    expect(r.headers['cache-control']).toBe('private, no-store');
    expect(r.body).toBe('snap');
    expect((await t.app.inject({ url: `/api/admin/reports/${s.guestReport}/photo`, headers: { cookie: a.cookie } })).statusCode).toBe(404);
  });
});

describe('POST /api/admin/reports/:rid/resolve', () => {
  it('delete_message: xoá lời nhắn + ảnh, giữ bản chụp, báo cáo resolved, có audit; lần hai → 409', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const s = await seed();
    const a = await adminLogin(t.app);
    expect((await resolve(a, s.ownerReport, { action: 'delete_message', note: 'vi phạm' })).statusCode).toBe(200);
    expect(await t.h.db.select().from(messages)).toHaveLength(0);
    expect(t.photos.keys()).toEqual(['r/1.webp']);
    const [r] = await t.h.db.select().from(reports).where(eq(reports.id, Number(s.ownerReport)));
    expect(r).toMatchObject({ status: 'resolved', resolution: 'message_deleted' });
    expect(r!.handledBy).not.toBeNull();
    expect(r!.handledAt).not.toBeNull();
    expect((await auditRows()).map((x) => x.note)).toEqual(['delete_message: vi phạm']);
    const again = await resolve(a, s.ownerReport, { action: 'dismiss', note: 'x' });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('already_handled');
    expect(await auditRows()).toHaveLength(1);
    const handled = (await list(a.cookie, 'handled')).json().items;
    expect(handled[0]).toMatchObject({ id: s.ownerReport, status: 'resolved', note: 'delete_message: vi phạm', messageExists: false });
  });

  it('delete_message khi lời nhắn đã bị xoá → 409 message_gone; báo cáo cả phòng → 400 no_message', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const s = await seed();
    await t.h.db.delete(messages);
    const a = await adminLogin(t.app);
    expect((await resolve(a, s.ownerReport, { action: 'delete_message', note: 'x' })).json().error.code).toBe('message_gone');
    expect((await resolve(a, s.guestReport, { action: 'delete_message', note: 'x' })).json().error.code).toBe('no_message');
    expect(await auditRows()).toHaveLength(0);
  });

  it('delete_tree: cây, báo cáo, mọi ảnh và bản chụp bị xoá; audit tree_delete ghi mã báo cáo', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const s = await seed();
    const a = await adminLogin(t.app);
    expect((await resolve(a, s.guestReport, { action: 'delete_tree', note: 'phòng vi phạm' })).statusCode).toBe(200);
    expect(await t.h.db.select().from(trees)).toHaveLength(0);
    expect(await t.h.db.select().from(reports)).toHaveLength(0);
    expect(t.photos.keys()).toEqual([]);
    const rows = await t.h.db.select().from(adminAudit).where(eq(adminAudit.action, 'tree_delete'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetType: 'tree', targetId: 'aaaaaaaa', note: `báo cáo #${s.guestReport}: phòng vi phạm` });
  });

  it('dismiss: dismissed / no_action; ghi chú trống hoặc thiếu CSRF bị từ chối; báo cáo không có → 404', async () => {
    t = await makeTestApp({ env: ADMIN_ENV });
    const s = await seed();
    const a = await adminLogin(t.app);
    expect((await resolve(a, s.guestReport, { action: 'dismiss', note: '   ' })).statusCode).toBe(400);
    expect((await resolve(a, s.guestReport, { action: 'dismiss', note: 'x' }, 'sai')).statusCode).toBe(403);
    expect((await resolve(a, '999999', { action: 'dismiss', note: 'x' })).statusCode).toBe(404);
    expect((await resolve(a, s.guestReport, { action: 'dismiss', note: 'không sao' })).statusCode).toBe(200);
    const [r] = await t.h.db.select().from(reports).where(eq(reports.id, Number(s.guestReport)));
    expect(r).toMatchObject({ status: 'dismissed', resolution: 'no_action' });
    expect(await t.h.db.select().from(trees)).toHaveLength(1);
  });
});
