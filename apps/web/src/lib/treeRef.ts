export const TREE_ID = /^[a-z2-9]{8}$/;
// Bảng chữ thật server dùng sinh mã (security.ts) bỏ i, l, o nên mã có chữ đó chắc chắn gõ nhầm.
const TREE_CODE = /^[a-hjkmnp-z2-9]{8}$/;

/** Đọc mã cây (8 ký tự) hoặc link `/c/{id}` (có thể kèm `#k=` của link riêng). */
export function parseTreeRef(input: string): { id: string; key?: string } | null {
  const text = input.trim();
  const hashAt = text.indexOf('#');
  const head = hashAt < 0 ? text : text.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : text.slice(hashAt + 1);

  const bare = head.toLowerCase();
  if (TREE_CODE.test(bare)) return { id: bare };

  const m = /\/c\/([A-Za-z0-9]+)\/?(?:\?.*)?$/.exec(head);
  const id = m?.[1]?.toLowerCase();
  if (!id || !TREE_CODE.test(id)) return null;
  const key = /(?:^|&)k=([A-Za-z0-9_-]+)/.exec(hash)?.[1];
  return key ? { id, key } : { id };
}
