import { ApiError } from './api';

/** Thông báo lỗi đăng nhập chủ cây — dùng chung cho "Mở lại cây của bạn" và "Chào chủ cây" (đặc tả 6.5). */
export function authErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'bad_pin') return 'Mã PIN chưa đúng';
    if (e.code === 'pin_locked') return 'Nhập sai quá nhiều lần, thử lại sau 15 phút';
    if (e.status === 404) return 'Không tìm thấy cây này';
    if (e.code === 'bad_key') return 'Link riêng chưa đúng';
    return e.message;
  }
  return 'Có lỗi xảy ra, thử lại sau nhé.';
}
