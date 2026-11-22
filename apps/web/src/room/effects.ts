// Hiệu ứng chạm đồ vật (G6, đặc tả 6.6.1) — danh sách và hạt lấy từ bản thiết kế canvas (build-board-free.mjs).
import type { RoomItem } from '@ctln/shared';
import { catalog } from '../lib/catalog';

export type Burst = 'confetti' | 'spark' | 'heart' | 'snow' | 'star' | 'note';
export type Fx = { cls: string; burst?: Burst; say?: string };
export type Particle = { dx: number; dy: number; r: number; d: string; c: string; cls: Burst };

export const GIFT_FX: Fx[] = [
  { cls: 'g-hop', burst: 'confetti' },
  { cls: 'g-shake', say: 'Lắc lắc... có gì nhỉ?' },
  { cls: 'g-spin', burst: 'spark' },
  { cls: 'g-squash', burst: 'heart' },
  { cls: 'g-pop', burst: 'snow', say: 'Bất ngờ chưa!' },
  { cls: 'g-wobble', burst: 'star' },
];

/** `say: '@'` được thay bằng tiếng kêu theo loài (`SOUND`). */
export const PET_FX: Fx[] = [
  { cls: 'pop' },
  { cls: 'p-talk', say: '@' },
  { cls: 'p-dance', burst: 'note' },
  { cls: 'p-spin', burst: 'spark' },
  { cls: 'p-sleep', say: 'Zzz...' },
  { cls: 'p-jump', burst: 'star', say: 'Yay!' },
];

export const FIRE_FX: Fx = { cls: 'fx-fire', burst: 'spark' };

const SOUND: Record<string, string> = {
  cat: 'Meo~', dog: 'Gâu gâu!', deer: 'Hí hí!', bear: 'Ôm cái nào!', owl: 'Hú hú~', penguin: 'Lạch bạch~',
};

/** Đếm vòng theo từng món: chạm liên tiếp một món không lặp kiểu. */
export function createFxCycler(): { next(item: RoomItem): Fx | null } {
  const count = new Map<string, number>();
  const step = (item: RoomItem, list: Fx[]) => {
    const i = ((count.get(item.clientId) ?? -1) + 1) % list.length;
    count.set(item.clientId, i);
    return list[i]!;
  };
  return {
    next(item) {
      const kind = catalog.items[item.type]?.tapEffects;
      if (kind === 'fire') return FIRE_FX;
      if (kind === 'gift') return step(item, GIFT_FX);
      if (kind === 'pet') {
        const fx = step(item, PET_FX);
        return fx.say === '@' ? { ...fx, say: SOUND[item.variant] ?? '' } : fx;
      }
      return null;
    },
  };
}

const PCOL: Record<Burst, string[]> = {
  confetti: ['#D94B4B', '#F4C542', '#3E9468', '#78B1E0', '#F6A3BA', '#FFFFFF'],
  spark: ['#FFE48A', '#FFFFFF', '#FFD24A'],
  heart: ['#FF6B81', '#F6A3BA', '#E94B6A'],
  snow: ['#FFFFFF', '#E6F3F8'],
  star: ['#FFD24A', '#FFE48A'],
  note: ['#FFF6E5', '#FFD86B', '#F6A3BA'],
};

/** Hạt bung ra theo hình quạt, xác định theo `seed` (thuật toán `parts()` của canvas). */
export function parts(kind: Burst, seed: number): Particle[] {
  const out: Particle[] = [];
  const n = kind === 'confetti' ? 16 : 10;
  let s0 = seed || 1;
  const r = () => {
    s0 = (s0 * 9301 + 49297) % 233280;
    return s0 / 233280;
  };
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.08 + (0.84 * (i + r() * 0.6)) / n);
    const R = 90 + r() * 110;
    const c = PCOL[kind][Math.floor(r() * PCOL[kind].length)]!;
    out.push({
      dx: Math.round(-Math.cos(a) * R),
      dy: Math.round(-Math.sin(a) * R - 30 + (kind === 'snow' || kind === 'confetti' ? 60 * r() : 0)),
      r: Math.round((r() - 0.5) * 540),
      d: (r() * 0.18).toFixed(2),
      c,
      cls: kind,
    });
  }
  return out;
}
