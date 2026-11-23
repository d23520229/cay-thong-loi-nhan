import { sql } from 'drizzle-orm';
import { errorCounts } from './db/schema.js';
import type { Db } from './db/client.js';

const MINUTE = 60_000;
const WINDOW_MIN = 60;

/** p95 thời gian phản hồi của 60 phút gần nhất, giữ trong bộ nhớ theo ô phút (mất khi khởi động lại). */
export class LatencyTracker {
  private readonly started: Date;
  private readonly buckets = new Map<number, number[]>();

  constructor(started: Date) {
    this.started = started;
  }

  record(ms: number, at: Date): void {
    const minute = Math.floor(at.getTime() / MINUTE);
    const list = this.buckets.get(minute);
    if (list) list.push(ms);
    else this.buckets.set(minute, [ms]);
    this.prune(minute);
  }

  p95(at: Date): { p95Ms: number | null; since: Date } {
    const minute = Math.floor(at.getTime() / MINUTE);
    this.prune(minute);
    const all = [...this.buckets.values()].flat().sort((a, b) => a - b);
    const since = new Date(Math.max(this.started.getTime(), at.getTime() - WINDOW_MIN * MINUTE));
    if (all.length === 0) return { p95Ms: null, since };
    return { p95Ms: all[Math.ceil(all.length * 0.95) - 1]!, since };
  }

  private prune(minute: number): void {
    for (const k of this.buckets.keys()) if (k <= minute - WINDOW_MIN) this.buckets.delete(k);
  }
}

/** Cộng một lỗi 5xx vào ô giờ (UTC) chứa `at`; chỉ ghi mẫu route, không URL thật / body / IP. */
export async function recordError(db: Db, at: Date, route: string | null, status: number): Promise<void> {
  const hour = new Date(Math.floor(at.getTime() / 3_600_000) * 3_600_000);
  await db
    .insert(errorCounts)
    .values({ hour, count: 1, lastAt: at, lastRoute: route, lastStatus: status })
    .onConflictDoUpdate({
      target: errorCounts.hour,
      set: { count: sql`${errorCounts.count} + 1`, lastAt: at, lastRoute: route, lastStatus: status },
    });
}
