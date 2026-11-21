import type { PublicRoom } from '../lib/api';
import { storage, type MineEntry } from '../lib/storage';

export type SlotKind = 'empty' | 'taken' | 'mine' | 'mineExpired';
export type SlotView = { index: number; kind: SlotKind; ornament?: string; mine?: MineEntry };
type Slots = PublicRoom['slots'];

const alive = (e: MineEntry, nowMs: number) => nowMs < Date.parse(e.editUntil);

/** Trạng thái từng điểm 0…slotCount−1 với khách trên máy này. */
export function slotViews(slots: Slots, slotCount: number, mine: Record<number, MineEntry>, nowMs: number): SlotView[] {
  const byIndex = new Map(slots.map((s) => [s.index, s]));
  return Array.from({ length: slotCount }, (_, index): SlotView => {
    const s = byIndex.get(index);
    if (!s?.occupied) return { index, kind: 'empty' };
    const m = mine[index];
    if (!m) return { index, kind: 'taken', ornament: s.ornament };
    return { index, kind: alive(m, nowMs) ? 'mine' : 'mineExpired', ornament: s.ornament, mine: m };
  });
}

/** Chỉ BUILD và OPEN cho treo/sửa lời nhắn (đặc tả 5). */
export const canWrite = (phase: string): boolean => phase === 'BUILD' || phase === 'OPEN';

export const isFull = (views: SlotView[]): boolean => views.every((v) => v.kind !== 'empty');

/** Dọn khoá `msg:` hết hạn, hỏng, hoặc của điểm giờ đã trống; trả các khoá còn dùng được. */
export function pruneMine(treeId: string, slots: Slots, nowMs: number): Record<number, MineEntry> {
  const mine = storage.listMine(treeId);
  const kept: Record<number, MineEntry> = {};
  for (const s of slots) {
    const m = mine[s.index];
    if (m && s.occupied && alive(m, nowMs)) kept[s.index] = m;
    else storage.clearMine(treeId, s.index);
  }
  return kept;
}

/** Số phút còn sửa được, làm tròn lên, tối thiểu 1. */
export const minutesLeft = (editUntil: string, nowMs: number): number =>
  Math.max(1, Math.ceil((Date.parse(editUntil) - nowMs) / 60_000));
