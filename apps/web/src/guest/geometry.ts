import { layoutSlots, type Room } from '@ctln/shared';
import { catalog } from '../lib/catalog';
import type { Fit } from '../room/fit';

/** Một điểm nhắn trong toạ độ phòng 720×1080 (đặc tả 6.6.1 "Zoom vào cây"). */
export type SlotRect = { index: number; left: number; top: number; size: number };
/** translate (px, tính trong khung phòng `fit`) + scale của phòng 720×1080. */
export type Camera = { x: number; y: number; scale: number };

const FRAME = catalog.tree.frame; // khung cây 400×600, chân ở baseY, phóng scaleInRoom khi vào phòng
const RW = catalog.room.w, RH = catalog.room.h;

const treeItem = (room: Room) => {
  const t = room.items.find((i) => i.type === 'tree');
  if (!t) throw new Error('Phòng không có cây thông');
  return t;
};

/** Vị trí từng điểm nhắn theo vị trí, cỡ, lật của cây (công thức của bản thiết kế canvas). */
export function slotRects(room: Room): SlotRect[] {
  const t = treeItem(room);
  const L = layoutSlots(room.tree.shape, room.tree.slotCount) as { scale: number; slots: { x: number; y: number }[] };
  const k = FRAME.scaleInRoom * t.scale;
  const tl = t.x - (FRAME.w / 2) * k;
  const tt = t.y - FRAME.baseY * k;
  const size = 60 * L.scale * k;
  return L.slots.map((p, index) => {
    const px = t.flip ? FRAME.w - p.x : p.x;
    return { index, left: tl + px * k - size / 2, top: tt + p.y * k - 6 * L.scale * k, size };
  });
}

const MARGIN = 0.04; // chừa 4% mỗi phía quanh cây
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Camera zoom vào cây (đặc tả 6.6.1, sửa 21/11): cả cây từ gốc tới ngọn vừa trong khung `fit` (khung phòng giữ nguyên cỡ,
 * phần ngoài khung bị che); không thu nhỏ hơn lúc chưa zoom; không nhìn ra ngoài phòng.
 * Toạ độ camera tính trong khung `fit` (góc trên trái của khung là 0, 0).
 */
export function zoomCamera(room: Room, fit: Fit): Camera {
  const t = treeItem(room);
  const k = FRAME.scaleInRoom * t.scale;
  // Hộp cây: ngang cả khung cây, dọc từ đỉnh khung (trên ngôi sao) tới gốc thân; phần ngoài phòng vốn đã bị cắt.
  const w = FRAME.w * k, h = (FRAME.baseY + 20) * k;
  const left = clamp(t.x - w / 2 - w * MARGIN, 0, RW);
  const right = clamp(t.x + w / 2 + w * MARGIN, 0, RW);
  const top = clamp(t.y - FRAME.baseY * k - h * MARGIN, 0, RH);
  const bottom = clamp(t.y + 20 * k + h * MARGIN, 0, RH);
  const scale = Math.max(fit.scale, Math.min(fit.width / (right - left), fit.height / (bottom - top)));
  const x = clamp(fit.width / 2 - ((left + right) / 2) * scale, fit.width - RW * scale, 0);
  const y = clamp(fit.height / 2 - ((top + bottom) / 2) * scale, fit.height - RH * scale, 0);
  return { x, y, scale };
}

export type BubblePlacement = {
  /** Bong bóng nằm phía nào của cây (ngược với nửa phòng chứa cây, để không tràn ra ngoài). */
  side: 'left' | 'right';
  /** Điểm đuôi bong bóng chỉ vào (cạnh tán cây), toạ độ phòng. */
  x: number;
  /** Tâm dọc của bong bóng: cao 2/3 cây tính từ gốc. */
  y: number;
  /** Bề rộng tối đa để bong bóng không vượt mép phòng. */
  maxWidth: number;
};

const EDGE = 12;

/** Vị trí bong bóng thoại "cây nói" (đặc tả 6.6.1, sửa 21/11). */
export function bubblePlacement(room: Room): BubblePlacement {
  const t = treeItem(room);
  const k = FRAME.scaleInRoom * t.scale;
  const y = clamp(t.y - (2 / 3) * FRAME.baseY * k, 60, RH - 60);
  const reach = 0.27 * FRAME.w * k; // ra gần mép tán ở độ cao đó
  if (t.x < RW / 2) {
    const x = Math.min(RW - EDGE - 120, t.x + reach);
    return { side: 'right', x, y, maxWidth: RW - EDGE - x };
  }
  const x = Math.max(EDGE + 120, t.x - reach);
  return { side: 'left', x, y, maxWidth: x - EDGE };
}
