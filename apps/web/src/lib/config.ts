import { useEffect, useState } from 'react';
import { api, type AppConfig } from './api';

// Một lần tải /api/config cho cả app; lỗi thì lần sau thử lại.
let pending: Promise<AppConfig> | null = null;
let loaded: AppConfig | null = null;

function loadConfig(): Promise<AppConfig> {
  if (!pending) {
    pending = api.getConfig().then(
      (c) => (loaded = c),
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
    if (config) return;
    let alive = true;
    loadConfig().then(
      (c) => { if (alive) setConfig(c); },
      () => {},
    );
    return () => { alive = false; };
  }, [config]);
  return config;
}

export function resetConfigForTest(): void {
  pending = null;
  loaded = null;
}
