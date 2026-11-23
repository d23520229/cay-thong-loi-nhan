import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { messages, reports, trees } from '../db/schema.js';
import { dropPhoto } from '../photo.js';
import type { Tx } from '../admin/audit.js';

/**
 * Xoá cây cùng mọi ảnh (ảnh lời nhắn + bản chụp báo cáo). Một giao dịch: khoá dòng cây, gọi `inTx`
 * (kiểm tra / ghi nhật ký của người gọi — ném lỗi thì huỷ cả giao dịch), xoá lời nhắn và báo cáo lấy
 * khoá ảnh, xoá cây (CASCADE phần còn lại); xong mới xoá ảnh, lỗi chỉ ghi log. Không có cây → false.
 */
export async function deleteTreeWithPhotos(
  app: FastifyInstance,
  req: FastifyRequest,
  treeId: string,
  inTx?: (tx: Tx) => Promise<void>,
): Promise<boolean> {
  const { db, photos } = app.deps;
  const keys = await db.db.transaction(async (tx) => {
    // Khoá dòng cây trước: POST lời nhắn song song (đang chèn kèm ảnh) phải đợi, không lọt giữa chừng.
    const [found] = await tx.select({ id: trees.id }).from(trees).where(eq(trees.id, treeId)).for('update');
    if (!found) return null;
    if (inTx) await inTx(tx);
    const ms = await tx.delete(messages).where(eq(messages.treeId, treeId)).returning({ k: messages.photoKey });
    const rs = await tx.delete(reports).where(eq(reports.treeId, treeId)).returning({ k: reports.photoSnapshotKey });
    await tx.delete(trees).where(eq(trees.id, treeId)); // ON DELETE CASCADE
    return [...ms, ...rs].map((r) => r.k).filter((k): k is string => k !== null);
  });
  if (keys === null) return false;
  for (const k of keys) await dropPhoto(photos, req, k);
  return true;
}
