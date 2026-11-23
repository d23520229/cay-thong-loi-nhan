import sharp from 'sharp';
import type { FastifyRequest } from 'fastify';
import { HttpError } from './errors.js';
import { randomToken } from './security.js';
import type { PhotoStore } from './storage/index.js';

export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
/** Giới hạn số điểm ảnh đầu vào: chặn ảnh nhỏ file nhưng giải mã ngốn RAM (sharp kiểm tra ở phần đầu file). */
export const PHOTO_MAX_PIXELS = 25_000_000;
const MAX_BASE64_LENGTH = Math.ceil(PHOTO_MAX_BYTES / 3) * 4 + 4;
const BAD = 'Ảnh không hợp lệ, chọn ảnh khác nhé';
const bad = () => new HttpError(400, 'bad_photo', BAD);

/** Giải mã base64 → WebP q80, cạnh dài ≤ 1600, bỏ metadata (EXIF/GPS). Chỉ nhận JPEG/WebP (web đổi PNG sang JPEG trước khi gửi). */
export async function processPhoto(base64: string): Promise<Buffer> {
  if (base64.length > MAX_BASE64_LENGTH) throw bad();
  const buf = Buffer.from(base64, 'base64');
  if (buf.length === 0 || buf.length > PHOTO_MAX_BYTES) throw bad();
  try {
    const format = (await sharp(buf, { failOn: 'error', limitInputPixels: PHOTO_MAX_PIXELS }).metadata()).format;
    if (format !== 'jpeg' && format !== 'webp') throw bad();
    return await sharp(buf, { failOn: 'error', limitInputPixels: PHOTO_MAX_PIXELS })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw bad();
  }
}

export function photoKey(treeId: string, messageId: number): string {
  return `m/${treeId}/${messageId}-${randomToken(9)}.webp`;
}

/** Xoá ảnh không làm hỏng thao tác chính; log chỉ mã lỗi, không có dữ liệu ảnh. */
export async function dropPhoto(photos: PhotoStore, req: FastifyRequest, key: string): Promise<void> {
  try {
    await photos.delete(key);
  } catch (e) {
    req.log.warn({ code: (e as { code?: string })?.code }, 'photo_delete_failed');
  }
}
