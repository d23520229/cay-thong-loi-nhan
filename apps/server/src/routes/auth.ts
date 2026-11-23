import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { authAttempts, ownerAccounts, ownerSessions, rateCounters, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { clientIp, getOwnerSession, setOwnerCookie } from '../guards.js';
import { hmac, ipHash, rateLimit, refundRate, verifyPin, windowEnd, windowStart } from '../security.js';

const LinkBody = z.object({ key: z.string().min(1).max(200) });
const PinBody = z.object({ pin: z.string().regex(/^\d{6}$/) });
const GoogleBody = z.object({ idToken: z.string().min(1).max(4096), treeId: z.string().min(1).max(32).optional() });

// Chống dò PIN (đặc tả 10): đếm trong rate_counters, chỉ giữ lại lần sai.
const PIN_FAILS_PER_TREE_IP = 5;
const PIN_TREE_IP_WINDOW_MS = 15 * 60_000;
export const PIN_FAILS_PER_TREE_DAY = 50;
export const DAY_MS = 86_400_000;
const PIN_FAILS_PER_IP_HOUR = 20;

const notFound = () => new HttpError(404, 'not_found', 'Không tìm thấy cây này.');

export async function authRoutes(app: FastifyInstance) {
  const loadTree = async (id: string) => {
    const [t] = await app.deps.db.db.select().from(trees).where(eq(trees.id, id)).limit(1);
    if (!t) throw notFound();
    return t;
  };

  app.post<{ Params: { id: string } }>('/api/trees/:id/auth/link', async (req, reply) => {
    const { db, env, now } = app.deps;
    const t = await loadTree(req.params.id);
    const { key } = LinkBody.parse(req.body);
    const at = now();
    if (!(await rateLimit(db.db, 'link:ip:' + ipHash(env, clientIp(req), at), 20, at))) {
      throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
    }
    const a = Buffer.from(hmac(env, 'link', key));
    const b = Buffer.from(t.privateKeyHash);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    await db.db.insert(authAttempts).values({
      treeId: t.id,
      ipHash: ipHash(env, clientIp(req), at),
      method: 'link',
      success: ok,
      createdAt: at,
    });
    if (!ok) throw new HttpError(401, 'bad_key', 'Liên kết riêng không đúng.');
    await setOwnerCookie(app, reply, t.id, 'link');
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/trees/:id/auth/pin', async (req, reply) => {
    const { db, env, now } = app.deps;
    const t = await loadTree(req.params.id);
    const { pin } = PinBody.parse(req.body);
    const at = now();
    if (!t.pinHash) throw new HttpError(400, 'pin_not_set', 'Cây này chưa đặt mã PIN.');
    const ipH = ipHash(env, clientIp(req), at);
    const treeIpBucket = `pin:tree:${t.id}:ip:${ipH}`;
    const treeBucket = `pin:tree:${t.id}`;
    const ipBucket = 'pinfail:ip:' + ipH;
    const locked = (windowMs: number) =>
      new HttpError(429, 'pin_locked', 'Nhập sai quá nhiều lần, thử lại sau.', {
        retryAt: windowEnd(at, windowMs).toISOString(),
      });

    // Giữ lượt nguyên tử TRƯỚC khi chạy scrypt, để các yêu cầu song song không vượt giới hạn.
    // Lượt bị từ chối được trả lại ngay, để nó không kéo dài khoá.
    if (!(await rateLimit(db.db, treeIpBucket, PIN_FAILS_PER_TREE_IP, at, PIN_TREE_IP_WINDOW_MS))) {
      await refundRate(db.db, treeIpBucket, at, PIN_TREE_IP_WINDOW_MS);
      throw locked(PIN_TREE_IP_WINDOW_MS);
    }
    if (!(await rateLimit(db.db, treeBucket, PIN_FAILS_PER_TREE_DAY, at, DAY_MS))) {
      await refundRate(db.db, treeBucket, at, DAY_MS);
      await refundRate(db.db, treeIpBucket, at, PIN_TREE_IP_WINDOW_MS);
      throw locked(DAY_MS);
    }
    if (!(await rateLimit(db.db, ipBucket, PIN_FAILS_PER_IP_HOUR, at))) {
      await refundRate(db.db, ipBucket, at);
      await refundRate(db.db, treeBucket, at, DAY_MS);
      await refundRate(db.db, treeIpBucket, at, PIN_TREE_IP_WINDOW_MS);
      throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
    }

    const ok = await verifyPin(pin, t.pinHash);
    await db.db.insert(authAttempts).values({ treeId: t.id, ipHash: ipH, method: 'pin', success: ok, createdAt: at });
    if (!ok) throw new HttpError(401, 'bad_pin', 'Mã PIN không đúng.');
    // Đúng PIN: chỉ đếm lần sai → xoá các lần sai của IP này ở phòng này, trả lại lượt ở bộ đếm ngày và bộ đếm IP.
    await db.db
      .delete(rateCounters)
      .where(and(eq(rateCounters.bucket, treeIpBucket), eq(rateCounters.windowStart, windowStart(at, PIN_TREE_IP_WINDOW_MS))));
    await refundRate(db.db, treeBucket, at, DAY_MS);
    await refundRate(db.db, ipBucket, at);
    await setOwnerCookie(app, reply, t.id, 'pin');
    return reply.code(204).send();
  });

  app.post('/api/auth/google', async (req, reply) => {
    const { db, now, google } = app.deps;
    const { idToken, treeId } = GoogleBody.parse(req.body);
    if (!google) throw new HttpError(503, 'google_unavailable', 'Đăng nhập Google tạm thời chưa dùng được.');
    let who: { sub: string };
    try {
      who = await google(idToken);
    } catch {
      throw new HttpError(400, 'google_invalid', 'Không xác minh được tài khoản Google.');
    }
    const [acc] = await db.db.select().from(ownerAccounts).where(eq(ownerAccounts.googleSub, who.sub)).limit(1);
    if (acc) await db.db.update(ownerAccounts).set({ lastLoginAt: now() }).where(eq(ownerAccounts.id, acc.id));
    if (treeId === undefined) {
      if (!acc) return { trees: [] };
      const rows = await db.db
        .select({ id: trees.id, title: trees.title })
        .from(trees)
        .where(eq(trees.ownerAccountId, acc.id));
      return { trees: rows };
    }
    const t = await loadTree(treeId);
    if (!acc || t.ownerAccountId !== acc.id) {
      throw new HttpError(403, 'not_owner', 'Tài khoản này không phải chủ cây.');
    }
    await setOwnerCookie(app, reply, t.id, 'google');
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/trees/:id/auth/logout', async (req, reply) => {
    const { db, now } = app.deps;
    await loadTree(req.params.id);
    const s = await getOwnerSession(app, req, req.params.id);
    if (s) await db.db.update(ownerSessions).set({ revokedAt: now() }).where(eq(ownerSessions.id, s.sessionId));
    reply.clearCookie(`ctln_owner_${req.params.id}`, { path: '/' });
    return reply.code(204).send();
  });
}
