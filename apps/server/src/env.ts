import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Env = {
  /** Bản build web (có index.html) — server phục vụ trang + chèn thẻ OG (đặc tả 6.6.3). */
  webDist?: string;
  /** Thư mục ảnh WebP để vẽ OG: `webDist` nếu có, ngược lại `apps/web/public`. */
  assetDir: string;
  pepper: string;
  blockIpKey: string;
  baseUrl: string;
  googleClientId?: string;
  production: boolean;
  /** Số bước proxy tin cậy khi đọc X-Forwarded-For (Azure App Service = 1). Không bao giờ là `true`. */
  trustProxyHops: number;
};

// apps/server/{src,dist}/env.* → apps/web/public
const DEV_ASSETS = fileURLToPath(new URL('../../web/public', import.meta.url));

const DEV_PEPPER = 'dev-pepper-dev-pepper-dev-pepper!';

export function loadEnv(src: Record<string, string | undefined> = process.env): Env {
  const production = src.NODE_ENV === 'production';
  const pepper = src.PEPPER;
  if (production && (!pepper || pepper.length < 32)) {
    throw new Error('PEPPER là bắt buộc và phải có ít nhất 32 ký tự khi chạy production');
  }
  if (production && src.FAKE_NOW) throw new Error('FAKE_NOW không được đặt khi chạy production');
  const blockIpKey = src.BLOCK_IP_KEY;
  if (production && (!blockIpKey || blockIpKey.length < 32)) {
    throw new Error('BLOCK_IP_KEY là bắt buộc và phải có ít nhất 32 ký tự khi chạy production');
  }
  const hops = src.TRUST_PROXY_HOPS === undefined || src.TRUST_PROXY_HOPS === '' ? 1 : Number(src.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 0) throw new Error('TRUST_PROXY_HOPS phải là số nguyên không âm');
  const env: Env = {
    pepper: pepper && pepper.length >= 32 ? pepper : DEV_PEPPER,
    blockIpKey: blockIpKey && blockIpKey.length >= 32 ? blockIpKey : DEV_PEPPER,
    baseUrl: src.BASE_URL || 'http://localhost:3000',
    production,
    trustProxyHops: hops,
    assetDir: src.WEB_DIST && existsSync(join(src.WEB_DIST, 'index.html')) ? resolve(src.WEB_DIST) : DEV_ASSETS,
  };
  if (src.GOOGLE_CLIENT_ID) env.googleClientId = src.GOOGLE_CLIENT_ID;
  if (src.WEB_DIST && existsSync(join(src.WEB_DIST, 'index.html'))) env.webDist = resolve(src.WEB_DIST);
  return env;
}
