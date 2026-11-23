import type { PhotoStore } from './index.js';

/** Lưu trong bộ nhớ — dùng cho test. */
export function memoryStore(): PhotoStore & { keys(): string[] } {
  const m = new Map<string, Buffer>();
  return {
    async put(key, data) { m.set(key, Buffer.from(data)); },
    async get(key) { return m.get(key) ?? null; },
    async delete(key) { m.delete(key); },
    async copy(from, to) {
      const d = m.get(from);
      if (!d) throw new Error('không có ảnh nguồn');
      m.set(to, Buffer.from(d));
    },
    keys: () => [...m.keys()],
  };
}
