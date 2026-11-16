// Hình học tán cây thông, dùng chung cho đồ hoạ (packages/art), xếp điểm nhắn (slots) và server.
// Khung cây 400 x 600, tâm x = 200, gốc chạm đất ở y ≈ 538.

export const CX = 200;

export const TIERS = {
  cloud3: [ { top: 116, bottom: 254, hw: 110, n: 3 }, { top: 184, bottom: 352, hw: 152, n: 4 }, { top: 266, bottom: 464, hw: 184, n: 5 } ],
  snowy:  [ { top: 116, bottom: 254, hw: 110, n: 3 }, { top: 184, bottom: 352, hw: 152, n: 4 }, { top: 266, bottom: 464, hw: 184, n: 5 } ],
  cloud4: [ { top: 92, bottom: 200, hw: 70, n: 3 }, { top: 150, bottom: 276, hw: 98, n: 3 }, { top: 222, bottom: 366, hw: 126, n: 4 }, { top: 304, bottom: 464, hw: 152, n: 5 } ],
};

export function puffyCircles() {
  const out = [];
  const rows = [[1, 146, 46], [2, 202, 48], [3, 262, 50], [4, 326, 52], [5, 398, 52]];
  rows.forEach(([n, y, r]) => {
    for (let j = 0; j < n; j++) out.push({ x: CX + (j - (n - 1) / 2) * r * 1.26, y: y + (j % 2 ? -4 : 3), r });
  });
  return out;
}

// nửa bề rộng tán tại y (dùng xếp điểm nhắn, đèn)
export function halfWidthAt(shape, y) {
  if (TIERS[shape]) {
    let w = 0;
    for (const t of TIERS[shape]) {
      if (y < t.top || y > t.bottom) continue;
      const k = (y - t.top) / (t.bottom - t.top);
      w = Math.max(w, t.hw * Math.min(1, Math.pow(k, 0.72) * 1.02));
    }
    return w;
  }
  // puffy: lấy theo các hình tròn
  let w = 0;
  for (const c of puffyCircles()) {
    const dy = Math.abs(y - c.y);
    if (dy < c.r) w = Math.max(w, Math.abs(c.x - CX) + Math.sqrt(c.r * c.r - dy * dy));
  }
  return w;
}

export function canopyBounds(shape) {
  if (TIERS[shape]) { const t = TIERS[shape]; return { top: t[0].top, bottom: t[t.length - 1].bottom }; }
  return { top: 100, bottom: 450 };
}
