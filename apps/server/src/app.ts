import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { ZodError } from 'zod';
import type { DbHandle } from './db/client.js';
import type { Env } from './env.js';
import { HttpError } from './errors.js';
import { phaseOf } from './guards.js';
import { authRoutes } from './routes/auth.js';
import { configRoutes } from './routes/config.js';
import { messagesRoutes } from './routes/messages.js';
import { ownerRoutes } from './routes/owner.js';
import { roomRoutes } from './routes/room.js';
import { treesRoutes } from './routes/trees.js';

export type GoogleVerifier = (idToken: string) => Promise<{ sub: string; name?: string }>;
export type AppDeps = { db: DbHandle; env: Env; now: () => Date; google: GoogleVerifier | null };

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
}

const body = (code: string, message: string, extra?: Record<string, unknown>) => ({ error: { ...extra, code, message } });
/** Serializer log request: chỉ method + đường dẫn (không query), tuyệt đối không có IP (đặc tả 10: không lưu IP thô). */
export function reqSerializer(req: { method?: string; url?: string }) {
  return { method: req.method, url: (req.url ?? '').split('?')[0] };
}

/** Cấu hình logger production: dùng reqSerializer để không ghi IP. */
export const loggerOptions = { serializers: { req: reqSerializer } };

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildApp(deps: AppDeps, opts: { logStream?: { write(msg: string): void } } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logStream ? { ...loggerOptions, stream: opts.logStream } : process.env.VITEST ? false : loggerOptions, bodyLimit: 65536, trustProxy: (_addr: string, hop: number) => hop < deps.env.trustProxyHops });
  app.decorate('deps', deps);
  await app.register(cookie);
  await app.register(helmet);

  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0]!;
    if (!path.startsWith('/api/') || path === '/api/config') return;
    if (phaseOf(app).phase === 'ENDED') {
      return reply.code(410).send(body('service_ended', 'Mùa Noel đã kết thúc, cảm ơn bạn!'));
    }
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
    if (WRITE_METHODS.has(req.method) && hasBody) {
      const ct = String(req.headers['content-type'] ?? '').toLowerCase();
      if (!ct.startsWith('application/json')) {
        return reply.code(415).send(body('json_required', 'Chỉ nhận dữ liệu dạng JSON.'));
      }
    }
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send(body('not_found', 'Không tìm thấy.')));

  app.setErrorHandler((err: Error & { code?: string; statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send(body(err.code, err.message, err.extra));
    if (err instanceof ZodError || err.validation) {
      return reply.code(400).send(body('invalid_body', 'Dữ liệu chưa hợp lệ.'));
    }
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send(body('body_too_large', 'Dữ liệu gửi lên quá lớn.'));
    }
    if (err.statusCode === 415) {
      return reply.code(415).send(body('json_required', 'Chỉ nhận dữ liệu dạng JSON.'));
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(400).send(body('invalid_body', 'Dữ liệu chưa hợp lệ.'));
    }
    // KHÔNG log nguyên err: DrizzleQueryError mang message/query/params chứa nội dung người dùng.
    const cause = (err as { cause?: { code?: string } }).cause;
    req.log.error({ name: err.name, code: cause?.code ?? err.code }, 'unhandled error');
    return reply.code(500).send(body('internal', 'Có lỗi xảy ra, thử lại sau nhé.'));
  });

  app.get('/healthz', async () => ({ ok: true }));
  await app.register(configRoutes);
  await app.register(treesRoutes);
  await app.register(roomRoutes);
  await app.register(authRoutes);
  await app.register(messagesRoutes);
  await app.register(ownerRoutes);
  return app;
}
