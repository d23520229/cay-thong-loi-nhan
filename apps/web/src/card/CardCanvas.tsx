import { useEffect, useRef } from 'react';
import { catalog } from '../lib/catalog';
import './card.css';
import { drawCard, ensureCardFonts, loadCardAssets, type CardData } from './draw';

/** Thiệp vẽ trên canvas; vẽ ở bề rộng thật × devicePixelRatio, vẽ lại khi đổi cỡ. */
export function CardCanvas({ data, onTap }: { data: CardData; onTap?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true;
    let ready: Awaited<ReturnType<typeof loadCardAssets>> | null = null;

    const paint = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !ready) return;
      const W = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1));
      if (W <= 0) return;
      canvas.width = W;
      canvas.height = Math.round((W * catalog.card.h) / catalog.card.w);
      drawCard(ctx, W, data, ready);
    };

    void Promise.all([ensureCardFonts(), loadCardAssets()])
      .then(([, a]) => {
        if (!alive) return;
        ready = a;
        paint();
      })
      .catch(() => {});

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(paint);
    ro?.observe(canvas);
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [data]);

  return <canvas ref={ref} className="cd-canvas" role="img" aria-label={`${data.content} ${data.sign}`} onClick={onTap} />;
}
