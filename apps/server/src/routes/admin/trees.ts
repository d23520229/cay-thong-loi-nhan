import type { FastifyInstance } from 'fastify';
import { and, eq, gt, isNull, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { messages, ownerSessions, rateCounters, reports, roomItems, trees } from '../../db/schema.js';
import { HttpError } from '../../errors.js';
import { windowEnd, windowStart } from '../../security.js';
import { audit } from '../../admin/audit.js';
import { requireAdmin } from '../../admin/session.js';
import { deleteTreeWithPhotos } from '../../trees/delete.js';
import { DAY_MS, PIN_FAILS_PER_TREE_DAY } from '../auth.js';

const OptionalNote = z.object({ note: z.string().trim().max(500).optional() });
const RequiredNote = z.object({ note: z.string().trim().min(1).max(500) });
const TREE_ID = /^[a-z0-9]{1,32}$/;

const notFound = () => new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
const n = (v: unknown) => Number(v ?? 0);

/** Tra cứu phòng (đặc tả 6.8.5): chỉ số liệu, không có nội dung lời nhắn; hành động hỗ trợ chủ cây. */
export async function adminTreesRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const treeId = (raw: string) => {
    if (!TREE_ID.test(raw)) throw notFound();
    return raw;
  };
  const mustExist = async (id: string) => {
    const [t] = await db.db.select({ id: trees.id }).from(trees).where(eq(trees.id, id)).limit(1);
    if (!t) throw notFound();
  };

  app.get<{ Params: { id: string } }>('/api/admin/trees/:id', async (req) => {
    await requireAdmin(app, req);
    const id = treeId(req.params.id);
    const now = app.deps.now();
    const [t] = await db.db.select().from(trees).where(eq(trees.id, id)).limit(1);
    if (!t) throw notFound();
    const [items] = await db.db.select({ c: sql`count(*)` }).from(roomItems).where(eq(roomItems.treeId, id));
    const [msgs] = await db.db
      .select({
        opened: sql`count(*) FILTER (WHERE ${messages.readAt} IS NOT NULL)`,
        unopened: sql`count(*) FILTER (WHERE ${messages.readAt} IS NULL)`,
      })
      .from(messages)
      .where(eq(messages.treeId, id));
    const [sess] = await db.db
      .select({ c: sql`count(*)` })
      .from(ownerSessions)
      .where(and(eq(ownerSessions.treeId, id), isNull(ownerSessions.revokedAt), gt(ownerSessions.expiresAt, now)));
    const [reps] = await db.db
      .select({ open: sql`count(*) FILTER (WHERE ${reports.status} = 'open')`, total: sql`count(*)` })
      .from(reports)
      .where(eq(reports.treeId, id));
    const [pin] = await db.db
      .select({ hits: rateCounters.hits })
      .from(rateCounters)
      .where(and(eq(rateCounters.bucket, `pin:tree:${id}`), eq(rateCounters.windowStart, windowStart(now, DAY_MS))));
    const failsToday = pin?.hits ?? 0;
    return {
      id: t.id,
      ownerName: t.ownerName,
      title: t.title,
      createdAt: t.createdAt.toISOString(),
      lastOwnerVisitAt: t.lastOwnerVisitAt ? t.lastOwnerVisitAt.toISOString() : null,
      itemCount: n(items?.c),
      messages: { opened: n(msgs?.opened), unopened: n(msgs?.unopened) },
      recovery: { pin: t.pinHash !== null, google: t.ownerAccountId !== null },
      activeSessions: n(sess?.c),
      reports: { open: n(reps?.open), total: n(reps?.total) },
      pin: { failsToday, lockedUntil: failsToday >= PIN_FAILS_PER_TREE_DAY ? windowEnd(now, DAY_MS).toISOString() : null },
    };
  });

  app.post<{ Params: { id: string } }>('/api/admin/trees/:id/unlock-pin', async (req, reply) => {
    const a = await requireAdmin(app, req);
    const id = treeId(req.params.id);
    const { note } = OptionalNote.parse(req.body ?? {});
    await mustExist(id);
    await db.db.transaction(async (tx) => {
      // Mọi bộ đếm PIN của cây: trần ngày `pin:tree:{id}` và khung 15 phút `pin:tree:{id}:ip:…` (đặc tả 10).
      await tx.delete(rateCounters).where(or(eq(rateCounters.bucket, `pin:tree:${id}`), like(rateCounters.bucket, `pin:tree:${id}:%`)));
      await audit(tx, a.adminId, 'pin_unlock', 'tree', id, note || null);
    });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/admin/trees/:id/revoke-sessions', async (req) => {
    const a = await requireAdmin(app, req);
    const id = treeId(req.params.id);
    const { note } = OptionalNote.parse(req.body ?? {});
    await mustExist(id);
    const now = app.deps.now();
    const revoked = await db.db.transaction(async (tx) => {
      const rows = await tx
        .update(ownerSessions)
        .set({ revokedAt: now })
        .where(and(eq(ownerSessions.treeId, id), isNull(ownerSessions.revokedAt), gt(ownerSessions.expiresAt, now)))
        .returning({ id: ownerSessions.id });
      await audit(tx, a.adminId, 'sessions_revoke', 'tree', id, note || null);
      return rows.length;
    });
    return { revoked };
  });

  app.delete<{ Params: { id: string } }>('/api/admin/trees/:id', async (req, reply) => {
    const a = await requireAdmin(app, req);
    const id = treeId(req.params.id);
    const { note } = RequiredNote.parse(req.body ?? {});
    const ok = await deleteTreeWithPhotos(app, req, id, (tx) => audit(tx, a.adminId, 'tree_delete', 'tree', id, note));
    if (!ok) throw notFound();
    return reply.code(204).send();
  });
}
