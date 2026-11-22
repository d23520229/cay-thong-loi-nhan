import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from '@ctln/shared';
import { createFxCycler, type Fx } from './effects';

export type ActiveFx = { clientId: string; fx: Fx; seed: number };

const FX_MS = 1800;
const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Hiệu ứng chạm đồ vật ở chế độ Xem (G6): mỗi lần chạm một kiểu, tắt sau 1,8 giây. */
export function useItemFx(room: Room): { fx: ActiveFx | null; tap: (clientId: string) => void } {
  const [fx, setFx] = useState<ActiveFx | null>(null);
  const [cycler] = useState(createFxCycler);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = useCallback(
    (clientId: string) => {
      const item = room.items.find((i) => i.clientId === clientId);
      const next = item ? cycler.next(item) : null;
      if (!next) return;
      // Giảm chuyển động: giữ câu nói / đổi nhẹ, bỏ hạt bay.
      const shown = reducedMotion() ? { ...next, burst: undefined } : next;
      clearTimeout(timer.current);
      setFx({ clientId, fx: shown, seed: Math.floor(Math.random() * 1000) + 1 });
      timer.current = setTimeout(() => setFx(null), FX_MS);
    },
    [room, cycler],
  );
  return { fx, tap };
}
