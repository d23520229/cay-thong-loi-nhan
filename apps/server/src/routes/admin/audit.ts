import type { FastifyInstance } from 'fastify';
import { desc, eq, lt } from 'drizzle-orm';
import { z } from 'zod';
import { adminAudit, adminUsers } from '../../db/schema.js';
import { requireAdmin } from '../../admin/session.js';

const Query = z.object({ before: z.string().regex(/^\d{1,15}$/).optional() });
const PAGE = 50;

/** Nhật ký thao tác (đặc tả 6.8.6): mới nhất trước, 50 dòng mỗi trang. */
export async function adminAuditRoutes(app: FastifyInstance) {
  app.get('/api/admin/audit', async (req) => {
    await requireAdmin(app, req);
    const { before } = Query.parse(req.query);
    const rows = await app.deps.db.db
      .select({
        id: adminAudit.id, at: adminAudit.createdAt, email: adminUsers.email, action: adminAudit.action,
        targetType: adminAudit.targetType, targetId: adminAudit.targetId, note: adminAudit.note,
      })
      .from(adminAudit)
      .leftJoin(adminUsers, eq(adminUsers.id, adminAudit.adminId))
      .where(before ? lt(adminAudit.id, Number(before)) : undefined)
      .orderBy(desc(adminAudit.id))
      .limit(PAGE + 1);
    const page = rows.slice(0, PAGE).map((r) => ({ ...r, id: String(r.id), at: r.at.toISOString() }));
    return { items: page, nextBefore: rows.length > PAGE ? page[PAGE - 1]!.id : null };
  });
}
