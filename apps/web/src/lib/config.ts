import { useEffect, useState } from 'react';
import { api, type AppConfig } from './api';

// Một lần tải /api/config cho cả app; lỗi thì lần sau thử lại.
// Tải lại khi tới mốc giai đoạn kế tiếp và khi quay lại tab, để tab mở qua 0h 26/12 hay 0h 01/01
// cũng đổi sang NOTICE / trang kết thúc (đặc tả 6.9.1). Tải lại lỗi thì giữ bản cũ.
let pending: Promise<AppConfig> | null = null;
let loaded: AppConfig | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let watching = false;
const listeners = new Set<(c: AppConfig) => void>();

const DAY_MS = 24 * 3_600_000;
const AFTER_MILESTONE_MS = 2_000; // chờ qua mốc một chút cho chắc server đã đổi giai đoạn

function set(c: AppConfig) {
  loaded = c;
  for (const l of listeners) l(c);
  schedule(c);
}

/** Hẹn tải lại ở mốc kế tiếp (theo giờ server); xa hơn 1 ngày thì hẹn 1 ngày (giới hạn setTimeout, máy ngủ). */
function schedule(c: AppConfig) {
  clearTimeout(timer);
  const now = Date.parse(c.now);
  const next = [c.unlockAt, c.writeClosesAt, c.serviceEndsAt].map(Date.parse).filter((t) => t > now).sort((a, b) => a - b)[0];
  if (next === undefined || !Number.isFinite(now)) return;
  timer = setTimeout(() => void reload(), Math.min(next - now + AFTER_MILESTONE_MS, DAY_MS));
}

function reload(): Promise<void> {
  return api.getConfig().then(set, () => {});
}

function watchVisibility() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && loaded) void reload();
  });
}

function loadConfig(): Promise<AppConfig> {
  if (!pending) {
    pending = Promise.resolve().then(() => api.getConfig()).then(
      (c) => {
        set(c);
        return c;
      },
      (e: unknown) => {
        pending = null;
        throw e;
      },
    );
  }
  return pending;
}

/** Cấu hình app (`/api/config`); `null` khi đang tải hoặc lỗi. */
export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(loaded);
  useEffect(() => {
    watchVisibility();
    listeners.add(setConfig);
    if (loaded) setConfig(loaded);
    else loadConfig().catch(() => {});
    return () => { listeners.delete(setConfig); };
  }, []);
  return config;
}

export function resetConfigForTest(): void {
  clearTimeout(timer);
  pending = null;
  loaded = null;
}
