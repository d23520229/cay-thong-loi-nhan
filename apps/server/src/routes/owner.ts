import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { blockedDevices, messages, reports, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { logEvent } from '../events.js';
import { assertNotGloballyBlocked, clientIp, getOwnerSession, phaseOf, requireDeviceId, requireOwner } from '../guards.js';
import { deviceHash, ipHash, rateLimit } from '../security.js';
import { dropPhoto } from '../photo.js';
import { parseMid } from './messages.js';

const BlockSchema = z.object({ messageId: z.string().regex(/^\d{1,15}$/) });
const ReportSchema = z.object({
  messageId: z.string().regex(/^\d{1,15}$/).optional(),
  reason: z.string().max(200).optional(),
});

const notFound = () => new HttpError(404, 'not_found', 'Không tìm thấy lời nhắn.');

export async function ownerRoutes(app: FastifyInstance) {
  const { db, photos } = app.deps;

  /** Trước 0h 24/12: 423 kèm giờ mở khoá (dùng chung cho mở lời nhắn và đọc ảnh). */
  function assertCanRead() {
    const ph = phaseOf(app);
    if (!ph.canRead) {
      throw new HttpError(423, 'locked', 'Chưa đến 0h 24/12, quà vẫn còn gói.', { unlockAt: ph.milestones.unlockAt });
    }
  }

  /** Lời nhắn phải thuộc đúng phòng; ngược lại 404. */
  async function findMessage(treeId: string, mid: number) {
    const [m] = await db.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, mid), eq(messages.treeId, treeId)))
      .limit(1);
    if (!m) throw notFound();
    return m;
  }

  app.post<{ Params: { id: string; mid: string } }>('/api/trees/:id/messages/:mid/open', async (req) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    const mid = parseMid(req.params.mid);
    assertCanRead();
    const at = app.deps.now();
    // Một câu lệnh duy nhất: đánh dấu đã đọc và trả nội dung hiện tại (không đọc cũ rồi mới ghi).
    const [m] = await db.db
      .update(messages)
      .set({ readAt: sql`coalesce(${messages.readAt}, ${at.toISOString()}::timestamptz)` })
      .where(and(eq(messages.id, mid), eq(messages.treeId, treeId)))
      .returning();
    if (!m) throw notFound();
    if (m.readAt!.getTime() === at.getTime()) await logEvent(db.db, 'message_opened', treeId);
    return {
      messageId: String(m.id),
      slotIndex: m.slotIndex,
      ornament: m.ornament,
      anonymous: m.isAnonymous,
      authorName: m.isAnonymous ? null : m.authorName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      // Chỉ báo có ảnh hay không, không trả khoá; ảnh đọc qua GET …/photo.
      hasPhoto: m.photoKey !== null,
    };
  });

  // Chủ cây xem ảnh của lời nhắn đã mở. Không lưu đệm ở trình duyệt/proxy.
  app.get<{ Params: { id: string; mid: string } }>('/api/trees/:id/messages/:mid/photo', async (req, reply) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    const mid = parseMid(req.params.mid);
    assertCanRead();
    const m = await findMessage(treeId, mid);
    if (m.readAt === null) throw new HttpError(403, 'not_opened', 'Mở lời nhắn trước rồi mới xem ảnh.');
    const data = m.photoKey ? await photos.get(m.photoKey) : null;
    if (!data) throw new HttpError(404, 'not_found', 'Lời nhắn này không có ảnh.');
    return reply.type('image/webp').header('cache-control', 'private, no-store').send(data);
  });

  app.delete<{ Params: { id: string; mid: string } }>('/api/trees/:id/messages/:mid', async (req, reply) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    const mid = parseMid(req.params.mid);
    const rows = await db.db
      .delete(messages)
      .where(and(eq(messages.id, mid), eq(messages.treeId, treeId)))
      .returning({ photoKey: messages.photoKey });
    if (rows.length === 0) throw notFound();
    if (rows[0]!.photoKey) await dropPhoto(photos, req, rows[0]!.photoKey);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/trees/:id/block', async (req, reply) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    const body = BlockSchema.parse(req.body);
    const mid = parseMid(body.messageId);
    const key = await db.db.transaction(async (tx) => {
      const [m] = await tx
        .select({ d: messages.deviceHash, photoKey: messages.photoKey })
        .from(messages)
        .where(and(eq(messages.id, mid), eq(messages.treeId, treeId)))
        .limit(1);
      if (!m) throw notFound();
      await tx.insert(blockedDevices).values({ treeId, deviceHash: m.d }).onConflictDoNothing();
      const [gone] = await tx.delete(messages).where(eq(messages.id, mid)).returning({ photoKey: messages.photoKey });
      return gone?.photoKey ?? null;
    });
    // Xoá ảnh sau khi giao dịch xong: giao dịch lỗi thì ảnh còn nguyên.
    if (key) await dropPhoto(photos, req, key);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/trees/:id/reports', async (req, reply) => {
    const treeId = req.params.id;
    const [tree] = await db.db.select({ id: trees.id }).from(trees).where(eq(trees.id, treeId)).limit(1);
    if (!tree) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
    const body = ReportSchema.parse(req.body);
    const reason = body.reason?.trim() || null;
    const owner = await getOwnerSession(app, req, treeId);

    let values: typeof reports.$inferInsert;
    let photoKey: string | null = null; // ảnh của lời nhắn bị báo cáo, chép sau khi chèn báo cáo
    if (owner) {
      let snapshot: string | null = null;
      let messageId: number | null = null;
      if (body.messageId !== undefined) {
        const m = await findMessage(treeId, parseMid(body.messageId));
        // Chỉ chụp lời nhắn chủ cây đã mở: không để báo cáo làm lộ nội dung còn khoá cho quản trị viên.
        if (m.readAt === null) {
          throw new HttpError(403, 'not_opened', 'Chỉ báo cáo được lời nhắn bạn đã mở.');
        }
        snapshot = m.content;
        messageId = m.id;
        photoKey = m.photoKey;
      }
      values = { treeId, messageId, messageSnapshot: snapshot, reason, reporter: 'owner', reporterHash: null };
    } else {
      const deviceId = requireDeviceId(req);
      await assertNotGloballyBlocked(app, req, deviceId);
      if (body.messageId !== undefined) throw new HttpError(400, 'invalid_body', 'Dữ liệu chưa hợp lệ.');
      const at = app.deps.now();
      if (!(await rateLimit(db.db, 'report:ip:' + ipHash(app.deps.env, clientIp(req), at), 10, at))) {
        throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
      }
      values = { treeId, reason, reporter: 'guest', reporterHash: deviceHash(app.deps.env, deviceId) };
    }
    const [row] = await db.db.insert(reports).values(values).returning({ id: reports.id });
    if (photoKey) {
      // Bản chụp ảnh riêng cho báo cáo: lời nhắn bị xoá sau đó, bản chụp vẫn còn.
      // Chép lỗi thì giữ báo cáo (đã có bản chụp chữ), chỉ log mã lỗi.
      const snapKey = `r/${row!.id}.webp`;
      try {
        await photos.copy(photoKey, snapKey);
        await db.db.update(reports).set({ photoSnapshotKey: snapKey }).where(eq(reports.id, row!.id));
      } catch (e) {
        req.log.warn({ code: (e as { code?: string })?.code }, 'report_photo_copy_failed');
      }
    }
    return reply.code(201).send({ reportId: String(row!.id) });
  });
}
