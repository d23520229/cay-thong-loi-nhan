import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { CreateTreeBodySchema, validateRoom, type RoomItem, type TreeConfig } from '@ctln/shared';
import type { Db } from '../db/client.js';
import { messages, ownerAccounts, roomItems, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { logEvent } from '../events.js';
import { assertNotGloballyBlocked, assertNotPaused, assertWritable, phaseOf, setOwnerCookie } from '../guards.js';
import { hashPin, hmac, ipHash, newTreeId, randomToken, rateLimit } from '../security.js';

export type PublicRoom = {
  id: string;
  ownerName: string;
  title: string | null;
  background: string;
  tree: TreeConfig;
  items: RoomItem[];
  slots: { index: number; occupied: boolean; ornament?: string }[];
  roomVersion: number;
  phase: string;
};

/** Phòng công khai, không có nội dung/tên người nhắn. `phase` do route thêm vào. */
export async function buildPublicRoom(db: Db, treeId: string): Promise<Omit<PublicRoom, 'phase'> | null> {
  const [t] = await db.select().from(trees).where(eq(trees.id, treeId)).limit(1);
  if (!t) return null;
  const items = await db.select().from(roomItems).where(eq(roomItems.treeId, treeId)).orderBy(asc(roomItems.id));
  const msgs = await db
    .select({ slotIndex: messages.slotIndex, ornament: messages.ornament })
    .from(messages)
    .where(eq(messages.treeId, treeId));
  const bySlot = new Map(msgs.map((m) => [m.slotIndex, m.ornament]));
  return {
    id: t.id,
    ownerName: t.ownerName,
    title: t.title,
    background: t.background,
    tree: {
      shape: t.treeShape,
      palette: t.treePalette,
      trunkShape: t.trunkShape,
      wood: t.trunkWood,
      slotCount: t.slotCount,
    },
    items: items.map((i) => ({
      clientId: i.clientId,
      type: i.itemType,
      variant: i.variant,
      x: i.x,
      y: i.y,
      scale: i.scale,
      flip: i.flip,
    })),
    slots: Array.from({ length: t.slotCount }, (_, index) => {
      const ornament = bySlot.get(index);
      return ornament === undefined ? { index, occupied: false } : { index, occupied: true, ornament };
    }),
    roomVersion: t.roomVersion,
  };
}

export const roomItemRow = (treeId: string, i: RoomItem) => ({
  treeId,
  clientId: i.clientId,
  itemType: i.type,
  variant: i.variant,
  x: i.x,
  y: i.y,
  scale: i.scale,
  flip: i.flip,
});

const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code === '23505' || err?.cause?.code === '23505';
};

export async function treesRoutes(app: FastifyInstance) {
  app.post('/api/trees', async (req, reply) => {
    assertWritable(app);
    await assertNotPaused(app, 'pause_create');
    await assertNotGloballyBlocked(app, req);
    const { db, env, now, google } = app.deps;
    const at = now();
    const ipH = ipHash(env, req.ip, at);
    if (!(await rateLimit(db.db, 'create:ip:' + ipH, 5, at))) {
      throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
    }

    const body = CreateTreeBodySchema.parse(req.body);
    const { room } = body;
    const v = validateRoom(room);
    if (!v.ok) throw new HttpError(400, v.code, v.message);

    let pinHash: string | null = null;
    let ownerAccountId: number | null = null;
    if (body.recovery.type === 'pin') {
      pinHash = await hashPin(body.recovery.pin);
    } else {
      if (!google) throw new HttpError(503, 'google_unavailable', 'Đăng nhập Google tạm thời chưa dùng được.');
      let who: { sub: string; name?: string };
      try {
        who = await google(body.recovery.idToken);
      } catch {
        throw new HttpError(400, 'google_invalid', 'Không xác minh được tài khoản Google.');
      }
      const [acc] = await db.db
        .insert(ownerAccounts)
        .values({ googleSub: who.sub, displayName: who.name ?? null, lastLoginAt: at })
        .onConflictDoUpdate({ target: ownerAccounts.googleSub, set: { lastLoginAt: at } })
        .returning({ id: ownerAccounts.id });
      ownerAccountId = acc!.id;
    }

    let refTreeId: string | null = null;
    if (body.ref) {
      const [r] = await db.db.select({ id: trees.id }).from(trees).where(eq(trees.id, body.ref)).limit(1);
      refTreeId = r?.id ?? null;
    }

    const key = randomToken(16);
    const privateKeyHash = hmac(env, 'link', key);
    let id = '';
    for (let attempt = 0; ; attempt++) {
      id = newTreeId();
      try {
        await db.db.transaction(async (tx) => {
          await tx.insert(trees).values({
            id,
            ownerAccountId,
            ownerName: body.ownerName,
            title: body.title ? body.title : null,
            privateKeyHash,
            pinHash,
            background: room.background,
            treeShape: room.tree.shape,
            treePalette: room.tree.palette,
            trunkShape: room.tree.trunkShape,
            trunkWood: room.tree.wood,
            slotCount: room.tree.slotCount,
            refTreeId,
            creatorIpHash: ipH,
          });
          if (room.items.length > 0) {
            await tx.insert(roomItems).values(
              room.items.map((i) => roomItemRow(id, i)),
            );
          }
        });
        break;
      } catch (e) {
        if (!isUniqueViolation(e) || attempt >= 2) throw e;
      }
    }

    await setOwnerCookie(app, reply, id, 'create');
    await logEvent(db.db, 'tree_created', id);
    const publicUrl = `${env.baseUrl}/c/${id}`;
    return reply.code(201).send({ id, publicUrl, privateUrl: `${publicUrl}#k=${key}`, roomVersion: 1 });
  });

  app.get<{ Params: { id: string } }>('/api/trees/:id', async (req) => {
    const room = await buildPublicRoom(app.deps.db.db, req.params.id);
    if (!room) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
    return { ...room, phase: phaseOf(app).phase };
  });
}
