import { describe, expect, it } from 'vitest';
import type { RoomItem } from '@ctln/shared';
import { createFxCycler, FIRE_FX, GIFT_FX, PET_FX, parts } from './effects';

const item = (type: string, variant: string, clientId = type): RoomItem =>
  ({ clientId, type, variant, x: 0, y: 900, scale: 1, flip: false }) as RoomItem;

describe('createFxCycler', () => {
  it('quà: 6 lần chạm liên tiếp ra 6 class khác nhau, lần 7 quay lại g-hop', () => {
    const c = createFxCycler();
    const g = item('gift', 'blue');
    const seen = Array.from({ length: 7 }, () => c.next(g)!.cls);
    expect(new Set(seen.slice(0, 6)).size).toBe(6);
    expect(seen.slice(0, 6)).toEqual(GIFT_FX.map((f) => f.cls));
    expect(seen[6]).toBe('g-hop');
  });

  it('đếm riêng từng món', () => {
    const c = createFxCycler();
    expect(c.next(item('gift', 'blue', 'a'))!.cls).toBe('g-hop');
    expect(c.next(item('stack', 'warm', 'b'))!.cls).toBe('g-hop');
  });

  it("thú cưng mèo: p-talk nói 'Meo~'", () => {
    const c = createFxCycler();
    const cat = item('pet', 'cat');
    c.next(cat);
    expect(c.next(cat)).toEqual({ cls: 'p-talk', say: 'Meo~' });
    expect(PET_FX).toHaveLength(6);
  });

  it('lò sưởi luôn fx-fire; cửa sổ/thảm/cây → null', () => {
    const c = createFxCycler();
    const f = item('fireplace', 'classic');
    expect(c.next(f)).toEqual(FIRE_FX);
    expect(c.next(f)).toEqual(FIRE_FX);
    expect(c.next(item('window', 'wood'))).toBeNull();
    expect(c.next(item('rug', 'plaid'))).toBeNull();
    expect(c.next(item('tree', 'main'))).toBeNull();
  });
});

describe('parts', () => {
  it('cùng seed cho cùng kết quả; confetti 16 hạt, loại khác 10', () => {
    expect(parts('heart', 7)).toEqual(parts('heart', 7));
    expect(parts('heart', 7)).not.toEqual(parts('heart', 8));
    expect(parts('confetti', 3)).toHaveLength(16);
    expect(parts('star', 3)).toHaveLength(10);
    expect(parts('star', 3)[0]!.cls).toBe('star');
  });
});
