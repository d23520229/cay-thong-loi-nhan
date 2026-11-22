/** Ảnh kèm lời nhắn (đặc tả 6.7.5 mục 1): kiểm cỡ, giải mã, thu cạnh dài ≤ 1600, mã hoá lại (bỏ EXIF). */
export const PICK_MAX_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 1600;
const QUALITY = 0.85;

export type PreparedPhoto = { bitmap: ImageBitmap; base64: string };

export class PhotoError extends Error {
  code: 'too_big' | 'unreadable';
  constructor(code: 'too_big' | 'unreadable') {
    super(code);
    this.name = 'PhotoError';
    this.code = code;
  }
}

export const bitmapFromBlob = (b: Blob): Promise<ImageBitmap> => createImageBitmap(b);

/** Giải mã có xoay theo EXIF; trình duyệt cũ không nhận tuỳ chọn (TypeError) thì giải mã không tuỳ chọn. */
async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    if (e instanceof TypeError) return createImageBitmap(file);
    throw e;
  }
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function encode(c: AnyCanvas, type: string): Promise<Blob | null> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality: QUALITY }).catch(() => null);
  return new Promise((resolve) => c.toBlob(resolve, type, QUALITY));
}

/** Chuỗi base64 trơn (không có tiền tố `data:`), server không tự bóc tiền tố. */
function toBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > PICK_MAX_BYTES) throw new PhotoError('too_big');
  let src: ImageBitmap;
  try {
    src = await decode(file);
  } catch {
    throw new PhotoError('unreadable');
  }
  try {
    const k = Math.min(1, MAX_EDGE / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * k));
    const h = Math.max(1, Math.round(src.height * k));
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new PhotoError('unreadable');
    ctx.drawImage(src, 0, 0, w, h);
    let blob = await encode(canvas, 'image/webp');
    // Safari cũ không mã hoá được WebP (trả rỗng hoặc PNG) → JPEG.
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg');
    if (!blob) throw new PhotoError('unreadable');
    // Ảnh xem trước giải mã từ chính bản sẽ gửi, để thiệp xem trước khớp với ảnh chủ cây thấy.
    const [bitmap, base64] = await Promise.all([bitmapFromBlob(blob), toBase64(blob)]);
    return { bitmap, base64 };
  } catch (e) {
    throw e instanceof PhotoError ? e : new PhotoError('unreadable');
  } finally {
    src.close?.();
  }
}
