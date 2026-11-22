import { ensureCardFonts } from './draw';
import type { Measure } from './layout';

let cached: Measure | null | undefined;

/** Bộ đo chữ thật (phông Mynerve) để kiểm luật 9 dòng; `null` nếu không có canvas 2D (vd. jsdom). */
export async function cardMeasure(): Promise<Measure | null> {
  await ensureCardFonts();
  if (cached !== undefined) return cached;
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  cached = ctx
    ? (s, px) => {
        ctx.font = `${px}px Mynerve`;
        return ctx.measureText(s).width;
      }
    : null;
  return cached;
}
