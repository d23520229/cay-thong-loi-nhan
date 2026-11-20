import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { globalBlocks, ownerSessions, siteSettings } from './db/schema.js';
import { HttpError } from './errors.js';
import { currentPhase } from './phase.js';
import { deviceHash, hmac, ipBlockHash, randomToken } from './security.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IP khách: bỏ hậu tố `:port` của IPv4 (Azure có thể gửi `ip:port`) trước khi băm. */
export function clientIp(req: FastifyRequest): string {
  return req.ip.replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, '$1');
}

export function phaseOf(app: FastifyInstance) {
  return currentPhase(app.deps.now());
}

export function assertWritable(app: FastifyInstance): void {
  if (!phaseOf(app).canWrite) throw new HttpError(403, 'write_closed', 'Cây đã ngừng nhận thay đổi từ 26/12.');
}

type Cache<T> = { at: number; value: T };
const pauseCache = new WeakMap<FastifyInstance, Cache<Map<string, string>>>();
const blockCache = new WeakMap<FastifyInstance, Cache<Set<string>>>();

export async function assertNotPaused(app: FastifyInstance, key: 'pause_create' | 'pause_messages'): Promise<void> {
  const t = app.deps.now().getTime();
  let c = pauseCache.get(app);
  if (!c || t - c.at >= 30_000 || t < c.at) {
    const rows = await app.deps.db.db.select().from(siteSettings);
    c = { at: t, value: new Map(rows.map((r) => [r.key, r.value])) };
    pauseCache.set(app, c);
  }
  const v = c.value.get(key);
  if (v === 'true' || v === '1') {
    throw new HttpError(503, 'paused', 'Đang bảo trì một chút, quay lại sau ít phút nhé');
  }
}

export async function assertNotGloballyBlocked(app: FastifyInstance, req: FastifyRequest, deviceId?: string): Promise<void> {
  const now = app.deps.now();
  const t = now.getTime();
  let c = blockCache.get(app);
  if (!c || t - c.at >= 60_000 || t < c.at) {
    const rows = await app.deps.db.db
      .select()
      .from(globalBlocks)
      .where(or(isNull(globalBlocks.expiresAt), gt(globalBlocks.expiresAt, now)));
    c = { at: t, value: new Set(rows.map((r) => `${r.kind}:${r.valueHash}`)) };
    blockCache.set(app, c);
  }
  const { env } = app.deps;
  const hit =
    c.value.has(`ip:${ipBlockHash(env, clientIp(req))}`) ||
    (deviceId !== undefined && c.value.has(`device:${deviceHash(env, deviceId)}`));
  if (hit) throw new HttpError(403, 'blocked', 'Truy cập của bạn đang bị chặn.');
}

export function requireDeviceId(req: FastifyRequest): string {
  const v = req.headers['x-device-id'];
  if (typeof v !== 'string' || !UUID.test(v)) {
    throw new HttpError(400, 'device_id_required', 'Thiếu mã thiết bị hợp lệ.');
  }
  return v;
}

const cookieName = (treeId: string) => `ctln_owner_${treeId}`;

export async function getOwnerSession(
  app: FastifyInstance,
  req: FastifyRequest,
  treeId: string,
): Promise<{ sessionId: number } | null> {
  const token = req.cookies?.[cookieName(treeId)];
  if (!token) return null;
  const { db } = app.deps.db;
  const now = app.deps.now();
  const [row] = await db
    .select({ id: ownerSessions.id })
    .from(ownerSessions)
    .where(
      and(
        eq(ownerSessions.tokenHash, hmac(app.deps.env, 'session', token)),
        eq(ownerSessions.treeId, treeId),
        isNull(ownerSessions.revokedAt),
        gt(ownerSessions.expiresAt, now),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db.update(ownerSessions).set({ lastSeenAt: now }).where(eq(ownerSessions.id, row.id));
  return { sessionId: row.id };
}

export async function requireOwner(app: FastifyInstance, req: FastifyRequest, treeId: string) {
  const s = await getOwnerSession(app, req, treeId);
  if (!s) throw new HttpError(401, 'owner_required', 'Bạn cần xác nhận là chủ cây.');
  return s;
}

export async function setOwnerCookie(
  app: FastifyInstance,
  reply: FastifyReply,
  treeId: string,
  method: 'create' | 'link' | 'pin' | 'google',
): Promise<void> {
  const { env, db } = app.deps;
  const expires = new Date(phaseOf(app).milestones.purgeAt);
  const token = randomToken(32);
  await db.db.insert(ownerSessions).values({
    treeId,
    tokenHash: hmac(env, 'session', token),
    method,
    expiresAt: expires,
  });
  reply.setCookie(cookieName(treeId), token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env.production,
    expires,
  });
}
