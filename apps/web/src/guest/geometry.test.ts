import { describe, expect, it } from 'vitest';
import { layoutSlots, type Room } from '@ctln/shared';
import { fitRoom } from '../room/fit';
import { defaultRoom } from '../room/model';
import { slotRects, zoomCamera } from './geometry';

const withTree = (over: Partial<{ x: number; y: number; scale: number; flip: boolean }>): Room => {
  const r = defaultRoom();
  return { ...r, items: r.items.map((i) => (i.type === 'tree' ? { ...i, ...over } : i)) };
};
const treeOf = (r: Room) => r.items.find((i) => i.type === 'tree')!;
const centerX = (s: { left: number; size: number }) => s.left + s.size / 2;

describe('slotRects', () => {
  it('trả đúng số điểm = tree.slotCount', () => {
    expect(slotRects(defaultRoom())).toHaveLength(12);
  });

  it('phòng mặc định: điểm 0 khớp công thức', () => {
    const r = withTree({ x: 492, y: 912, scale: 1, flip: false });
    const L = layoutSlots(r.tree.shape, 12);
    const p = L.slots[0]!;
    const k = 1.2;
    const size = 60 * L.scale * k;
    const s = slotRects(r)[0]!;
    expect(s.index).toBe(0);
    expect(s.size).toBeCloseTo(size);
    expect(s.left).toBeCloseTo(492 - 200 * k + p.x * k - size / 2);
    expect(s.top).toBeCloseTo(912 - 538 * k + p.y * k - 6 * L.scale * k);
  });

  it('cây lật: điểm đối xứng qua trục cây', () => {
    const a = slotRects(withTree({ x: 400, flip: false }));
    const b = slotRects(withTree({ x: 400, flip: true }));
    a.forEach((s, i) => expect(centerX(b[i]!)).toBeCloseTo(2 * 400 - centerX(s)));
  });

  it('cây scale 0.5: mọi điểm nằm trong hộp món cây', () => {
    const r = withTree({ x: 300, y: 1000, scale: 0.5 });
    const t = treeOf(r);
    for (const s of slotRects(r)) {
      expect(s.left).toBeGreaterThanOrEqual(t.x - 240 * 0.5);
      expect(s.left + s.size).toBeLessThanOrEqual(t.x + 240 * 0.5);
      expect(s.top).toBeGreaterThanOrEqual(t.y - 645.6 * 0.5);
      expect(s.top + s.size).toBeLessThanOrEqual(t.y + 74.4 * 0.5);
    }
  });
});

describe('zoomCamera', () => {
  it('tâm cây ra giữa vùng', () => {
    const r = withTree({ x: 492, y: 912, scale: 1 });
    const c = zoomCamera(r, 390, 844);
    const cx = 492, cy = 912 - 300 * 1.2;
    expect(cx * c.scale + c.x).toBeCloseTo(390 / 2);
    expect(cy * c.scale + c.y).toBeCloseTo(844 / 2);
    expect(c.scale).toBeCloseTo(fitRoom(390, 844).scale * 1.6);
  });

  it('cây nhỏ 0.5 dùng max(0.8) → zf = 2', () => {
    const c = zoomCamera(withTree({ scale: 0.5 }), 390, 844);
    expect(c.scale).toBeCloseTo(fitRoom(390, 844).scale * 2);
  });
});
