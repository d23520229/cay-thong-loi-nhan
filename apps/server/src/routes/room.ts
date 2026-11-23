import type { FastifyInstance } from 'fastify';
import { and, count, eq, gte, ne, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { RoomSchema, validateRoom } from '@ctln/shared';
import { messages, roomItems, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { logEvent } from '../events.js';
import { assertWritable, phaseOf, requireOwner } from '../guards.js';
import { rateLimit } from '../security.js';
import { buildPublicRoom, roomItemRow } from './trees.js';
import { deleteTreeWithPhotos } from '../trees/delete.js';

const SaveRoomBodySchema = z.object({ roomVersion: z.number().int(), room: RoomSchema });
const SettingsBodySchema = z.object({ showMessageCount: z.boolean() });

const excluded = (col: string) => sql.raw(`excluded.${col}`);

type SaveOutcome = { kind: 'ok'; roomVersion: number } | { kind: 'conflict' } | { kind: 'slots_in_use' };

export async function roomRoutes(app: FastifyInstance) {
  app.put<{ Params: { id: string } }>('/api/trees/:id/room', async (req) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    assertWritable(app);
    const { db, now } = app.deps;
    if (!(await rateLimit(db.db, 'save:tree:' + treeId, 600, now()))) {
      throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
    }
    const body = SaveRoomBodySchema.parse(req.body);
    const { room } = body;
    const v = validateRoom(room);
    if (!v.ok) throw new HttpError(400, v.code, v.message);

    const out = await db.db.transaction(async (tx): Promise<SaveOutcome> => {
      const [t] = await tx
        .select({ roomVersion: trees.roomVersion })
        .from(trees)
        .where(eq(trees.id, treeId))
        .for('update');
      if (!t) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
      if (t.roomVersion !== body.roomVersion) return { kind: 'conflict' };

      const [over] = await tx
        .select({ n: count() })
        .from(messages)
        .where(and(eq(messages.treeId, treeId), gte(messages.slotIndex, room.tree.slotCount)));
      if (over!.n > 0) return { kind: 'slots_in_use' };

      const keep = room.items.map((i) => i.clientId);
      await tx
        .delete(roomItems)
        .where(and(eq(roomItems.treeId, treeId), keep.length ? notInArray(roomItems.clientId, keep) : undefined));
      // uq_one_tree_per_room kiểm từng dòng khi upsert: dòng cây cũ mang mã khác phải đi trước,
      // nếu không chèn cây mới sẽ va chỉ mục (500) khi mã cũ được dùng lại cho món khác loại.
      const newTree = room.items.find((i) => i.type === 'tree')!;
      await tx
        .delete(roomItems)
        .where(and(eq(roomItems.treeId, treeId), eq(roomItems.itemType, 'tree'), ne(roomItems.clientId, newTree.clientId)));
      if (room.items.length > 0) {
        await tx
          .insert(roomItems)
          .values(room.items.map((i) => roomItemRow(treeId, i)))
          .onConflictDoUpdate({
            target: [roomItems.treeId, roomItems.clientId],
            set: {
              itemType: excluded('item_type'),
              variant: excluded('variant'),
              x: excluded('x'),
              y: excluded('y'),
              scale: excluded('scale'),
              flip: excluded('flip'),
            },
          });
      }
      const roomVersion = t.roomVersion + 1;
      await tx
        .update(trees)
        .set({
          background: room.background,
          treeShape: room.tree.shape,
          treePalette: room.tree.palette,
          trunkShape: room.tree.trunkShape,
          trunkWood: room.tree.wood,
          slotCount: room.tree.slotCount,
          roomVersion,
          updatedAt: now(),
        })
        .where(eq(trees.id, treeId));
      return { kind: 'ok', roomVersion };
    });

    if (out.kind === 'conflict') {
      const current = await buildPublicRoom(db.db, treeId);
      throw new HttpError(409, 'version_conflict', 'Phòng vừa được sửa ở thiết bị khác.', {
        room: { ...current!, phase: phaseOf(app).phase },
      });
    }
    if (out.kind === 'slots_in_use') {
      throw new HttpError(409, 'slots_in_use', 'Có lời nhắn ở điểm sẽ bị bỏ, chưa giảm được số điểm nhắn.');
    }
    await logEvent(db.db, 'room_saved', treeId);
    return { roomVersion: out.roomVersion };
  });

  app.delete<{ Params: { id: string } }>('/api/trees/:id', async (req, reply) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    await deleteTreeWithPhotos(app, req, treeId);
    reply.clearCookie(`ctln_owner_${treeId}`, { path: '/' });
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>('/api/trees/:id/owner', async (req) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    const { db } = app.deps;
    const room = await buildPublicRoom(db.db, treeId);
    if (!room) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
    const [t] = await db.db
      .select({ lastVisit: trees.lastOwnerVisitAt, show: trees.showMessageCount })
      .from(trees)
      .where(eq(trees.id, treeId));
    const msgs = await db.db
      .select({ id: messages.id, slotIndex: messages.slotIndex, createdAt: messages.createdAt, readAt: messages.readAt })
      .from(messages)
      .where(eq(messages.treeId, treeId));

    const { canRead, phase } = phaseOf(app);
    const bySlot = new Map(msgs.map((m) => [m.slotIndex, m]));
    const slots = room.slots.map((s) => {
      const m = bySlot.get(s.index);
      return m
        ? { ...s, messageId: String(m.id), unread: m.readAt === null, locked: !canRead }
        : { ...s, locked: !canRead };
    });
    const since = t!.lastVisit;
    return {
      ...room,
      slots,
      phase,
      messageCount: msgs.length,
      newSinceLastVisit: since ? msgs.filter((m) => m.createdAt > since).length : msgs.length,
      showMessageCount: t!.show,
    };
  });

  app.post<{ Params: { id: string } }>('/api/trees/:id/owner/visit', async (req, reply) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    const { db, now } = app.deps;
    await db.db.update(trees).set({ lastOwnerVisitAt: now() }).where(eq(trees.id, treeId));
    return reply.code(204).send();
  });

  app.put<{ Params: { id: string } }>('/api/trees/:id/settings', async (req) => {
    const treeId = req.params.id;
    await requireOwner(app, req, treeId);
    const { showMessageCount } = SettingsBodySchema.parse(req.body);
    await app.deps.db.db.update(trees).set({ showMessageCount }).where(eq(trees.id, treeId));
    return { showMessageCount };
  });
}
