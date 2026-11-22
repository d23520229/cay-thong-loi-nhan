import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClock, serverNow, syncClock } from './clock';

afterEach(() => {
  resetClock();
  vi.useRealTimers();
});

describe('clock', () => {
  it('serverNow cộng độ lệch', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
    syncClock('2026-12-26T00:00:00Z');
    expect(serverNow()).toBe(Date.parse('2026-12-26T00:00:00Z'));
    resetClock();
    expect(serverNow()).toBe(Date.now());
  });
  it('chuỗi giờ hỏng thì giữ độ lệch 0', () => {
    syncClock('không phải giờ');
    expect(Math.abs(serverNow() - Date.now())).toBeLessThan(5);
  });
});
