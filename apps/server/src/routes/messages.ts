import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomInt } from 'node:crypto';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { MessageBodySchema, MessageEditSchema, catalog } from '@ctln/shared';
import { blockedDevices, messages, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
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

export async function messagesRoutes(app: FastifyInstance) {
  const editUntilOf = (at: Date) => new Date(at.getTime() + catalog.limits.editMinutes * 60_000);

  app.post<{ Params: { id: string } }>('/api/trees/:id/messages', async (req, reply) => {
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
    if (!(await rateLimit(db.db, 'msg:ip:' + iHash, 20, at))) {
      throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
    }

    const token = randomToken(16);
    let id: number;
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
          })
          .returning({ id: messages.id });
        return row!.id;
      });
    } catch (e) {
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
    const [m] = await db.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, mid), eq(messages.editTokenHash, hmac(env, 'edit', token))))
      .limit(1);
    if (!m) throw new HttpError(403, 'bad_token', 'Bạn không có quyền với lời nhắn này.');
    return {
      messageId: String(m.id),
      slotIndex: m.slotIndex,
      ornament: m.ornament,
      anonymous: m.isAnonymous,
      authorName: m.authorName,
      content: m.content,
      editUntil: m.editUntil.toISOString(),
    };
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
    if (m.hash !== hmac(env, 'edit', token)) throw new HttpError(403, 'bad_token', 'Bạn không có quyền với lời nhắn này.');
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

  app.put<{ Params: { mid: string } }>('/api/messages/:mid', async (req) => {
    assertWritable(app);
    await assertNotGloballyBlocked(app, req, optionalDeviceId(req));
    const mid = parseMid(req.params.mid);
    const token = editToken(req);
    const body = MessageEditSchema.parse(req.body);
    const { db, now } = app.deps;
    const at = now();
    const rows = await db.db
      .update(messages)
      .set({
        ornament: body.ornament,
        isAnonymous: body.anonymous,
        authorName: body.anonymous ? null : (body.authorName ?? null),
        content: body.content,
        updatedAt: at,
      })
      .where(editable(mid, token, at))
      .returning({ treeId: messages.treeId });
    if (rows.length === 0) return denyReason(mid, token);
    await logEvent(db.db, 'message_edited', rows[0]!.treeId);
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
