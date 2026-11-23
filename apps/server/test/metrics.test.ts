import { describe, it, expect } from 'vitest';
import { LatencyTracker } from '../src/metrics.js';

const T0 = new Date('2026-12-01T10:00:00Z');
const plus = (ms: number) => new Date(T0.getTime() + ms);

describe('LatencyTracker', () => {
  it('p95 của 1..100 ms là 95', () => {
    const l = new LatencyTracker(T0);
    for (let i = 1; i <= 100; i++) l.record(i, plus(i * 1000));
    expect(l.p95(plus(200_000)).p95Ms).toBe(95);
  });
  it('chưa có số liệu → null; since = lúc khởi động khi chưa đủ 60 phút', () => {
    const l = new LatencyTracker(T0);
    const r = l.p95(plus(5 * 60_000));
    expect(r.p95Ms).toBeNull();
    expect(r.since).toEqual(T0);
  });
  it('bỏ số đo cũ hơn 60 phút; since = now − 60 phút', () => {
    const l = new LatencyTracker(T0);
    l.record(5000, T0);
    l.record(10, plus(70 * 60_000));
    const r = l.p95(plus(70 * 60_000));
    expect(r.p95Ms).toBe(10);
    expect(r.since).toEqual(plus(10 * 60_000));
  });
});
