import type { Env } from '../env.js';
import { azureStore } from './azure.js';
import { fsStore } from './fs.js';

/** Nơi lưu ảnh (WebP). Khoá dạng `m/{treeId}/{id}-x.webp`, `r/{id}.webp`. */
export interface PhotoStore {
  /** Ghi ảnh (content-type image/webp). */
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /** Không có thì thôi, không ném lỗi. */
  delete(key: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
}

export { memoryStore } from './memory.js';
export { fsStore } from './fs.js';
export { azureStore } from './azure.js';

/** Có AZURE_STORAGE_CONNECTION_STRING → Blob; không thì thư mục `env.photoDir`. */
export function makePhotoStore(env: Env): PhotoStore {
  return env.azureStorageConnectionString ? azureStore(env.azureStorageConnectionString) : fsStore(env.photoDir);
}
