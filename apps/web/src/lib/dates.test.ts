import { describe, expect, it } from 'vitest';
import { vnDate, vnLastDay } from './dates';

describe('dates', () => {
  it('ngày theo giờ Việt Nam, dạng dd/mm/yyyy', () => {
    expect(vnDate('2027-01-06T17:00:00.000Z')).toBe('07/01/2027');
    expect(vnDate('2027-01-06T17:00:00.000Z', false)).toBe('07/01');
  });
  it('ngày cuối còn chạy là ngày trước mốc kết thúc', () => {
    expect(vnLastDay('2026-12-31T17:00:00.000Z')).toBe('31/12');
  });
});
