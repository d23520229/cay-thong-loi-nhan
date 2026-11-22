import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PICK_MAX_BYTES, PhotoError, preparePhoto } from './photo';

const bmp = (width: number, height: number) => ({ width, height, close: vi.fn() });
const file = (size = 10, type = 'image/jpeg') => {
  const f = new File(['x'], 'a.jpg', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

let drawn: { w: number; h: number }[];
let toBlob: ReturnType<typeof vi.fn>;
beforeEach(() => {
  drawn = [];
  // jsdom không có OffscreenCanvas → dùng canvas của document.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return { drawImage: () => drawn.push({ w: this.width, h: this.height }) } as never;
  });
  toBlob = vi.fn((cb: BlobCallback, type?: string) => cb(new Blob(['abc'], { type })));
  HTMLCanvasElement.prototype.toBlob = toBlob as never;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('preparePhoto', () => {
  it('file > 20 MB → too_big', async () => {
    const cib = vi.fn();
    vi.stubGlobal('createImageBitmap', cib);
    const e = await preparePhoto(file(PICK_MAX_BYTES + 1)).catch((x) => x);
    expect(e).toBeInstanceOf(PhotoError);
    expect(e.code).toBe('too_big');
    expect(cib).not.toHaveBeenCalled();
  });

  it('createImageBitmap ném lỗi (HEIC) → unreadable', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new DOMException('x', 'InvalidStateError'); }));
    const e = await preparePhoto(file(10, 'image/heic')).catch((x) => x);
    expect(e).toBeInstanceOf(PhotoError);
    expect(e.code).toBe('unreadable');
  });

  it('ảnh 4000×3000 → canvas 1600×1200; xoay theo EXIF; trả base64 không có tiền tố data:', async () => {
    const src = bmp(4000, 3000);
    const out = bmp(1600, 1200);
    const cib = vi.fn(async (b: unknown, _opts?: unknown) => (b instanceof File ? src : out));
    vi.stubGlobal('createImageBitmap', cib);
    const p = await preparePhoto(file());
    expect(drawn).toEqual([{ w: 1600, h: 1200 }]);
    expect(cib.mock.calls[0]![1]).toEqual({ imageOrientation: 'from-image' });
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.85);
    expect(p.base64).toBe(btoa('abc'));
    expect(p.bitmap).toBe(out);
    expect(src.close).toHaveBeenCalled();
  });

  it('ảnh nhỏ giữ nguyên cỡ', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp(800, 1000)));
    await preparePhoto(file());
    expect(drawn).toEqual([{ w: 800, h: 1000 }]);
  });

  it('toBlob webp rỗng → dùng jpeg', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp(100, 100)));
    toBlob.mockImplementationOnce((cb: BlobCallback) => cb(null));
    await preparePhoto(file());
    expect(toBlob).toHaveBeenCalledTimes(2);
    expect(toBlob.mock.calls[1]!.slice(1)).toEqual(['image/jpeg', 0.85]);
  });

  it('trình duyệt trả PNG thay webp → dùng jpeg', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp(100, 100)));
    toBlob.mockImplementationOnce((cb: BlobCallback) => cb(new Blob(['p'], { type: 'image/png' })));
    await preparePhoto(file());
    expect(toBlob.mock.calls[1]!.slice(1)).toEqual(['image/jpeg', 0.85]);
  });

  it('createImageBitmap không nhận tuỳ chọn (TypeError) → thử lại không tuỳ chọn', async () => {
    const cib = vi.fn(async (_b: unknown, opts?: unknown) => {
      if (opts) throw new TypeError('no options');
      return bmp(100, 100);
    });
    vi.stubGlobal('createImageBitmap', cib);
    await expect(preparePhoto(file())).resolves.toBeTruthy();
  });
});
