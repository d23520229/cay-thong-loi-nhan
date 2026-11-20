import { layoutSlots, type Room } from '@ctln/shared';
import { catalog } from '../lib/catalog';
import { fitRoom } from '../room/fit';

/** Một điểm nhắn trong toạ độ phòng 720×1080 (đặc tả 6.6.1 "Zoom vào cây"). */
export type SlotRect = { index: number; left: number; top: number; size: number };
/** translate (px trong vùng sân khấu) + scale của khung phòng 720×1080. */
export type Camera = { x: number; y: number; scale: number };

const FRAME = catalog.tree.frame; // khung cây 400×600, chân ở baseY, phóng scaleInRoom khi vào phòng

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

/** Camera đưa giữa tán cây ra giữa vùng `areaW × areaH`. */
export function zoomCamera(room: Room, areaW: number, areaH: number): Camera {
  const t = treeItem(room);
  const zf = 1.6 / Math.max(0.8, t.scale);
  const cx = t.x;
  const cy = t.y - 300 * FRAME.scaleInRoom * t.scale;
  const scale = fitRoom(areaW, areaH).scale * zf;
  return { x: areaW / 2 - cx * scale, y: areaH / 2 - cy * scale, scale };
}
