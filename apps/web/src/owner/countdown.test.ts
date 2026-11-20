import { describe, expect, it } from 'vitest';
import { countdownText, formatSentAt } from './countdown';

const M = 60_000, H = 60 * M, D = 24 * H;

describe('countdownText', () => {
  it('nhiều ngày', () => expect(countdownText(3 * D + 5 * H + 10 * M)).toBe('Còn 3 ngày 5 giờ nữa là mở quà'));
  it('dưới 1 ngày', () => expect(countdownText(5 * H + 11 * M + 30_000)).toBe('Còn 5 giờ 12 phút nữa là mở quà'));
  it('dưới 1 giờ, làm tròn lên tối thiểu 1 phút', () => {
    expect(countdownText(30_000)).toBe('Còn 1 phút nữa là mở quà');
    expect(countdownText(42 * M)).toBe('Còn 42 phút nữa là mở quà');
  });
  it('hết giờ', () => {
    expect(countdownText(0)).toBe('Quà đã mở!');
    expect(countdownText(-5)).toBe('Quà đã mở!');
  });
});

describe('formatSentAt', () => {
  it('giờ Việt Nam, không phụ thuộc múi giờ máy', () => {
    expect(formatSentAt('2026-11-21T13:05:00Z')).toBe('21/11 lúc 20:05');
    expect(formatSentAt('2026-12-23T17:30:00Z')).toBe('24/12 lúc 00:30');
  });
});
