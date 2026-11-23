import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCard } from './download';

const blob = new Blob(['x'], { type: 'image/png' });
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const setNav = (o: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(o)) Object.defineProperty(navigator, k, { value: v, configurable: true });
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const k of ['canShare', 'share', 'userAgent', 'platform', 'maxTouchPoints']) delete (navigator as unknown as Record<string, unknown>)[k];
});

describe('downloadCard', () => {
  it('iOS + canShare có files → share', async () => {
    const share = vi.fn(async () => {});
    setNav({ userAgent: IOS, canShare: () => true, share });
    expect(await downloadCard(blob, 'a.png')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it('không phải iOS dù có canShare → thẻ a download, thu hồi URL sau 1 giây', async () => {
    vi.useFakeTimers();
    const share = vi.fn();
    setNav({ canShare: () => true, share });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('a.png');
      expect(this.href).toBe('blob:x');
    });
    expect(await downloadCard(blob, 'a.png')).toBe('downloaded');
    expect(click).toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('iOS không canShare → window.open', async () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:y');
    URL.revokeObjectURL = vi.fn();
    setNav({ userAgent: IOS });
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    expect(await downloadCard(blob, 'a.png')).toBe('opened');
    expect(open).toHaveBeenCalledWith('blob:y', '_blank');
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:y');
  });

  it('iOS share bị huỷ (AbortError) → cancelled, không mở gì', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('x', 'AbortError');
    });
    setNav({ userAgent: IOS, canShare: () => true, share });
    const open = vi.spyOn(window, 'open');
    expect(await downloadCard(blob, 'a.png')).toBe('cancelled');
    expect(open).not.toHaveBeenCalled();
  });

  it('iOS share lỗi khác → rơi về window.open', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:z');
    URL.revokeObjectURL = vi.fn();
    const share = vi.fn(async () => {
      throw new DOMException('x', 'NotAllowedError');
    });
    setNav({ userAgent: IOS, canShare: () => true, share });
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    expect(await downloadCard(blob, 'a.png')).toBe('opened');
    expect(open).toHaveBeenCalled();
  });

  it('iOS window.open trả null → ném lỗi', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:n');
    URL.revokeObjectURL = vi.fn();
    setNav({ userAgent: IOS });
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(downloadCard(blob, 'a.png')).rejects.toThrow();
  });
});
