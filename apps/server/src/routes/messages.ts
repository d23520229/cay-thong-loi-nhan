import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { MessageBodySchema, MessageEditSchema, catalog } from '@ctln/shared';
import { blockedDevices, messages, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { photoKey, processPhoto } from '../photo.js';
import { logEvent } from '../events.js';
import {
  assertNotGloballyBlocked,
  clientIp,
  assertNotPaused,
  assertWritable,
  getOwnerSession,
  requireDeviceId,
} from '../guards.js';
import { deviceHash, hmac, ipHash, randomToken, rateLimit } from '../security.js';

const isUniqueViolation = (e: unknown) => {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code === '23505' || x?.cause?.code === '23505';
};

export const parseMid = (s: string): number => {
  if (!/^\d{1,15}$/.test(s)) throw new HttpError(404, 'not_found', 'Không tìm thấy lời nhắn này.');
  return Number(s);
};

const optionalDeviceId = (req: FastifyRequest): string | undefined => {
  try {
    return requireDeviceId(req);
  } catch {
    return undefined;
  }
};

const editToken = (req: FastifyRequest): string => {
  const v = req.headers['x-edit-token'];
  if (typeof v !== 'string' || v === '') throw new HttpError(403, 'bad_token', 'Bạn không có quyền với lời nhắn này.');
  return v;
};

/** So hai chuỗi băm không lộ thời gian; độ dài khác → không khớp. */
function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Route nhận ảnh base64 (≤ 3 MB → ~4 MB): 4,5 MB; route khác giữ 64 KB chung. */
const PHOTO_ROUTE = { bodyLimit: 4_718_592 };

export async function messagesRoutes(app: FastifyInstance) {
  /** Xoá ảnh không làm hỏng thao tác chính; log chỉ mã lỗi, không có dữ liệu ảnh. */
  const dropPhoto = async (req: FastifyRequest, key: string) => {
    try {
      await app.deps.photos.delete(key);
    } catch (e) {
      req.log.warn({ code: (e as { code?: string })?.code }, 'photo_delete_failed');
    }
  };
  const editUntilOf = (at: Date) => new Date(at.getTime() + catalog.limits.editMinutes * 60_000);

  app.post<{ Params: { id: string } }>('/api/trees/:id/messages', PHOTO_ROUTE, async (req, reply) => {
    assertWritable(app);
    await assertNotPaused(app, 'pause_messages');
    const deviceId = requireDeviceId(req);
    await assertNotGloballyBlocked(app, req, deviceId);
    const treeId = req.params.id;
    const { db, env, now } = app.deps;
    const at = now();
    const [tree] = await db.db.select({ id: trees.id }).from(trees).where(eq(trees.id, treeId)).limit(1);
    if (!tree) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
    if (await getOwnerSession(app, req, treeId)) {
      throw new HttpError(403, 'owner_cannot_post', 'Chủ cây không thể tự treo lời nhắn lên cây của mình.');
    }
    const body = MessageBodySchema.parse(req.body);
    const editUntil = editUntilOf(at);

    if (body.website) {
      const fake = String(randomInt(1, 1_000_000_000));
      return reply.code(201).send({ messageId: fake, editToken: randomToken(16), editUntil: editUntil.toISOString() });
    }

    const dHash = deviceHash(env, deviceId);
    const [blocked] = await db.db
      .select({ d: blockedDevices.deviceHash })
      .from(blockedDevices)
      .where(and(eq(blockedDevices.treeId, treeId), eq(blockedDevices.deviceHash, dHash)))
      .limit(1);
    if (blocked) throw new HttpError(403, 'blocked', 'Bạn không thể gửi lời nhắn tới cây này.');

    const iHash = ipHash(env, clientIp(req), at);
    if (!(await rateLimit(db.db, 'msg:ip:' + iHash, 100, at))) {
      throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
    }
    // Có ảnh: đếm riêng photo:ip, xử lý ảnh (tốn CPU) trước khi khoá dòng cây.
    let webp: Buffer | undefined;
    if (body.photo !== undefined) {
      if (!(await rateLimit(db.db, 'photo:ip:' + iHash, 30, at))) {
        throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
      }
      webp = await processPhoto(body.photo);
    }

    const token = randomToken(16);
    let id: number;
    let putKey = null as string | null; // ảnh đã lưu, cần xoá nếu giao dịch lỗi
    try {
      id = await db.db.transaction(async (tx) => {
        const [t] = await tx
          .select({ slotCount: trees.slotCount })
          .from(trees)
          .where(eq(trees.id, treeId))
          .for('update');
        if (!t) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
        if (body.slotIndex >= t.slotCount) throw new HttpError(400, 'bad_slot', 'Chỗ này không có trên cây.');
        const [c] = await tx
          .select({ n: count() })
          .from(messages)
          .where(and(eq(messages.treeId, treeId), eq(messages.deviceHash, dHash)));
        if (c!.n >= catalog.limits.perDeviceMessages) {
          throw new HttpError(409, 'device_limit', 'Mỗi người chỉ treo được 3 lời nhắn trên một cây.');
        }
        const [row] = await tx
          .insert(messages)
          .values({
            treeId,
            slotIndex: body.slotIndex,
            ornament: body.ornament,
            isAnonymous: body.anonymous,
            authorName: body.anonymous ? null : (body.authorName ?? null),
            content: body.content,
            editTokenHash: hmac(env, 'edit', token),
            editUntil,
            deviceHash: dHash,
            ipHash: iHash,
            // Giờ theo app (FAKE_NOW), không theo now() của CSDL: newSinceLastVisit so với last_owner_visit_at.
            createdAt: at,
            updatedAt: at,
          })
          .returning({ id: messages.id });
        if (webp) {
          // Lưu ảnh trong giao dịch: lưu lỗi thì không có lời nhắn.
          const key = photoKey(treeId, row!.id);
          await app.deps.photos.put(key, webp);
          putKey = key;
          await tx.update(messages).set({ photoKey: key }).where(eq(messages.id, row!.id));
        }
        return row!.id;
      });
    } catch (e) {
      if (putKey) await dropPhoto(req, putKey);
      if (isUniqueViolation(e)) {
        throw new HttpError(409, 'slot_taken', 'Chỗ này vừa có người treo, chọn chỗ khác nhé');
      }
      throw e;
    }
    await logEvent(db.db, 'message_created', treeId);
    return reply.code(201).send({ messageId: String(id), editToken: token, editUntil: editUntil.toISOString() });
  });

  app.get<{ Params: { mid: string } }>('/api/messages/:mid/mine', async (req) => {
    const mid = parseMid(req.params.mid);
    const token = editToken(req);
    const { db, env } = app.deps;
    const [m] = await db.db.select().from(messages).where(eq(messages.id, mid)).limit(1);
    if (!m) throw new HttpError(404, 'not_found', 'Không tìm thấy lời nhắn này.');
    if (!sameHash(m.editTokenHash, hmac(env, 'edit', token))) throw new HttpError(403, 'bad_token', 'Bạn không có quyền với lời nhắn này.');
    return {
      messageId: String(m.id),
      slotIndex: m.slotIndex,
      ornament: m.ornament,
      anonymous: m.isAnonymous,
      authorName: m.authorName,
      content: m.content,
      editUntil: m.editUntil.toISOString(),
      hasPhoto: m.photoKey !== null,
    };
  });

  // Người viết xem lại ảnh của mình (bảng sửa). Không lưu đệm ở trình duyệt/proxy.
  app.get<{ Params: { mid: string } }>('/api/messages/:mid/photo', async (req, reply) => {
    const mid = parseMid(req.params.mid);
    const token = editToken(req);
    const { db, env, photos } = app.deps;
    const [m] = await db.db
      .select({ hash: messages.editTokenHash, photoKey: messages.photoKey })
      .from(messages)
      .where(eq(messages.id, mid))
      .limit(1);
    if (!m) throw new HttpError(404, 'not_found', 'Không tìm thấy lời nhắn này.');
    if (!sameHash(m.hash, hmac(env, 'edit', token))) throw new HttpError(403, 'bad_token', 'Bạn không có quyền với lời nhắn này.');
    const data = m.photoKey ? await photos.get(m.photoKey) : null;
    if (!data) throw new HttpError(404, 'not_found', 'Lời nhắn này không có ảnh.');
    return reply.type('image/webp').header('cache-control', 'private, no-store').send(data);
  });

  /** 0 dòng bị đổi: một SELECT để chọn lý do. */
  async function denyReason(mid: number, token: string): Promise<never> {
    const { db, env, now } = app.deps;
    const [m] = await db.db
      .select({ hash: messages.editTokenHash, until: messages.editUntil, readAt: messages.readAt })
      .from(messages)
      .where(eq(messages.id, mid))
      .limit(1);
    if (!m) throw new HttpError(404, 'not_found', 'Không tìm thấy lời nhắn này.');
    if (!sameHash(m.hash, hmac(env, 'edit', token))) throw new HttpError(403, 'bad_token', 'Bạn không có quyền với lời nhắn này.');
    if (m.readAt !== null) throw new HttpError(403, 'already_opened', 'Chủ cây đã mở lời nhắn này, không sửa được nữa.');
    if (m.until <= now()) throw new HttpError(403, 'edit_expired', 'Đã quá 15 phút, không sửa được nữa.');
    throw new HttpError(409, 'conflict', 'Lời nhắn vừa thay đổi, thử lại nhé.');
  }

  const editable = (mid: number, token: string, at: Date) =>
    and(
      eq(messages.id, mid),
      eq(messages.editTokenHash, hmac(app.deps.env, 'edit', token)),
      gt(messages.editUntil, at),
      isNull(messages.readAt),
    );

  app.put<{ Params: { mid: string } }>('/api/messages/:mid', PHOTO_ROUTE, async (req) => {
    assertWritable(app);
    await assertNotGloballyBlocked(app, req, optionalDeviceId(req));
    const mid = parseMid(req.params.mid);
    const token = editToken(req);
    const body = MessageEditSchema.parse(req.body);
    const { db, now, photos } = app.deps;
    const at = now();
    // photo: chuỗi = thay, null = gỡ, không có = giữ nguyên.
    const photoChange = body.photo !== undefined;
    const webp = typeof body.photo === 'string' ? await processPhoto(body.photo) : undefined;
    let newKey = null as string | null; // ảnh mới đã lưu, cần xoá nếu giao dịch lỗi
    let done: { treeId: string; oldKey: string | null } | null;
    try {
      done = await db.db.transaction(async (tx) => {
        // Khoá dòng còn sửa được, đọc khoá ảnh cũ; 0 dòng → không lưu ảnh mới.
        const [m] = await tx
          .select({ treeId: messages.treeId, photoKey: messages.photoKey })
          .from(messages)
          .where(editable(mid, token, at))
          .for('update');
        if (!m) return null;
        if (webp) {
          const key = photoKey(m.treeId, mid);
          await photos.put(key, webp);
          newKey = key;
        }
        await tx
          .update(messages)
          .set({
            ornament: body.ornament,
            isAnonymous: body.anonymous,
            authorName: body.anonymous ? null : (body.authorName ?? null),
            content: body.content,
            updatedAt: at,
            ...(photoChange ? { photoKey: newKey } : {}),
          })
          .where(eq(messages.id, mid));
        return { treeId: m.treeId, oldKey: m.photoKey };
      });
    } catch (e) {
      if (newKey) await dropPhoto(req, newKey);
      throw e;
    }
    if (!done) return denyReason(mid, token);
    if (photoChange && done.oldKey) await dropPhoto(req, done.oldKey);
    await logEvent(db.db, 'message_edited', done.treeId);
    return { ok: true };
  });

  app.delete<{ Params: { mid: string } }>('/api/messages/:mid', async (req, reply) => {
    assertWritable(app);
    await assertNotGloballyBlocked(app, req, optionalDeviceId(req));
    const mid = parseMid(req.params.mid);
    const token = editToken(req);
    const { db, now } = app.deps;
    const rows = await db.db.delete(messages).where(editable(mid, token, now())).returning({ treeId: messages.treeId });
    if (rows.length === 0) return denyReason(mid, token);
    await logEvent(db.db, 'message_deleted_by_author', rows[0]!.treeId);
    return reply.code(204).send();
  });
}
