import { describe, expect, it } from 'vitest';
import { layoutSlots, type Room } from '@ctln/shared';
import { fitRoom } from '../room/fit';
import { defaultRoom } from '../room/model';
import { bubblePlacement, slotRects, zoomCamera } from './geometry';

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

describe('zoomCamera — trọn cây trong khung cố định', () => {
  const fit = fitRoom(390, 844, 56, 116);
  /** Vùng phòng nhìn thấy qua khung (toạ độ phòng). */
  const view = (c: { x: number; y: number; scale: number }) => ({
    left: -c.x / c.scale, top: -c.y / c.scale,
    right: (fit.width - c.x) / c.scale, bottom: (fit.height - c.y) / c.scale,
  });
  /** Hộp cây trong phòng: ngang cả khung 400, dọc từ đỉnh khung tới gốc thân + 20. */
  const treeBox = (x: number, y: number, s: number) => {
    const k = 1.2 * s;
    return { left: x - 200 * k, right: x + 200 * k, top: y - 538 * k, bottom: y + 20 * k };
  };

  it.each([
    [492, 912, 1],
    [492, 912, 0.5],
    [200, 1000, 0.7],
    [600, 850, 1.3],
  ])('cây ở (%d, %d) cỡ %d: cả cây từ gốc tới ngọn nằm trong khung', (x, y, s) => {
    const c = zoomCamera(withTree({ x, y, scale: s }), fit);
    const v = view(c);
    const b = treeBox(x, y, s);
    // Phần cây nằm trong phòng phải hiện đủ (phần tràn ra ngoài phòng vốn đã bị cắt).
    expect(v.left).toBeLessThanOrEqual(Math.max(0, b.left) + 0.01);
    expect(v.right).toBeGreaterThanOrEqual(Math.min(720, b.right) - 0.01);
    expect(v.top).toBeLessThanOrEqual(Math.max(0, b.top) + 0.01);
    expect(v.bottom).toBeGreaterThanOrEqual(Math.min(1080, b.bottom) - 0.01);
  });

  it('không nhìn ra ngoài phòng (khung luôn nằm trong 720×1080)', () => {
    for (const [x, y, s] of [[40, 1070, 0.5], [700, 820, 0.5], [360, 1000, 1]] as const) {
      const v = view(zoomCamera(withTree({ x, y, scale: s }), fit));
      expect(v.left).toBeGreaterThanOrEqual(-0.01);
      expect(v.top).toBeGreaterThanOrEqual(-0.01);
      expect(v.right).toBeLessThanOrEqual(720.01);
      expect(v.bottom).toBeLessThanOrEqual(1080.01);
    }
  });

  it('cây nhỏ thì phóng nhiều hơn cây to; không bao giờ nhỏ hơn lúc chưa zoom', () => {
    const small = zoomCamera(withTree({ scale: 0.5 }), fit).scale;
    const big = zoomCamera(withTree({ scale: 1.6 }), fit).scale;
    expect(small).toBeGreaterThan(big);
    expect(big).toBeGreaterThanOrEqual(fit.scale);
  });

  it('cây không chạm mép phòng thì nằm giữa khung', () => {
    const c = zoomCamera(withTree({ x: 360, y: 800, scale: 0.6 }), fit);
    const b = treeBox(360, 800, 0.6);
    expect(((b.left + b.right) / 2) * c.scale + c.x).toBeCloseTo(fit.width / 2, 0);
    expect(((b.top + b.bottom) / 2) * c.scale + c.y).toBeCloseTo(fit.height / 2, 0);
  });
});

describe('bubblePlacement — bong bóng thoại của cây', () => {
  it('cây nửa trái → bong bóng bên phải cây; cây nửa phải → bên trái', () => {
    const l = bubblePlacement(withTree({ x: 200, y: 950, scale: 1 }));
    expect(l.side).toBe('right');
    expect(l.x).toBeGreaterThan(200);
    const r = bubblePlacement(withTree({ x: 520, y: 950, scale: 1 }));
    expect(r.side).toBe('left');
    expect(r.x).toBeLessThan(520);
  });

  it('cách xa cây: điểm đuôi ra ngoài mép tán ít nhất 0,35 bề ngang khung cây + 24', () => {
    const k = 1.2;
    const l = bubblePlacement(withTree({ x: 200, y: 950, scale: 1 }));
    expect(l.x - 200).toBeGreaterThanOrEqual(0.35 * 400 * k + 24 - 0.01);
    const r = bubblePlacement(withTree({ x: 520, y: 950, scale: 1 }));
    expect(520 - r.x).toBeGreaterThanOrEqual(0.35 * 400 * k + 24 - 0.01);
  });

  it('cao 2/3 cây tính từ gốc', () => {
    const p = bubblePlacement(withTree({ x: 200, y: 1000, scale: 0.8 }));
    const k = 1.2 * 0.8;
    expect(p.y).toBeCloseTo(1000 - (2 / 3) * 538 * k);
  });

  it('bề rộng tối đa không vượt mép phòng', () => {
    const l = bubblePlacement(withTree({ x: 300, y: 950, scale: 1.2 }));
    expect(l.x + l.maxWidth).toBeLessThanOrEqual(720);
    const r = bubblePlacement(withTree({ x: 420, y: 950, scale: 1.2 }));
    expect(r.x - r.maxWidth).toBeGreaterThanOrEqual(0);
  });
});
