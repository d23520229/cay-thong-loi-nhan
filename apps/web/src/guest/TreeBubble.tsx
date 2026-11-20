import type { Room } from '@ctln/shared';
import { catalog } from '../lib/catalog';
import { bubblePlacement } from './geometry';

/**
 * Bong bóng thoại "cây nói" (đặc tả 6.6.1, sửa 21/11): cao 2/3 cây tính từ gốc, nằm phía không có cây
 * để không tràn khỏi phòng; vẽ trong toạ độ phòng (overlay của RoomStage) nên đi theo phòng.
 */
export function TreeBubble({ room, text }: { room: Room; text: string }) {
  const p = bubblePlacement(room);
  const style =
    p.side === 'right'
      ? { left: p.x, top: p.y, maxWidth: p.maxWidth }
      : { right: catalog.room.w - p.x, top: p.y, maxWidth: p.maxWidth };
  return (
    <div className={`gs-bubble gs-bubble--${p.side}`} style={style}>
      {text}
      {/* Hai chấm mây nhỏ dẫn về phía cây (kiểu đám mây suy nghĩ trong truyện tranh). */}
      <span className="gs-bubble-dot gs-bubble-dot--big" aria-hidden="true" />
      <span className="gs-bubble-dot gs-bubble-dot--small" aria-hidden="true" />
    </div>
  );
}
