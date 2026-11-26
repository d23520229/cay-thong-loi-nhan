// Dọn bảng định kỳ (đặc tả 6.9.3): chỉ dữ liệu phụ đã hết tác dụng, không đụng nội dung.
import { isNotNull, lt, or } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { adminSessions, authAttempts, rateCounters } from './db/schema.js';

export type CleanupResult = { rateCounters: number; authAttempts: number; adminSessions: number };

const DAY_MS = 24 * 3_600_000;

/** Xoá khung giới hạn tần suất quá 1 ngày (khung dài nhất là 1 ngày), lần đăng nhập quá 7 ngày, phiên quản trị hết hạn / bị thu hồi. */
export async function cleanup(db: Db, at: Date): Promise<CleanupResult> {
  const rc = await db.delete(rateCounters)
    .where(lt(rateCounters.windowStart, new Date(at.getTime() - DAY_MS)))
    .returning({ b: rateCounters.bucket });
  const aa = await db.delete(authAttempts)
    .where(lt(authAttempts.createdAt, new Date(at.getTime() - 7 * DAY_MS)))
    .returning({ id: authAttempts.id });
  const as = await db.delete(adminSessions)
    .where(or(lt(adminSessions.expiresAt, at), isNotNull(adminSessions.revokedAt)))
    .returning({ id: adminSessions.id });
  return { rateCounters: rc.length, authAttempts: aa.length, adminSessions: as.length };
}

type Log = { info(o: object, m: string): void; error(o: object, m: string): void };

/** Chạy ngay rồi mỗi `everyMs`; lỗi chỉ log `{ name, code }` (không lộ nội dung truy vấn). Trả hàm dừng. */
export function startCleanup(opts: { db: Db; now: () => Date; log: Log; everyMs?: number }): () => void {
  const run = async () => {
    try {
      const r = await cleanup(opts.db, opts.now());
      if (r.rateCounters || r.authAttempts || r.adminSessions) opts.log.info(r, 'đã dọn bảng');
    } catch (e) {
      const err = e as { name?: string; code?: string };
      opts.log.error({ name: err.name, code: err.code }, 'dọn bảng lỗi');
    }
  };
  void run();
  const timer = setInterval(() => void run(), opts.everyMs ?? 3_600_000);
  timer.unref();
  return () => clearInterval(timer);
}
