// Định dạng hiển thị cho trang quản trị (giờ Việt Nam).
const TZ = 'Asia/Ho_Chi_Minh';

export function fmtBytes(b: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const s = (Math.round(v * 10) / 10).toString().replace('.', ',');
  return `${s} ${units[i]}`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hour12: false });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "22 ngày 14 giờ 0 phút" từ `fromIso` tới `toIso`. */
export function fmtCountdown(fromIso: string, toIso: string): string {
  const ms = Math.max(0, Date.parse(toIso) - Date.parse(fromIso));
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 1440)} ngày ${Math.floor((m % 1440) / 60)} giờ ${m % 60} phút`;
}
