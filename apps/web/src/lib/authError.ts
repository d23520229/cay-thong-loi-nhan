import { ApiError } from './api';

/** Số phút còn bị khoá theo `retryAt` của server (làm tròn lên, ít nhất 1); thiếu/sai thì 15. */
function lockMinutes(retryAt: unknown, now: number): number {
  const t = typeof retryAt === 'string' ? Date.parse(retryAt) : NaN;
  return Number.isNaN(t) ? 15 : Math.max(1, Math.ceil((t - now) / 60000));
}

/** Kẹt không tự gỡ được ngay (khoá đến hết ngày, Google không phải chủ cây) → nên hiện email hỗ trợ. */
export function needsSupport(e: unknown, now = Date.now()): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.code === 'not_owner') return true;
  return e.code === 'pin_locked' && lockMinutes(e.extra.retryAt, now) > 60;
}

/** Thông báo lỗi đăng nhập chủ cây — dùng chung cho "Mở lại cây của bạn" và "Chào chủ cây" (đặc tả 6.5). */
export function authErrorMessage(e: unknown, now = Date.now()): string {
  if (e instanceof ApiError) {
    if (e.code === 'bad_pin') return 'Mã PIN chưa đúng';
    if (e.code === 'pin_locked') {
      const m = lockMinutes(e.extra.retryAt, now);
      return `Nhập sai quá nhiều lần, thử lại sau ${m > 60 ? `${Math.ceil(m / 60)} giờ` : `${m} phút`}`;
    }
    if (e.status === 404) return 'Không tìm thấy cây này';
    if (e.code === 'bad_key') return 'Link riêng chưa đúng';
    if (e.code === 'not_owner') return 'Tài khoản này không phải chủ cây.';
    if (e.code === 'google_invalid') return 'Đăng nhập Google chưa thành công, thử lại nhé.';
    return e.message;
  }
  return 'Có lỗi xảy ra, thử lại sau nhé.';
}
