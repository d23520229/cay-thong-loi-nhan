import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomStage } from './RoomStage';
import { defaultRoom } from './model';

let callback: () => void = () => {};
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) { callback = cb; }
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 390 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 844 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

describe('RoomStage', () => {
  it('co phòng theo vùng đo được và báo fit', () => {
    const onFit = vi.fn();
    const { container } = render(<RoomStage room={defaultRoom()} reserveTop={56} onFit={onFit} />);
    expect(callback).toBeTypeOf('function');
    const scaled = container.querySelector<HTMLElement>('[style*="transform: scale"]')!;
    expect(parseFloat(scaled.style.transform.replace('scale(', ''))).toBeCloseTo(0.5417, 3);
    expect(onFit).toHaveBeenLastCalledWith(expect.objectContaining({ width: 390, top: 56 }));
    expect(container.querySelectorAll('.item')).toHaveLength(7);
  });

  it('reserveBottom: phòng không lấn vào vùng chừa phía dưới', () => {
    const onFit = vi.fn();
    render(<RoomStage room={defaultRoom()} reserveTop={56} reserveBottom={400} onFit={onFit} />);
    const fit = onFit.mock.lastCall![0];
    expect(fit.top).toBe(56);
    expect(fit.top + fit.height).toBeLessThanOrEqual(844 - 400);
  });
});

describe('RoomStage chuyển động', () => {
  const world = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-room-world]')!;

  it('lúc vào trang và khi đổi cỡ: phòng hiện thẳng, không chuyển động', () => {
    const { container, rerender } = render(<RoomStage room={defaultRoom()} camera={null} />);
    expect(world(container).style.transition).toBe('');
    callback();
    rerender(<RoomStage room={defaultRoom()} camera={null} reserveTop={56} />);
    expect(world(container).style.transition).toBe('');
  });

  it('chỉ chuyển động 0,9 giây khi zoom vào / ra cây', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<RoomStage room={defaultRoom()} camera={null} />);
      rerender(<RoomStage room={defaultRoom()} camera={{ x: -100, y: -50, scale: 1.2 }} />);
      expect(world(container).style.transition).toContain('transform');
      act(() => vi.advanceTimersByTime(1000));
      expect(world(container).style.transition).toBe('');
      rerender(<RoomStage room={defaultRoom()} camera={null} />);
      expect(world(container).style.transition).toContain('transform');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('RoomStage camera và overlay', () => {
  const world = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-room-world]')!;

  it('camera đặt transform translate+scale', () => {
    const { container } = render(<RoomStage room={defaultRoom()} camera={{ x: -100, y: -50, scale: 1.2 }} />);
    expect(world(container).style.transform).toBe('translate(-100px, -50px) scale(1.2)');
  });

  it('không camera giữ cách co cũ', () => {
    const { container } = render(<RoomStage room={defaultRoom()} />);
    expect(world(container).style.transform).toMatch(/^scale\([\d.]+\)$/);
    expect(world(container).style.transform).not.toContain('-100px');
  });

  it('chế độ Xem (có prop camera): khung phòng cắt phần tràn ra ngoài', () => {
    const { container } = render(<RoomStage room={defaultRoom()} camera={{ x: -100, y: -50, scale: 1.2 }} />);
    expect(world(container).parentElement!.style.overflow).toBe('hidden');
    const edit = render(<RoomStage room={defaultRoom()} />);
    expect(world(edit.container).parentElement!.style.overflow).toBe('');
  });

  it('overlay nằm trong khung phòng', () => {
    const { container } = render(<RoomStage room={defaultRoom()} overlay={<div data-testid="ov" />} />);
    expect(world(container).querySelector('[data-testid="ov"]')).not.toBeNull();
  });
});
