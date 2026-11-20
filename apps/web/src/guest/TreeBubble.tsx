import type { CSSProperties } from 'react';
import type { Room } from '@ctln/shared';
import { catalog } from '../lib/catalog';
import { bubblePlacement } from './geometry';

/** Nửa chu kỳ đung đưa của cây (`.sway2` 6s trong room-animations.css). */
const HALF_SWAY = '-3s';

/**
 * Bong bóng thoại "cây nói" (đặc tả 6.6.1, sửa 21/11): cao 2/3 cây tính từ gốc, nằm phía không có cây
 * để không tràn khỏi phòng; vẽ trong toạ độ phòng (overlay của RoomStage) nên đi theo phòng.
 * Khung bọc trùng khung cây và mang cùng hiệu ứng `sway2` → bong bóng đung đưa theo cây, giữ nguyên khoảng cách.
 * Luôn gắn (zoom thì chỉ ẩn) để nhịp đung đưa không lệch với cây.
 */
export function TreeBubble({ room, text, hidden = false }: { room: Room; text: string; hidden?: boolean }) {
  const t = room.items.find((i) => i.type === 'tree')!;
  const v = catalog.items.tree!.variants[t.variant]!;
  const box = { left: t.x - v.ax * t.scale, top: t.y - v.ay * t.scale, width: v.w * t.scale, height: v.h * t.scale };
  const p = bubblePlacement(room);
  const bubble: CSSProperties =
    p.side === 'right'
      ? { left: p.x - box.left, top: p.y - box.top, maxWidth: p.maxWidth }
      : { right: box.left + box.width - p.x, top: p.y - box.top, maxWidth: p.maxWidth };
  return (
    <div
      className="sway2"
      aria-hidden={hidden || undefined}
      style={{
        position: 'absolute',
        ...box,
        pointerEvents: 'none',
        visibility: hidden ? 'hidden' : undefined,
        // Cây lật (scaleX(-1)) thì vòng xoay đảo chiều = lệch nửa chu kỳ.
        animationDelay: t.flip ? HALF_SWAY : undefined,
      }}
    >
      <div className={`gs-bubble gs-bubble--${p.side}`} style={bubble}>
        {text}
        {/* Hai chấm mây nhỏ dẫn về phía cây (kiểu đám mây suy nghĩ trong truyện tranh). */}
        <span className="gs-bubble-dot gs-bubble-dot--big" aria-hidden="true" />
        <span className="gs-bubble-dot gs-bubble-dot--small" aria-hidden="true" />
      </div>
    </div>
  );
}
