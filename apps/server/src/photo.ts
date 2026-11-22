import sharp from 'sharp';
import { HttpError } from './errors.js';
import { randomToken } from './security.js';

export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
const BAD = 'Ảnh này chưa đọc được, chọn ảnh JPG hoặc PNG nhé';
const bad = () => new HttpError(400, 'bad_photo', BAD);

/** Giải mã base64 → WebP q80, cạnh dài ≤ 1600, bỏ metadata (EXIF/GPS). Chỉ nhận JPEG/WebP (web đổi PNG sang JPEG trước khi gửi). */
export async function processPhoto(base64: string): Promise<Buffer> {
  const buf = Buffer.from(base64, 'base64');
  if (buf.length === 0 || buf.length > PHOTO_MAX_BYTES) throw bad();
  try {
    const format = (await sharp(buf, { failOn: 'error' }).metadata()).format;
    if (format !== 'jpeg' && format !== 'webp') throw bad();
    return await sharp(buf, { failOn: 'error' })
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
