import { useEffect, useRef, useState } from 'react';
import { CardCanvas } from './CardCanvas';
import type { CardData } from './draw';
import './card.css';

const PORTRAIT = '(orientation: portrait)';

/** Xem thiệp toàn màn hình; màn dọc thì xoay 90° cho thiệp nằm ngang đọc được. */
export function CardViewer({ data, onClose }: { data: CardData; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT).matches);

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT);
    const on = () => setPortrait(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      ref={ref}
      className="cd-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Thiệp"
      tabIndex={-1}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <button type="button" className="cd-close" aria-label="Đóng" onClick={(e) => { e.stopPropagation(); onClose(); }}>✕</button>
      <div className={portrait ? 'cd-stage cd-rotated' : 'cd-stage'}>
        <CardCanvas data={data} onTap={onClose} />
      </div>
    </div>
  );
}
