import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/errors.js';
import { PHOTO_MAX_BYTES, PHOTO_MAX_PIXELS, photoKey, processPhoto } from '../src/photo.js';

const img = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } });
const b64 = (b: Buffer) => b.toString('base64');
const bad = async (s: string) => {
  const e = await processPhoto(s).then(() => null, (x) => x);
  expect(e).toBeInstanceOf(HttpError);
  expect(e.status).toBe(400);
  expect(e.code).toBe('bad_photo');
};

describe('processPhoto', () => {
  it('JPEG có EXIF (GPS) → WebP không còn EXIF', async () => {
    const jpg = await img(100, 80).withExif({ IFD3: { GPSLatitudeRef: 'N' } }).jpeg().toBuffer();
    expect((await sharp(jpg).metadata()).exif).toBeDefined();
    const out = await processPhoto(b64(jpg));
    const m = await sharp(out).metadata();
    expect(m.format).toBe('webp');
    expect(m.exif).toBeUndefined();
  });
  it('ảnh 4000×500 → cạnh dài 1600, giữ tỉ lệ', async () => {
    const m = await sharp(await processPhoto(b64(await img(4000, 500).jpeg().toBuffer()))).metadata();
    expect([m.width, m.height]).toEqual([1600, 200]);
  });
  it('ảnh 40×40 không bị phóng to', async () => {
    const m = await sharp(await processPhoto(b64(await img(40, 40).jpeg().toBuffer()))).metadata();
    expect([m.width, m.height]).toEqual([40, 40]);
  });
  it('nhận WebP', async () => {
    expect((await sharp(await processPhoto(b64(await img(50, 50).webp().toBuffer()))).metadata()).format).toBe('webp');
  });
  it('base64 rác → bad_photo', async () => {
    await bad('!!!không phải ảnh!!!');
    await bad('');
  });
  it('PNG/GIF → bad_photo (chỉ nhận jpeg, webp)', async () => {
    await bad(b64(await img(20, 20).png().toBuffer()));
    await bad(b64(await img(20, 20).gif().toBuffer()));
  });
  it('ảnh hợp lệ nhưng > 3 MB sau giải mã → bad_photo', async () => {
    const raw = Buffer.alloc(1500 * 1500 * 3);
    for (let i = 0; i < raw.length; i += 1) raw[i] = Math.floor(Math.random() * 256);
    const big = await sharp(raw, { raw: { width: 1500, height: 1500, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
    expect(big.length).toBeGreaterThan(PHOTO_MAX_BYTES);
    await bad(b64(big));
  });
  it('chuỗi base64 quá dài → bad_photo', async () => {
    await bad('A'.repeat(Math.ceil(PHOTO_MAX_BYTES / 3) * 4 + 8));
  });
  it('ảnh WebP quá nhiều điểm ảnh (6000×6000, file nhỏ) → bad_photo', async () => {
    const webp = await img(6000, 6000).webp().toBuffer();
    expect(webp.length).toBeLessThan(PHOTO_MAX_BYTES);
    expect(6000 * 6000).toBeGreaterThan(PHOTO_MAX_PIXELS);
    await bad(b64(webp));
  });
  it('thông báo lỗi là câu tiếng Việt cố định', async () => {
    const e = await processPhoto('xxxx').then(() => null, (x) => x);
    expect(e.message).toBe('Ảnh không hợp lệ, chọn ảnh khác nhé');
  });
});

describe('photoKey', () => {
  it('có dạng m/{treeId}/{id}-{token}.webp và khác nhau mỗi lần', () => {
    const a = photoKey('tree1', 7);
    expect(a).toMatch(/^m\/tree1\/7-[A-Za-z0-9_-]{12}\.webp$/);
    expect(photoKey('tree1', 7)).not.toBe(a);
  });
});
