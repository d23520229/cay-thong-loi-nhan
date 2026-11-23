import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { adminSessions, adminUsers } from '../db/schema.js';
import type { Env } from '../env.js';
import { HttpError } from '../errors.js';
import { hmac, randomToken } from '../security.js';

export const ADMIN_COOKIE = 'ctln_admin';
export const ADMIN_PATH = '/api/admin';
const SESSION_MS = 12 * 3_600_000;

/** Token CSRF suy ra từ token phiên — không cần cột mới (đặc tả 6.8.2). */
export function csrfFor(env: Env, token: string): string {
  return hmac(env, 'csrf', token);
}

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function setAdminCookie(app: FastifyInstance, reply: FastifyReply, adminId: number): Promise<{ token: string }> {
  const { env, db, now } = app.deps;
  const token = randomToken(32);
  const expires = new Date(now().getTime() + SESSION_MS);
  await db.db.insert(adminSessions).values({ adminId, tokenHash: hmac(env, 'admin', token), expiresAt: expires });
  reply.setCookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'strict', path: ADMIN_PATH, secure: env.production, expires });
  return { token };
}

/** Phiên quản trị còn hiệu lực + (với lệnh ghi) header X-CSRF-Token đúng. */
export async function requireAdmin(app: FastifyInstance, req: FastifyRequest): Promise<{ adminId: number; email: string; token: string; sessionId: number }> {
  const { env, db, now } = app.deps;
  const token = req.cookies?.[ADMIN_COOKIE];
  const deny = () => new HttpError(401, 'admin_required', 'Cần đăng nhập quản trị.');
  if (!token) throw deny();
  const [row] = await db.db
    .select({ sessionId: adminSessions.id, adminId: adminUsers.id, email: adminUsers.email })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminId))
    .where(
      and(
        eq(adminSessions.tokenHash, hmac(env, 'admin', token)),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, now()),
        eq(adminUsers.disabled, false),
      ),
    )
    .limit(1);
  if (!row) throw deny();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const h = req.headers['x-csrf-token'];
    if (typeof h !== 'string' || !sameText(h, csrfFor(env, token))) {
      throw new HttpError(403, 'csrf', 'Phiên làm việc đã đổi, tải lại trang nhé.');
    }
  }
  return { ...row, token };
}
