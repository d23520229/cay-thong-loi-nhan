import type { FastifyInstance } from 'fastify';
import { desc, gt, sql, type SQL } from 'drizzle-orm';
import { errorCounts } from '../../db/schema.js';
import { phaseOf } from '../../guards.js';
import { requireAdmin } from '../../admin/session.js';
import { windowStart } from '../../security.js';

const DAY = 86_400_000;
const MILESTONE_KEYS = ['unlockAt', 'writeClosesAt', 'serviceEndsAt', 'purgeAt'] as const;
const n = (v: unknown) => Number(v ?? 0);

/** Tổng quan quản trị (đặc tả 6.8.3): số liệu người dùng + khối máy chủ, không có nội dung lời nhắn. */
export async function adminOverviewRoutes(app: FastifyInstance) {
  app.get('/api/admin/overview', async (req) => {
    await requireAdmin(app, req);
    const { db, env } = app.deps;
    const p = phaseOf(app);
    const now = p.now;
    const since = new Date(now.getTime() - DAY);
    const nextKey = MILESTONE_KEYS.find((k) => new Date(p.milestones[k]) > now);

    // db.execute trả { rows } (PGlite) hoặc mảng (postgres-js). Ngày truyền dạng chuỗi ISO + ::timestamptz:
    // drizzle tắt bộ chuyển Date của postgres-js nên Date thô làm hỏng câu lệnh (PGlite thì không lỗi).
    const first = async (q: SQL) => {
      const res = (await db.db.execute(q)) as unknown as { rows?: Record<string, unknown>[] } & Record<string, unknown>[];
      return (res.rows ?? res)[0]!;
    };
    const count = async (table: string, where: SQL = sql`TRUE`) => {
      const r = await first(sql`SELECT count(*) AS total, count(*) FILTER (WHERE created_at > ${since.toISOString()}::timestamptz) AS day
        FROM ${sql.identifier(table)} WHERE ${where}`);
      return { total: n(r.total), last24h: n(r.day) };
    };

    const treesC = await count('trees');
    const messagesC = await count('messages');
    const viewsC = await count('events', sql`type = 'tree_viewed_guest'`);
    const rep = await first(sql`SELECT count(*) FILTER (WHERE status = 'open') AS open,
      count(*) FILTER (WHERE photo_snapshot_key IS NOT NULL) AS snaps FROM reports`);
    const refd = await first(sql`SELECT count(*) AS c FROM trees WHERE ref_tree_id IS NOT NULL`);
    const photos = await first(sql`SELECT count(*) AS cnt, coalesce(sum(photo_bytes), 0) AS bytes,
      count(*) FILTER (WHERE photo_bytes IS NULL) AS unknown FROM messages WHERE photo_key IS NOT NULL`);
    const dbSize = await first(sql`SELECT pg_database_size(current_database()) AS b`);
    // Đếm theo ô giờ: lấy các ô từ giờ chứa mốc "24 giờ trước" (có thể dư tối đa 1 giờ).
    const err = await first(sql`SELECT coalesce(sum(count), 0) AS c FROM error_counts WHERE hour >= ${windowStart(since, 3_600_000).toISOString()}::timestamptz`);
    const [last] = await db.db.select().from(errorCounts).where(gt(errorCounts.lastAt, since)).orderBy(desc(errorCounts.lastAt)).limit(1);
    const lat = app.latency.p95(now);

    return {
      now: now.toISOString(),
      phase: p.phase,
      next: nextKey ? { key: nextKey, at: p.milestones[nextKey] } : null,
      users: {
        trees: treesC,
        messages: messagesC,
        views: viewsC,
        openReports: n(rep.open),
        viral: treesC.total === 0 ? null : n(refd.c) / treesC.total,
      },
      server: {
        errors24h: n(err.c),
        lastError: last ? { at: last.lastAt.toISOString(), route: last.lastRoute, status: last.lastStatus } : null,
        p95Ms: lat.p95Ms,
        latencySince: lat.since.toISOString(),
        dbBytes: n(dbSize.b),
        dbQuotaBytes: env.dbQuotaBytes,
        photos: { count: n(photos.cnt), bytes: n(photos.bytes), unknown: n(photos.unknown), reportSnapshots: n(rep.snaps) },
        azureUrl: env.adminAzureUrl ?? null,
      },
    };
  });
}
