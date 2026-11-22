import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCard } from './download';

const blob = new Blob(['x'], { type: 'image/png' });
const setNav = (o: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(o)) Object.defineProperty(navigator, k, { value: v, configurable: true });
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const k of ['canShare', 'share', 'userAgent', 'platform', 'maxTouchPoints']) delete (navigator as unknown as Record<string, unknown>)[k];
});

describe('downloadCard', () => {
  it('canShare có files → share', async () => {
    const share = vi.fn(async () => {});
    setNav({ canShare: () => true, share });
    expect(await downloadCard(blob, 'a.png')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it('không canShare → thẻ a download', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('a.png');
      expect(this.href).toBe('blob:x');
    });
    expect(await downloadCard(blob, 'a.png')).toBe('downloaded');
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('iOS (userAgent iPhone, không canShare) → window.open', async () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:y');
    URL.revokeObjectURL = vi.fn();
    setNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(await downloadCard(blob, 'a.png')).toBe('opened');
    expect(open).toHaveBeenCalledWith('blob:y', '_blank');
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:y');
  });
});
