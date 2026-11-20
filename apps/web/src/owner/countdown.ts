// Đếm ngược tới giờ mở quà và giờ treo lời nhắn (đặc tả 6.6.2) — thuần, có test.
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const VN_OFFSET = 7 * HOUR; // Asia/Ho_Chi_Minh, không đổi giờ mùa hè

export function countdownText(msLeft: number): string {
  if (msLeft <= 0) return 'Đã mở quà';
  if (msLeft >= DAY) return `Còn ${Math.floor(msLeft / DAY)} ngày ${Math.floor((msLeft % DAY) / HOUR)} giờ`;
  const mins = Math.ceil(msLeft / MIN);
  if (msLeft >= HOUR) return `Còn ${Math.floor(mins / 60)} giờ ${mins % 60} phút`;
  return `Còn ${Math.max(1, mins)} phút`;
}

const two = (n: number) => String(n).padStart(2, '0');

/** "dd/mm lúc HH:MM" theo giờ Việt Nam. */
export function formatSentAt(iso: string): string {
  const d = new Date(Date.parse(iso) + VN_OFFSET);
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)} lúc ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}
