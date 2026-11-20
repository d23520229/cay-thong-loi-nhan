import { ornamentSVGSoft, slotBubbleSVG } from '@ctln/art/ornaments';
import { catalog } from '../lib/catalog';
import type { SlotRect } from './geometry';
import type { SlotView } from './slots';

type Props = {
  rects: SlotRect[];
  views: SlotView[];
  fx: Record<number, 'ring' | 'drop-in'>;
  onTap: (index: number) => void;
  /** Giai đoạn không cho ghi: không hiện bong bóng trống. */
  hideEmpty?: boolean;
};

// Tên lớp riêng (không trùng room-animations.css, xem styles.test.ts).
const FX_CLASS = { ring: 'gs-ring', 'drop-in': 'gs-drop' } as const;

const name = (k?: string) => (k && catalog.ornaments[k]?.name) || 'Phụ kiện';

function label(v: SlotView): string {
  if (v.kind === 'empty') return 'Điểm trống, chạm để treo lời nhắn';
  if (v.kind === 'mine' || v.kind === 'mineExpired') return `Lời nhắn của bạn: ${name(v.ornament)}`;
  return `${name(v.ornament)} đã treo`;
}

/** Bong bóng "+" và phụ kiện đã treo, trong toạ độ phòng (đặc tả 6.6.1). Chuỗi SVG tĩnh từ @ctln/art. */
export function SlotsLayer({ rects, views, fx, onTap, hideEmpty }: Props) {
  return (
    <div className="gs-slots">
      {rects.map((r) => {
        const v = views[r.index];
        if (!v || (hideEmpty && v.kind === 'empty')) return null;
        const svg = v.kind === 'empty' ? slotBubbleSVG() : ornamentSVGSoft(v.ornament ?? 'ball', 'filled', null);
        const cls = ['gs-slot', v.kind === 'mine' || v.kind === 'mineExpired' ? 'is-mine' : '', fx[r.index] ? FX_CLASS[fx[r.index]!] : ''].filter(Boolean).join(' ');
        return (
          <button
            key={r.index}
            type="button"
            className={cls}
            aria-label={label(v)}
            style={{ left: r.left, top: r.top, width: r.size, height: r.size }}
            onClick={() => onTap(r.index)}
          >
            <svg viewBox="-30 -6 60 60" width="100%" height="100%" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
          </button>
        );
      })}
    </div>
  );
}
