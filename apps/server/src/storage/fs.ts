import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PhotoStore } from './index.js';

/** Lưu trong thư mục (dev, hoặc server tự chạy không có Blob). */
export function fsStore(dir: string): PhotoStore {
  // Chặn thoát khỏi thư mục gốc qua khoá độc hại.
  const path = (key: string) => {
    if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) throw new Error('khoá ảnh không hợp lệ');
    return join(dir, key);
  };
  return {
    async put(key, data) {
      const p = path(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, data);
    },
    async get(key) {
      const p = path(key);
      try {
        return await readFile(p);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
    },
    async delete(key) { await rm(path(key), { force: true }); },
    async copy(from, to) {
      const src = path(from);
      const dst = path(to);
      await mkdir(dirname(dst), { recursive: true });
      await copyFile(src, dst);
    },
  };
}
