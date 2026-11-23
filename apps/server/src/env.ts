import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Env = {
  /** Bản build web (có index.html) — server phục vụ trang + chèn thẻ OG (đặc tả 6.6.3). */
  webDist?: string;
  /** `WEB_DIST` có đặt nhưng không dùng được (để index.ts ghi cảnh báo). */
  webDistProblem?: string;
  /** Thư mục ảnh WebP để vẽ OG: `webDist` nếu có, ngược lại `apps/web/public`. */
  assetDir: string;
  pepper: string;
  blockIpKey: string;
  baseUrl: string;
  googleClientId?: string;
  production: boolean;
  /** Số bước proxy tin cậy khi đọc X-Forwarded-For (Azure App Service = 1). Không bao giờ là `true`. */
  trustProxyHops: number;
  /** Thư mục lưu ảnh đính kèm khi không dùng Azure Blob. */
  photoDir: string;
  /** Có thì ảnh lưu ở Azure Blob Storage (container riêng tư). */
  azureStorageConnectionString?: string;
  /** Email quản trị viên đầu tiên (chữ thường), tạo lúc khởi động (đặc tả 6.8.2). */
  adminBootstrapEmail?: string;
  /** Email hỗ trợ hiện cho người dùng (đặc tả 6.8.7). */
  supportEmail?: string;
  /** Hạn mức dung lượng CSDL để so trên Tổng quan (`DB_QUOTA_GB`, mặc định 32). */
  dbQuotaBytes: number;
  /** Đường dẫn Azure Portal cho CPU / bộ nhớ / chi phí (đặc tả 6.8.3). */
  adminAzureUrl?: string;
};

// apps/server/{src,dist}/env.* → apps/web/public
const DEV_ASSETS = fileURLToPath(new URL('../../web/public', import.meta.url));

// apps/server/{src,dist}/env.* → <repo>/.data/photos
const DEV_PHOTOS = fileURLToPath(new URL('../../../.data/photos', import.meta.url));

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
  if (production && !src.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING là bắt buộc khi chạy production');
  }
  const hops = src.TRUST_PROXY_HOPS === undefined || src.TRUST_PROXY_HOPS === '' ? 1 : Number(src.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 0) throw new Error('TRUST_PROXY_HOPS phải là số nguyên không âm');
  const quotaGb = src.DB_QUOTA_GB === undefined || src.DB_QUOTA_GB === '' ? 32 : Number(src.DB_QUOTA_GB);
  if (!Number.isFinite(quotaGb) || quotaGb <= 0) throw new Error('DB_QUOTA_GB phải là số dương');
  const env: Env = {
    pepper: pepper && pepper.length >= 32 ? pepper : DEV_PEPPER,
    blockIpKey: blockIpKey && blockIpKey.length >= 32 ? blockIpKey : DEV_PEPPER,
    baseUrl: src.BASE_URL || 'http://localhost:3000',
    production,
    trustProxyHops: hops,
    dbQuotaBytes: quotaGb * 1024 ** 3,
    photoDir: src.PHOTO_DIR ? resolve(src.PHOTO_DIR) : DEV_PHOTOS,
    assetDir: src.WEB_DIST && existsSync(join(src.WEB_DIST, 'index.html')) ? resolve(src.WEB_DIST) : DEV_ASSETS,
  };
  if (src.AZURE_STORAGE_CONNECTION_STRING) env.azureStorageConnectionString = src.AZURE_STORAGE_CONNECTION_STRING;
  if (src.GOOGLE_CLIENT_ID) env.googleClientId = src.GOOGLE_CLIENT_ID;
  if (src.ADMIN_BOOTSTRAP_EMAIL?.trim()) env.adminBootstrapEmail = src.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase();
  if (src.SUPPORT_EMAIL?.trim()) env.supportEmail = src.SUPPORT_EMAIL.trim();
  if (src.ADMIN_AZURE_URL?.trim()) env.adminAzureUrl = src.ADMIN_AZURE_URL.trim();
  if (src.WEB_DIST && existsSync(join(src.WEB_DIST, 'index.html'))) env.webDist = resolve(src.WEB_DIST);
  else if (src.WEB_DIST) env.webDistProblem = `WEB_DIST=${src.WEB_DIST}: không thấy index.html — server không phục vụ trang web`;
  return env;
}
