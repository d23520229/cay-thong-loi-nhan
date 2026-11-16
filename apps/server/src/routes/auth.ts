import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authAttempts, ownerAccounts, ownerSessions, rateCounters, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { clientIp, getOwnerSession, setOwnerCookie } from '../guards.js';
import { hmac, ipHash, rateLimit, verifyPin } from '../security.js';

const LinkBody = z.object({ key: z.string().min(1).max(200) });
const PinBody = z.object({ pin: z.string().regex(/^\d{6}$/) });
const GoogleBody = z.object({ idToken: z.string().min(1).max(4096), treeId: z.string().min(1).max(32).optional() });

const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 15 * 60_000;
const IP_FAIL_LIMIT = 20;

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
    const locked = async () => {
      const [cur] = await db.db.select({ until: trees.pinLockedUntil }).from(trees).where(eq(trees.id, t.id)).limit(1);
      const until = cur?.until && cur.until > at ? cur.until : new Date(at.getTime() + PIN_LOCK_MS);
      return new HttpError(429, 'pin_locked', 'Nhập sai quá nhiều lần, thử lại sau 15 phút.', {
        retryAt: until.toISOString(),
      });
    };

    // Giữ chỗ lượt thử nguyên tử TRƯỚC khi chạy scrypt, để các yêu cầu song song không vượt giới hạn.
    const [reserved] = await db.db
      .update(trees)
      .set({
        // Cửa sổ 15 phút: lần sai cuối đã quá 15 phút thì đếm lại từ 1.
        pinFailedCount: sql`CASE WHEN ${trees.pinLastFailedAt} IS NOT NULL AND ${trees.pinLastFailedAt} <= ${new Date(at.getTime() - PIN_LOCK_MS).toISOString()}::timestamptz THEN 1 ELSE ${trees.pinFailedCount} + 1 END`,
        pinLastFailedAt: at,
      })
      .where(and(eq(trees.id, t.id), or(isNull(trees.pinLockedUntil), lte(trees.pinLockedUntil, at))))
      .returning({ n: trees.pinFailedCount });
    if (!reserved) throw await locked();
    if (reserved.n > PIN_MAX_FAILS) {
      // Tràn: đã có ≥5 lượt đang chạy → khoá thật (tự hết sau 15 phút), tránh kẹt đếm mà không có mốc khoá.
      await db.db
        .update(trees)
        .set({ pinFailedCount: 0, pinLockedUntil: new Date(at.getTime() + PIN_LOCK_MS) })
        .where(and(eq(trees.id, t.id), or(isNull(trees.pinLockedUntil), lte(trees.pinLockedUntil, at))));
      throw await locked();
    }

    const refundTree = () =>
      db.db
        .update(trees)
        .set({ pinFailedCount: sql`greatest(${trees.pinFailedCount} - 1, 0)` })
        .where(eq(trees.id, t.id));
    const bucket = 'pinfail:ip:' + ipH;
    if (!(await rateLimit(db.db, bucket, IP_FAIL_LIMIT, at))) {
      await refundTree();
      throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');
    }

    const ok = await verifyPin(pin, t.pinHash);
    await db.db.insert(authAttempts).values({ treeId: t.id, ipHash: ipH, method: 'pin', success: ok, createdAt: at });
    if (!ok) {
      if (reserved.n === PIN_MAX_FAILS) {
        await db.db
          .update(trees)
          .set({ pinFailedCount: 0, pinLockedUntil: new Date(at.getTime() + PIN_LOCK_MS) })
          .where(eq(trees.id, t.id));
      }
      throw new HttpError(401, 'bad_pin', 'Mã PIN không đúng.');
    }
    // Đúng PIN: không tính vào giới hạn IP (chỉ đếm lần sai) nên trả lại lượt đã giữ.
    await db.db
      .update(rateCounters)
      .set({ hits: sql`greatest(${rateCounters.hits} - 1, 0)` })
      .where(and(eq(rateCounters.bucket, bucket), eq(rateCounters.windowStart, new Date(Math.floor(at.getTime() / 3600_000) * 3600_000))));
    await db.db.update(trees).set({ pinFailedCount: 0, pinLockedUntil: null, pinLastFailedAt: null }).where(eq(trees.id, t.id));
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
