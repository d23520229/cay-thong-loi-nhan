// Giờ server (đặc tả 6.6.1 "Đồng hồ"): hạn sửa lời nhắn so theo server, không theo đồng hồ máy.
let offset = 0;

/** Ghi độ lệch `serverNow − Date.now()` từ `now` của `/api/config`. Chuỗi hỏng thì bỏ qua. */
export function syncClock(serverNowIso: string): void {
  const t = Date.parse(serverNowIso);
  if (Number.isFinite(t)) offset = t - Date.now();
}

/** Giờ server hiện tại (ms). */
export const serverNow = (): number => Date.now() + offset;

export function resetClock(): void {
  offset = 0;
}
