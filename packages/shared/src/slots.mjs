// Xếp điểm nhắn trên tán: chia hàng so le, mỗi hàng trải từ mép trái tới mép phải,
// số điểm mỗi hàng tỉ lệ bề rộng tán, thêm độ lệch nhỏ cố định để trông tự nhiên.
// Xác định (cùng dáng tán + số lượng => cùng vị trí). Trả về { scale, slots: [{ i, x, y }] } trong khung 400 x 600.
import { halfWidthAt, canopyBounds, CX } from './geometry.mjs';

export const SLOT_COUNTS = [6, 9, 12, 16, 20, 25, 30];

export function ornamentScale(count) {
  if (count <= 9) return 1.3;
  if (count <= 12) return 1.2;
  if (count <= 16) return 1.1;
  if (count <= 20) return 1.0;
  return 0.9;
}
function rng(seed) { let s = seed % 233280; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

// đường bao không lõm của tán: bề rộng lớn nhất từ đỉnh xuống tới y
function envelope(shape) {
  const { top, bottom } = canopyBounds(shape);
  const env = new Map();
  let m = 0;
  for (let y = Math.floor(top); y <= bottom + 40; y++) { m = Math.max(m, halfWidthAt(shape, y)); env.set(y, m); }
  return (y) => env.get(Math.max(Math.floor(top), Math.min(bottom + 40, Math.round(y)))) || 0;
}

const cache = new Map();
export function layoutSlots(shape, count) {
  const key = shape + '|' + count;
  if (cache.has(key)) return cache.get(key);
  const scale = ornamentScale(count);
  const E = envelope(shape);
  const { top, bottom } = canopyBounds(shape);
  const hang = 44 * scale, half = 15 * scale;
  const y0 = top + (bottom - top) * 0.2, y1 = bottom - hang - 4;
  const usable = (y) => Math.max(0, Math.min(E(y + 8), E(y + hang * 0.8)) * 0.94 - half - 6);
  // ước lượng khoảng cách mong muốn từ diện tích
  let area = 0;
  for (let y = y0; y <= y1; y += 2) area += 2 * usable(y) * 2;
  const d = Math.sqrt(area / count);
  let best = null;
  for (let R = 2; R <= 9; R++) {
    const ys = [];
    for (let r = 0; r < R; r++) ys.push(R === 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * r) / (R - 1));
    const ws = ys.map(usable);
    if (ws.some((w) => w < 4)) continue;
    const tot = ws.reduce((a, w) => a + w + d * 0.5, 0);
    const n = ws.map((w) => (count * (w + d * 0.5)) / tot);
    const k = n.map((x) => Math.max(1, Math.floor(x)));
    let sum = k.reduce((a, b) => a + b, 0);
    while (sum < count) { let bi = 0; for (let i = 1; i < R; i++) if (n[i] - k[i] > n[bi] - k[bi]) bi = i; k[bi]++; sum++; }
    while (sum > count) { let bi = -1; for (let i = 0; i < R; i++) if (k[i] > 1 && (bi < 0 || k[i] - n[i] > k[bi] - n[bi])) bi = i; if (bi < 0) break; k[bi]--; sum--; }
    if (sum !== count) continue;
    const vgap = R > 1 ? (y1 - y0) / (R - 1) : 999;
    const hgaps = ws.map((w, i) => (k[i] > 1 ? (2 * w) / (k[i] - 1) : 2 * w));
    if (hgaps.some((g, i) => k[i] > 1 && g < half * 2.3)) continue;
    const avg = hgaps.reduce((a, b) => a + b, 0) / R;
    const score = Math.abs(avg - vgap * 1.1) + hgaps.reduce((a, g) => a + Math.abs(g - avg), 0) / R;
    if (!best || score < best.score) best = { score, ys, ws, k };
  }
  const r = rng(count * 131 + shape.length * 17);
  const out = [];
  best.ys.forEach((y, ri) => {
    const n = best.k[ri], w = best.ws[ri];
    for (let j = 0; j < n; j++) {
      let x;
      if (n === 1) x = CX + (ri % 2 ? 1 : -1) * w * 0.25;
      else if (n === 2) x = CX + (j ? 1 : -1) * w * 0.72;
      else x = CX - w + (j * 2 * w) / (n - 1);
      // so le giữa các hàng + lệch nhẹ ngẫu nhiên, không vượt ra ngoài phần dùng được
      const step = n > 1 ? (2 * w) / (n - 1) : w;
      const jx = (r() - 0.5) * Math.min(14, step * 0.25) + (ri % 2 && n > 2 && j > 0 && j < n - 1 ? step * 0.12 : 0);
      const jy = (r() - 0.5) * Math.min(18, (y1 - y0) / best.ys.length * 0.35);
      const yy = y + jy;
      const lim = usable(yy);
      out.push({ x: Math.round(Math.max(CX - lim, Math.min(CX + lim, x + jx))), y: Math.round(yy) });
    }
  });
  out.sort((a, b) => (Math.round(a.y / 24) - Math.round(b.y / 24)) || a.x - b.x);
  const res = { scale, slots: out.map((p, i) => ({ i, ...p })) };
  cache.set(key, res);
  return res;
}
