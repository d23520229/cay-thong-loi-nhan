import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { adminAudit, messages, reports, trees } from '../../db/schema.js';
import { HttpError } from '../../errors.js';
import { dropPhoto } from '../../photo.js';
import { audit } from '../../admin/audit.js';
import { requireAdmin } from '../../admin/session.js';
import { deleteTreeWithPhotos } from '../../trees/delete.js';

const ListQuery = z.object({ status: z.enum(['open', 'handled']).default('open') });
const ResolveBody = z.object({
  action: z.enum(['delete_message', 'delete_tree', 'dismiss']),
  note: z.string().trim().min(1).max(450),
});
const HANDLED_LIMIT = 50;

// Báo cáo mất khi phòng bị xoá (CASCADE), kể cả do tab khác vừa xoá phòng.
const notFound = () => new HttpError(404, 'not_found', 'Báo cáo không còn nữa (phòng có thể đã bị xoá).');
const parseRid = (v: string) => {
  if (!/^\d{1,15}$/.test(v)) throw notFound();
  return Number(v);
};

/** Hàng đợi báo cáo (đặc tả 6.8.4). Chỉ trả bản chụp — không đọc nội dung lời nhắn gốc. */
export async function adminReportsRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get('/api/admin/reports', async (req) => {
    await requireAdmin(app, req);
    const { status } = ListQuery.parse(req.query);
    const base = db.db
      .select({
        id: reports.id, createdAt: reports.createdAt, reporter: reports.reporter, reason: reports.reason,
        treeId: reports.treeId, messageId: reports.messageId, snapshot: reports.messageSnapshot,
        photoKey: reports.photoSnapshotKey, status: reports.status, resolution: reports.resolution,
        handledAt: reports.handledAt, liveMessage: messages.id,
      })
      .from(reports)
      .leftJoin(messages, eq(messages.id, reports.messageId));
    const rows = status === 'open'
      ? await base.where(eq(reports.status, 'open')).orderBy(desc(reports.createdAt), desc(reports.id))
      : await base.where(inArray(reports.status, ['resolved', 'dismissed'])).orderBy(desc(reports.handledAt), desc(reports.id)).limit(HANDLED_LIMIT);
    // Ghi chú của quản trị viên nằm ở nhật ký (target report), lấy dòng mới nhất cho mỗi báo cáo.
    const notes = new Map<string, string | null>();
    if (status === 'handled' && rows.length) {
      const ids = rows.map((r) => String(r.id));
      const logs = await db.db
        .select({ targetId: adminAudit.targetId, note: adminAudit.note })
        .from(adminAudit)
        .where(and(eq(adminAudit.targetType, 'report'), inArray(adminAudit.targetId, ids)))
        .orderBy(desc(adminAudit.id));
      for (const l of logs) if (l.targetId && !notes.has(l.targetId)) notes.set(l.targetId, l.note);
    }
    return {
      items: rows.map((r) => ({
        id: String(r.id),
        createdAt: r.createdAt.toISOString(),
        reporter: r.reporter,
        reason: r.reason,
        treeId: r.treeId,
        messageId: r.messageId === null ? null : String(r.messageId),
        snapshot: r.snapshot,
        hasPhoto: r.photoKey !== null,
        messageExists: r.liveMessage !== null,
        status: r.status,
        resolution: r.resolution,
        handledAt: r.handledAt ? r.handledAt.toISOString() : null,
        note: notes.get(String(r.id)) ?? null,
      })),
    };
  });

  app.get<{ Params: { rid: string } }>('/api/admin/reports/:rid/photo', async (req, reply) => {
    await requireAdmin(app, req);
    const [r] = await db.db.select({ k: reports.photoSnapshotKey }).from(reports).where(eq(reports.id, parseRid(req.params.rid))).limit(1);
    const buf = r?.k ? await app.deps.photos.get(r.k) : null;
    if (!buf) throw new HttpError(404, 'not_found', 'Không có ảnh.');
    return reply.header('cache-control', 'private, no-store').type('image/webp').send(buf);
  });

  app.post<{ Params: { rid: string } }>('/api/admin/reports/:rid/resolve', async (req) => {
    const a = await requireAdmin(app, req);
    const rid = parseRid(req.params.rid);
    const { action, note } = ResolveBody.parse(req.body);
    const at = app.deps.now();

    // Khoá dòng báo cáo: hai tab cùng xử lý thì tab sau thấy đã xử lý (409), không ghi nhật ký lần hai.
    const lockOpen = async (tx: Parameters<Parameters<typeof db.db.transaction>[0]>[0]) => {
      const [r] = await tx.select().from(reports).where(eq(reports.id, rid)).for('update');
      if (!r) throw notFound();
      if (r.status !== 'open') throw new HttpError(409, 'already_handled', 'Báo cáo này đã được xử lý.');
      return r;
    };

    if (action === 'delete_tree') {
      const [r] = await db.db.select({ treeId: reports.treeId }).from(reports).where(eq(reports.id, rid)).limit(1);
      if (!r) throw notFound();
      // Báo cáo bị xoá theo cây (CASCADE): dấu vết chỉ còn ở nhật ký.
      const ok = await deleteTreeWithPhotos(app, req, r.treeId, async (tx) => {
        await lockOpen(tx);
        await audit(tx, a.adminId, 'tree_delete', 'tree', r.treeId, `báo cáo #${rid}: ${note}`);
      });
      if (!ok) throw notFound();
      return { ok: true };
    }

    const dropKey = await db.db.transaction(async (tx) => {
      // Khoá dòng cây trước báo cáo, cùng thứ tự với xoá cây (deleteTreeWithPhotos): tránh deadlock
      // khi quản trị xoá lời nhắn đúng lúc chủ cây xoá cây.
      const [pre] = await tx.select({ treeId: reports.treeId }).from(reports).where(eq(reports.id, rid)).limit(1);
      if (!pre) throw notFound();
      await tx.select({ id: trees.id }).from(trees).where(eq(trees.id, pre.treeId)).for('update');
      const r = await lockOpen(tx);
      let photoKey: string | null = null;
      if (action === 'delete_message') {
        if (r.messageId === null) throw new HttpError(400, 'no_message', 'Báo cáo này không gắn với lời nhắn nào.');
        const del = await tx.delete(messages).where(eq(messages.id, r.messageId)).returning({ k: messages.photoKey });
        if (del.length === 0) throw new HttpError(409, 'message_gone', 'Lời nhắn đã bị xoá trước đó.');
        photoKey = del[0]!.k;
      }
      await tx
        .update(reports)
        .set(action === 'dismiss'
          ? { status: 'dismissed', resolution: 'no_action', handledBy: a.adminId, handledAt: at }
          : { status: 'resolved', resolution: 'message_deleted', handledBy: a.adminId, handledAt: at })
        .where(eq(reports.id, rid));
      await audit(tx, a.adminId, 'report_resolve', 'report', String(rid), `${action}: ${note}`);
      return photoKey;
    });
    if (dropKey) await dropPhoto(app.deps.photos, req, dropKey);
    return { ok: true };
  });
}
