import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { and, count, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { authAttempts, ownerAccounts, ownerSessions, trees } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { getOwnerSession, setOwnerCookie } from '../guards.js';
import { hmac, ipHash, verifyPin } from '../security.js';

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
    const a = Buffer.from(hmac(env, 'link', key));
    const b = Buffer.from(t.privateKeyHash);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    await db.db.insert(authAttempts).values({
      treeId: t.id,
      ipHash: ipHash(env, req.ip, at),
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
    if (t.pinLockedUntil && t.pinLockedUntil > at) {
      throw new HttpError(429, 'pin_locked', 'Nhập sai quá nhiều lần, thử lại sau 15 phút.', {
        retryAt: t.pinLockedUntil.toISOString(),
      });
    }
    const ipH = ipHash(env, req.ip, at);
    const [{ n } = { n: 0 }] = await db.db
      .select({ n: count() })
      .from(authAttempts)
      .where(
        and(
          eq(authAttempts.method, 'pin'),
          eq(authAttempts.success, false),
          eq(authAttempts.ipHash, ipH),
          gt(authAttempts.createdAt, new Date(at.getTime() - 3600_000)),
        ),
      );
    if (n >= IP_FAIL_LIMIT) throw new HttpError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.');

    const ok = await verifyPin(pin, t.pinHash);
    await db.db.insert(authAttempts).values({ treeId: t.id, ipHash: ipH, method: 'pin', success: ok, createdAt: at });
    if (!ok) {
      const failed = t.pinFailedCount + 1;
      const lock = failed >= PIN_MAX_FAILS;
      await db.db
        .update(trees)
        .set(lock ? { pinFailedCount: 0, pinLockedUntil: new Date(at.getTime() + PIN_LOCK_MS) } : { pinFailedCount: failed })
        .where(eq(trees.id, t.id));
      throw new HttpError(401, 'bad_pin', 'Mã PIN không đúng.');
    }
    await db.db.update(trees).set({ pinFailedCount: 0, pinLockedUntil: null }).where(eq(trees.id, t.id));
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
