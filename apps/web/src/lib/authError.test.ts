import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { authErrorMessage } from './authError';

const NOW = Date.parse('2026-12-01T10:00:00Z');
const locked = (retryAt?: unknown) => new ApiError(429, 'pin_locked', 'x', retryAt === undefined ? {} : { retryAt });

describe('authErrorMessage', () => {
  it('pin_locked: số phút còn lại tính từ retryAt, làm tròn lên', () => {
    expect(authErrorMessage(locked('2026-12-01T10:07:01Z'), NOW)).toBe('Nhập sai quá nhiều lần, thử lại sau 8 phút');
    expect(authErrorMessage(locked('2026-12-01T10:15:00Z'), NOW)).toBe('Nhập sai quá nhiều lần, thử lại sau 15 phút');
  });

  it('pin_locked: ít nhất 1 phút (sắp hết hoặc đã qua)', () => {
    expect(authErrorMessage(locked('2026-12-01T10:00:05Z'), NOW)).toBe('Nhập sai quá nhiều lần, thử lại sau 1 phút');
    expect(authErrorMessage(locked('2026-12-01T09:00:00Z'), NOW)).toBe('Nhập sai quá nhiều lần, thử lại sau 1 phút');
  });

  it('pin_locked: thiếu hoặc sai retryAt → 15 phút', () => {
    for (const r of [undefined, 'z', 42, null]) {
      expect(authErrorMessage(locked(r), NOW)).toBe('Nhập sai quá nhiều lần, thử lại sau 15 phút');
    }
  });

  it('các mã khác giữ nguyên', () => {
    expect(authErrorMessage(new ApiError(401, 'bad_pin', 'x'))).toBe('Mã PIN chưa đúng');
    expect(authErrorMessage(new ApiError(404, 'not_found', 'x'))).toBe('Không tìm thấy cây này');
    expect(authErrorMessage(new Error('x'))).toBe('Có lỗi xảy ra, thử lại sau nhé.');
  });
});
