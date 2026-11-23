import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { ZodError } from 'zod';
import type { DbHandle } from './db/client.js';
import type { Env } from './env.js';
import type { PhotoStore } from './storage/index.js';
import { HttpError } from './errors.js';
import { phaseOf } from './guards.js';
import { authRoutes } from './routes/auth.js';
import { configRoutes } from './routes/config.js';
import { messagesRoutes } from './routes/messages.js';
import { indexHtml, ogRoutes } from './routes/og.js';
import type { OgRoom } from './og/render.js';
import { ownerRoutes } from './routes/owner.js';
import { roomRoutes } from './routes/room.js';
import { treesRoutes } from './routes/trees.js';
import { adminRoutes } from './routes/admin/index.js';
import { ensureBootstrapAdmin } from './admin/bootstrap.js';
import { LatencyTracker, recordError } from './metrics.js';

export type GoogleVerifier = (idToken: string) => Promise<{ sub: string; name?: string; email?: string; emailVerified?: boolean }>;
export type AppDeps = {
  db: DbHandle;
  env: Env;
  now: () => Date;
  google: GoogleVerifier | null;
  /** Nơi lưu ảnh đính kèm. */
  photos: PhotoStore;
  /** Thay hàm vẽ ảnh OG (chỉ dùng trong test). */
  renderOg?: (room: OgRoom, assetDir: string) => Promise<Buffer>;
  /** Thay hàm vẽ ảnh phòng tải về (chỉ dùng trong test). */
  renderRoomImage?: (room: OgRoom, assetDir: string) => Promise<Buffer>;
};

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
    /** p95 thời gian phản hồi `/api/*` (Tổng quan quản trị). */
    latency: LatencyTracker;
  }
}

const body = (code: string, message: string, extra?: Record<string, unknown>) => ({ error: { ...extra, code, message } });
/** Serializer log request: chỉ method + đường dẫn (không query), tuyệt đối không có IP (đặc tả 10: không lưu IP thô). */
export function reqSerializer(req: { method?: string; url?: string }) {
  return { method: req.method, url: (req.url ?? '').split('?')[0] };
}

/** Cấu hình logger production: dùng reqSerializer để không ghi IP. */
export const loggerOptions = { serializers: { req: reqSerializer } };

/** Đường dẫn trang của SPA: không phải /api, /og, không có đuôi file (file thiếu phải 404, không trả HTML). */
const isPagePath = (path: string) =>
  path !== '/api' && !path.startsWith('/api/') && !path.startsWith('/og/') && !/\.[a-z0-9]+$/i.test(path);

const WRITE_METHODS =new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildApp(deps: AppDeps, opts: { logStream?: { write(msg: string): void } } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logStream ? { ...loggerOptions, stream: opts.logStream } : process.env.VITEST ? false : loggerOptions, bodyLimit: 65536, trustProxy: (_addr: string, hop: number) => hop < deps.env.trustProxyHops });
  app.decorate('deps', deps);
  app.decorate('latency', new LatencyTracker(deps.now()));
  await app.register(cookie);
  const GOOGLE = 'https://accounts.google.com';
  // Giữ mặc định helmet cho các chỉ thị khác; chỉ mở đúng accounts.google.com cho Google Identity.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        'script-src': ["'self'", GOOGLE],
        'frame-src': ["'self'", GOOGLE],
        'connect-src': ["'self'", GOOGLE],
        'style-src': ["'self'", "'unsafe-inline'", GOOGLE],
        // blob: để xem trước ảnh chọn từ máy (URL.createObjectURL) và tải thiệp.
        'img-src': ["'self'", 'data:', 'blob:'],
        // Chưa production: bỏ upgrade-insecure-requests để mở bản build qua http trong mạng LAN (thử trên điện thoại).
        upgradeInsecureRequests: deps.env.production ? [] : null,
      },
    },
  });

  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0]!;
    if (!path.startsWith('/api/') || path === '/api/config') return;
    // Quản trị vẫn chạy sau 01/01/2027 đến ngày xoá dữ liệu (đặc tả 6.8.2).
    if (phaseOf(app).phase === 'ENDED' && !path.startsWith('/api/admin/')) {
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

  app.setNotFoundHandler((req, reply) => {
    // Có bản build web: mọi đường dẫn trang (không phải /api, /og) trả index.html để React Router xử lý (đặc tả 6.6.3).
    const path = req.url.split('?')[0]!;
    if (deps.env.webDist && (req.method === 'GET' || req.method === 'HEAD') && isPagePath(path)) {
      return reply.code(200).type('text/html; charset=utf-8').header('cache-control', 'no-cache').send(indexHtml(deps.env.webDist));
    }
    return reply.code(404).send(body('not_found', 'Không tìm thấy.'));
  });

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

  app.addHook('onSend', async (req, reply) => {
    const path = req.url.split('?')[0]!;
    if (path.startsWith('/api/admin') || path.startsWith('/quan-tri')) reply.header('x-robots-tag', 'noindex');
    // API quản trị trả token CSRF và bản chụp lời nhắn: không cho lưu đệm.
    if (path.startsWith('/api/admin') && !reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
  });

  // Khối "Máy chủ" của Tổng quan (đặc tả 6.8.3): đo thời gian /api/*, đếm lỗi 5xx theo mẫu route.
  app.addHook('onResponse', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    const at = deps.now();
    app.latency.record(reply.elapsedTime, at);
    if (reply.statusCode < 500) return;
    try {
      await recordError(deps.db.db, at, req.routeOptions.url ?? null, reply.statusCode);
    } catch (e) {
      req.log.warn({ code: (e as { code?: string })?.code }, 'error_count_failed');
    }
  });

  app.get('/healthz', async () => ({ ok: true }));
  await app.register(configRoutes);
  await app.register(ogRoutes);
  await app.register(treesRoutes);
  await app.register(roomRoutes);
  await app.register(authRoutes);
  await app.register(messagesRoutes);
  await app.register(ownerRoutes);
  await app.register(adminRoutes);
  await ensureBootstrapAdmin(deps.db.db, deps.env.adminBootstrapEmail);
  return app;
}
