import { beforeEach, describe, expect, it } from 'vitest';
import { storage, type MineEntry } from '../lib/storage';
import { canWrite, isFull, minutesLeft, pruneMine, slotViews } from './slots';

const NOW = Date.parse('2026-12-01T00:00:00Z');
const entry = (minutes: number, id = '1'): MineEntry => ({
  messageId: id, editToken: 't', editUntil: new Date(NOW + minutes * 60_000).toISOString(),
});

beforeEach(() => localStorage.clear());

describe('slotViews', () => {
  it('đủ 4 loại điểm', () => {
    const slots = [
      { index: 0, occupied: false },
      { index: 1, occupied: true, ornament: 'bell' },
      { index: 2, occupied: true, ornament: 'ball' },
      { index: 3, occupied: true, ornament: 'sock' },
    ];
    const v = slotViews(slots, 4, { 2: entry(5), 3: entry(-1) }, NOW);
    expect(v.map((x) => x.kind)).toEqual(['empty', 'taken', 'mine', 'mineExpired']);
    expect(v[1]!.ornament).toBe('bell');
    expect(v[2]!.mine).toEqual(entry(5));
  });

  it('điểm thiếu trong slots coi là trống; mine trên điểm trống bị bỏ qua', () => {
    const v = slotViews([{ index: 1, occupied: true, ornament: 'bell' }], 3, { 0: entry(5) }, NOW);
    expect(v.map((x) => x.kind)).toEqual(['empty', 'taken', 'empty']);
    expect(v[0]!.mine).toBeUndefined();
  });
});

describe('pruneMine', () => {
  it('xoá khoá hết hạn và khoá của điểm trống, giữ khoá còn hạn', () => {
    storage.setMine('aaaaaaaa', 0, entry(5));
    storage.setMine('aaaaaaaa', 1, entry(-1));
    storage.setMine('aaaaaaaa', 2, entry(5));
    const kept = pruneMine('aaaaaaaa', [{ index: 0, occupied: true, ornament: 'ball' }, { index: 1, occupied: true }, { index: 2, occupied: false }], NOW);
    expect(kept).toEqual({ 0: entry(5) });
    expect(localStorage.getItem('msg:aaaaaaaa:1')).toBeNull();
    expect(localStorage.getItem('msg:aaaaaaaa:2')).toBeNull();
    expect(localStorage.getItem('msg:aaaaaaaa:0')).not.toBeNull();
  });

  it('khoá JSON hỏng bị dọn, không ném lỗi', () => {
    localStorage.setItem('msg:aaaaaaaa:3', '{x');
    expect(pruneMine('aaaaaaaa', [{ index: 3, occupied: true }], NOW)).toEqual({});
    expect(localStorage.getItem('msg:aaaaaaaa:3')).toBeNull();
  });
});

describe('phụ trợ', () => {
  it('canWrite chỉ BUILD và OPEN', () => {
    expect(['BUILD', 'OPEN', 'NOTICE', 'ENDED'].map(canWrite)).toEqual([true, true, false, false]);
  });
  it('isFull khi không còn điểm trống', () => {
    expect(isFull(slotViews([{ index: 0, occupied: true }], 1, {}, NOW))).toBe(true);
    expect(isFull(slotViews([], 1, {}, NOW))).toBe(false);
  });
  it('minutesLeft làm tròn lên, tối thiểu 1', () => {
    expect(minutesLeft(new Date(NOW + 14 * 60_000 + 10_000).toISOString(), NOW)).toBe(15);
    expect(minutesLeft(new Date(NOW + 5_000).toISOString(), NOW)).toBe(1);
  });
});
