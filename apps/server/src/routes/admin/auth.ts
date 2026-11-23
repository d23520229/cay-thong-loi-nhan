import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { adminSessions, adminUsers } from '../../db/schema.js';
import { HttpError } from '../../errors.js';
import { clientIp } from '../../guards.js';
import { ipHash, rateLimit, refundRate } from '../../security.js';
import { audit } from '../../admin/audit.js';
import { ADMIN_COOKIE, ADMIN_PATH, csrfFor, requireAdmin, setAdminCookie } from '../../admin/session.js';

const LoginBody = z.object({ idToken: z.string().min(1).max(4096) });
const LOGIN_FAILS_PER_IP_HOUR = 10;

export async function adminAuthRoutes(app: FastifyInstance) {
  app.post('/api/admin/auth/google', async (req, reply) => {
    const { db, env, now, google } = app.deps;
    const { idToken } = LoginBody.parse(req.body);
    if (!google) throw new HttpError(503, 'google_unavailable', 'Đăng nhập Google tạm thời chưa dùng được.');
    const at = now();
    // Giữ lượt trước, thành công thì trả lại: chỉ lần thất bại bị đếm (10 / IP / giờ).
    const bucket = 'admin-login:ip:' + ipHash(env, clientIp(req), at);
    if (!(await rateLimit(db.db, bucket, LOGIN_FAILS_PER_IP_HOUR, at))) {
      throw new HttpError(429, 'rate_limited', 'Thử quá nhiều lần, đợi một lát nhé.');
    }
    let who: Awaited<ReturnType<typeof google>>;
    try {
      who = await google(idToken);
    } catch {
      throw new HttpError(400, 'google_invalid', 'Không xác minh được tài khoản Google.');
    }
    const notAdmin = new HttpError(403, 'not_admin', 'Tài khoản này không có quyền quản trị.');
    if (!who.email || who.emailVerified !== true) throw notAdmin;
    const [u] = await db.db
      .select()
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${who.email.toLowerCase()}`)
      .limit(1);
    // Lần đầu gắn google_sub; về sau tài khoản Google khác cùng email bị từ chối.
    if (!u || u.disabled || (u.googleSub !== null && u.googleSub !== who.sub)) throw notAdmin;
    await db.db.transaction(async (tx) => {
      await tx.update(adminUsers).set({ googleSub: who.sub, lastLoginAt: at }).where(eq(adminUsers.id, u.id));
      await audit(tx, u.id, 'login', 'admin', String(u.id));
    });
    await refundRate(db.db, bucket, at);
    const { token } = await setAdminCookie(app, reply, u.id);
    return { email: u.email, csrfToken: csrfFor(env, token) };
  });

  app.get('/api/admin/me', async (req) => {
    const a = await requireAdmin(app, req);
    return { email: a.email, csrfToken: csrfFor(app.deps.env, a.token) };
  });

  app.post('/api/admin/auth/logout', async (req, reply) => {
    const a = await requireAdmin(app, req);
    const { db, now } = app.deps;
    await db.db.transaction(async (tx) => {
      await tx.update(adminSessions).set({ revokedAt: now() }).where(eq(adminSessions.id, a.sessionId));
      await audit(tx, a.adminId, 'logout', 'admin', String(a.adminId));
    });
    reply.clearCookie(ADMIN_COOKIE, { path: ADMIN_PATH });
    return reply.code(204).send();
  });
}
