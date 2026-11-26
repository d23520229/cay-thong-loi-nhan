import { useSyncExternalStore } from 'react';

// API trả 410 `service_ended` (trang mở từ trước 0h 01/01/2027) → cả app chuyển sang trang kết thúc (đặc tả 6.9.1).
let ended = false;
const listeners = new Set<() => void>();

export function markServiceEnded(): void {
  if (ended) return;
  ended = true;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export function useServiceEnded(): boolean {
  return useSyncExternalStore(subscribe, () => ended);
}

export function resetServiceEndedForTest(): void {
  ended = false;
}
