// Đồ hoạ cây thông: tán (5 kiểu), màu (6), thân/chậu (3), mặt cười (tuỳ chọn).
// Mọi hàm trả về chuỗi SVG nằm trong khung cảnh 400 x 600. Dùng chung cho trình duyệt và server.

export const CX = 200;
export const GROUND_Y = 540;

export const COLORS = {
  green:     { name: 'Xanh lá',    base: '#55B776', shade: '#3E9760', light: '#8EDCA6', line: '#24573C' },
  deepgreen: { name: 'Xanh thông', base: '#2F8360', shade: '#236A4D', light: '#55AC85', line: '#143A2A' },
  snow:      { name: 'Trắng tuyết',base: '#EAF4F6', shade: '#C9DFE4', light: '#FFFFFF', line: '#58798A' },
  pink:      { name: 'Hồng',       base: '#F6A3BA', shade: '#E2819E', light: '#FFCCDA', line: '#8E3F57' },
  blue:      { name: 'Xanh băng',  base: '#78B1E0', shade: '#5690C4', light: '#AFD4F2', line: '#2D4D78' },
  silver:    { name: 'Bạc',        base: '#CAD3DC', shade: '#A8B3C0', light: '#EFF3F6', line: '#56606C' },
};

export const CANOPIES = {
  tiers:  { name: 'Nhiều tầng' },
  round:  { name: 'Tròn mập' },
  slim:   { name: 'Thon cao' },
  snowy:  { name: 'Phủ tuyết' },
  fluffy: { name: 'Bông xù' },
};

export const TRUNKS = {
  wood: { name: 'Thân gỗ' },
  pot:  { name: 'Chậu gốm' },
  sack: { name: 'Bao tải' },
};

// ---------- hình học từng kiểu tán ----------
// tiers: các tầng tam giác bo tròn, đáy lượn sóng
const TIER_SETS = {
  tiers: [ { top: 112, bottom: 250, hw: 92 }, { top: 180, bottom: 362, hw: 132 }, { top: 268, bottom: 472, hw: 168 } ],
  snowy: [ { top: 112, bottom: 250, hw: 92 }, { top: 180, bottom: 362, hw: 132 }, { top: 268, bottom: 472, hw: 168 } ],
  slim:  [ { top: 78, bottom: 190, hw: 58 }, { top: 140, bottom: 282, hw: 82 }, { top: 220, bottom: 380, hw: 106 }, { top: 310, bottom: 474, hw: 128 } ],
};

const f = (n) => Math.round(n * 10) / 10;

function tierPath({ top, bottom, hw }, bumps) {
  const cx = CX;
  const tipW = 10;
  let d = `M ${f(cx - tipW)} ${f(top + 12)} Q ${cx} ${f(top - 4)} ${f(cx + tipW)} ${f(top + 12)}`;
  d += ` L ${f(cx + hw - 12)} ${f(bottom - 10)} Q ${f(cx + hw + 6)} ${f(bottom + 2)} ${f(cx + hw - 16)} ${f(bottom + 4)}`;
  const left = cx - hw + 16, right = cx + hw - 16;
  const step = (right - left) / bumps;
  for (let i = 0; i < bumps; i++) {
    const x0 = right - i * step, x1 = x0 - step;
    d += ` Q ${f((x0 + x1) / 2)} ${f(bottom + 20)} ${f(x1)} ${f(bottom + 4)}`;
  }
  d += ` Q ${f(cx - hw - 6)} ${f(bottom + 2)} ${f(cx - hw + 12)} ${f(bottom - 10)} Z`;
  return d;
}

function roundPath() {
  // tán tròn mập dạng giọt nước
  return `M 200 96 C 214 96 236 150 268 214 C 318 300 358 352 352 400 C 346 448 290 466 200 466 C 110 466 54 448 48 400 C 42 352 82 300 132 214 C 164 150 186 96 200 96 Z`;
}

function fluffyCircles() {
  // tán bông xù: các hàng "bông" chồng lên nhau như mây
  const out = [];
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const n = r + 1;
    const y = 146 + r * 58;
    const rad = 36 + r * 2.5;
    const spread = r === 0 ? 0 : 22 + r * 22;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? CX : CX - spread + (2 * spread * i) / (n - 1);
      out.push({ x, y: y + (i % 2 ? -4 : 3), r: rad });
    }
  }
  return out;
}

// Nửa bề rộng tán tại độ cao y (dùng để đặt dây đèn và điểm nhắn).
export function halfWidthAt(style, y) {
  if (TIER_SETS[style]) {
    let w = 0;
    for (const t of TIER_SETS[style]) {
      if (y >= t.top && y <= t.bottom + 6) w = Math.max(w, (t.hw * (y - t.top)) / (t.bottom - t.top));
    }
    return w;
  }
  if (style === 'round') {
    if (y < 100 || y > 462) return 0;
    if (y < 392) return 150 * Math.pow((y - 96) / 296, 0.85);
    return 150 - ((y - 392) / 74) * 50;
  }
  if (style === 'fluffy') {
    if (y < 112 || y > 478) return 0;
    return Math.min(160, 22 + ((y - 112) / 330) * 138);
  }
  return 0;
}

export function canopyBounds(style) {
  if (TIER_SETS[style]) {
    const s = TIER_SETS[style];
    return { top: s[0].top, bottom: s[s.length - 1].bottom };
  }
  if (style === 'round') return { top: 96, bottom: 466 };
  return { top: 110, bottom: 480 };
}

// ---------- vẽ ----------
function snowCaps(t, id, bumps) {
  // tuyết đọng dọc mép dưới mỗi tầng (đầu cành), mép trên lượn sóng
  const y = t.bottom - 22;
  const hw = t.hw + 30;
  const step = (2 * hw) / bumps;
  let d = `M ${f(CX - hw)} ${f(t.bottom + 40)} L ${f(CX - hw)} ${f(y)}`;
  for (let i = 0; i < bumps; i++) {
    const x0 = CX - hw + i * step, x1 = x0 + step;
    d += ` Q ${f((x0 + x1) / 2)} ${f(y - 14)} ${f(x1)} ${f(y)}`;
  }
  d += ` L ${f(CX + hw)} ${f(t.bottom + 40)} Z`;
  const tip = `M ${f(CX - 22)} ${f(t.top + 30)} Q ${CX} ${f(t.top - 10)} ${f(CX + 22)} ${f(t.top + 30)} Q ${f(CX + 8)} ${f(t.top + 40)} ${CX} ${f(t.top + 30)} Q ${f(CX - 8)} ${f(t.top + 42)} ${f(CX - 22)} ${f(t.top + 30)} Z`;
  return `<path d="${d}" fill="#FFFFFF" clip-path="url(#${id})"/><path d="${tip}" fill="#FFFFFF" clip-path="url(#${id})"/>`;
}

function garlands(style, c) {
  // dây đèn lượn qua tán + bóng đèn nhấp nháy
  const { top, bottom } = canopyBounds(style);
  const ys = [];
  const n = style === 'slim' ? 4 : 3;
  for (let i = 1; i <= n; i++) ys.push(top + ((bottom - top) * (i + 0.15)) / (n + 0.6));
  const lightColors = ['#FFD45C', '#FF7A7A', '#7FD0FF', '#FFFFFF', '#FFB0E0'];
  let wires = '', bulbs = '';
  let k = 0;
  ys.forEach((y, row) => {
    const hw = halfWidthAt(style, y) * 0.86;
    if (hw < 20) return;
    const x0 = CX - hw, x1 = CX + hw, y0 = y - 14, sag = y + 18;
    wires += `<path d="M ${f(x0)} ${f(y0)} Q ${CX} ${f(sag + 14)} ${f(x1)} ${f(y0)}" fill="none" stroke="${c.line}" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>`;
    const count = Math.max(3, Math.round(hw / 26));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * CX + t * t * x1;
      const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (sag + 14) + t * t * y0;
      const col = lightColors[(k + row) % lightColors.length];
      bulbs += `<g class="light" style="--d:${((k * 0.37) % 2).toFixed(2)}s"><circle cx="${f(bx)}" cy="${f(by + 4)}" r="11" fill="${col}" opacity=".35"/><circle cx="${f(bx)}" cy="${f(by + 4)}" r="6" fill="${col}" stroke="${c.line}" stroke-opacity=".5" stroke-width="1.2"/></g>`;
      k++;
    }
  });
  return `<g class="garland">${wires}${bulbs}</g>`;
}

function face(style, c) {
  const { top, bottom } = canopyBounds(style);
  const y = top + (bottom - top) * 0.46;
  return `<g class="tree-face">
    <g class="blink"><ellipse cx="${CX - 26}" cy="${f(y)}" rx="7" ry="9" fill="${c.line}"/><ellipse cx="${CX + 26}" cy="${f(y)}" rx="7" ry="9" fill="${c.line}"/></g>
    <circle cx="${CX - 24.5}" cy="${f(y - 2.5)}" r="2.4" fill="#fff"/><circle cx="${CX + 27.5}" cy="${f(y - 2.5)}" r="2.4" fill="#fff"/>
    <ellipse cx="${CX - 44}" cy="${f(y + 13)}" rx="12" ry="7" fill="#FF8FA3" opacity=".6"/><ellipse cx="${CX + 44}" cy="${f(y + 13)}" rx="12" ry="7" fill="#FF8FA3" opacity=".55"/>
    <path d="M ${CX - 9} ${f(y + 10)} Q ${CX} ${f(y + 19)} ${CX + 9} ${f(y + 10)}" fill="none" stroke="${c.line}" stroke-width="3.2" stroke-linecap="round"/>
  </g>`;
}

export function topStar(style) {
  const { top } = canopyBounds(style);
  const y = top - 20;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 30 : 14;
    pts.push(`${f(CX + r * Math.cos(a))},${f(y + r * Math.sin(a))}`);
  }
  return `<g class="top-star" style="transform-origin:${CX}px ${f(y)}px">
    <circle class="halo" cx="${CX}" cy="${f(y)}" r="40" fill="#FFE27A" opacity=".35" style="transform-origin:${CX}px ${f(y)}px"/>
    <polygon points="${pts.join(' ')}" fill="#FFD447" stroke="#B9831A" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M ${CX - 8} ${f(y - 6)} l 5 -6" stroke="#FFF6C8" stroke-width="3.5" stroke-linecap="round"/>
  </g>`;
}

export function canopySVG(style, colorKey, opts = {}) {
  const c = opts.palette || COLORS[colorKey] || COLORS.green;
  const id = opts.idPrefix || 'cn';
  const stroke = `stroke="${c.line}" stroke-width="4.5" stroke-linejoin="round"`;
  let body = '';

  if (TIER_SETS[style]) {
    const tiers = TIER_SETS[style];
    const bumps = style === 'slim' ? 4 : 5;
    // vẽ từ tầng dưới lên tầng trên để tầng trên đè lên
    [...tiers].reverse().forEach((t, i) => {
      const d = tierPath(t, bumps + (tiers.length - 1 - i));
      const cid = `${id}-t${i}`;
      body += `<clipPath id="${cid}"><path d="${d}"/></clipPath>`;
      body += `<path d="${d}" fill="${c.base}"/>`;
      body += `<path d="M ${CX + 6} ${t.top} L ${CX + t.hw + 40} ${t.bottom + 30} L ${CX + 6} ${t.bottom + 30} Z" fill="${c.shade}" clip-path="url(#${cid})"/>`;
      body += `<ellipse cx="${f(CX - t.hw * 0.42)}" cy="${f(t.top + (t.bottom - t.top) * 0.62)}" rx="${f(t.hw * 0.16)}" ry="${f((t.bottom - t.top) * 0.18)}" fill="${c.light}" opacity=".7" clip-path="url(#${cid})" transform="rotate(28 ${f(CX - t.hw * 0.42)} ${f(t.top + (t.bottom - t.top) * 0.62)})"/>`;
      if (style === 'snowy') body += snowCaps(t, cid, bumps + (tiers.length - 1 - i) + 2);
      body += `<path d="${d}" fill="none" ${stroke}/>`;
    });
  } else if (style === 'round') {
    const d = roundPath();
    body += `<clipPath id="${id}-r"><path d="${d}"/></clipPath>`;
    body += `<path d="${d}" fill="${c.base}"/>`;
    body += `<path d="M 206 80 C 260 200 380 320 380 500 L 206 500 Z" fill="${c.shade}" clip-path="url(#${id}-r)"/>`;
    // các đường xoáy nhẹ tạo khối tán
    [200, 270, 345, 420].forEach((y) => {
      const hw = halfWidthAt('round', y) * 0.9;
      body += `<path d="M ${f(CX - hw)} ${f(y - 8)} Q ${CX} ${f(y + 22)} ${f(CX + hw)} ${f(y - 8)}" fill="none" stroke="${c.line}" stroke-opacity=".22" stroke-width="3" stroke-linecap="round" clip-path="url(#${id}-r)"/>`;
    });
    body += `<ellipse cx="128" cy="330" rx="20" ry="58" fill="${c.light}" opacity=".7" transform="rotate(24 128 330)" clip-path="url(#${id}-r)"/>`;
    body += `<path d="${d}" fill="none" ${stroke}/>`;
  } else if (style === 'fluffy') {
    const circles = fluffyCircles();
    const cid = `${id}-f`;
    body += `<clipPath id="${cid}">${circles.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.r)}"/>`).join('')}</clipPath>`;
    body += circles.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.r + 2.4)}" fill="${c.line}"/>`).join('');
    body += circles.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(p.r - 2.2)}" fill="${c.base}"/>`).join('');
    body += `<rect x="${CX + 4}" y="90" width="200" height="420" fill="${c.shade}" opacity=".55" clip-path="url(#${cid})"/>`;
    // vệt bóng mềm ở rìa trên mỗi bông, chỉ ở các bông rìa ngoài
    body += circles.filter((p, i) => p.x <= CX).map((p) => `<path d="M ${f(p.x - p.r * 0.6)} ${f(p.y - p.r * 0.2)} Q ${f(p.x - p.r * 0.45)} ${f(p.y - p.r * 0.62)} ${f(p.x - p.r * 0.05)} ${f(p.y - p.r * 0.7)}" fill="none" stroke="${c.light}" stroke-width="5" stroke-linecap="round" opacity=".9"/>`).join('');
  }

  const deco = opts.lights === false ? '' : garlands(style, c);
  const fc = opts.face ? face(style, c) : '';

  const star = opts.star === false ? '' : topStar(style);
  return `<g class="canopy">${body}${deco}${fc}</g>${star}`;
}

export function trunkSVG(kind) {
  if (kind === 'pot') {
    return `<g class="trunk">
      <rect x="188" y="452" width="24" height="34" rx="6" fill="#9C6B43" stroke="#5A3A22" stroke-width="4"/>
      <path d="M 168 494 L 232 494 L 224 548 Q 223 554 216 554 L 184 554 Q 177 554 176 548 Z" fill="#D9774A" stroke="#7A3A1E" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M 206 500 L 228 500 L 221 548 L 211 548 Z" fill="#BE5F36" opacity=".7"/>
      <rect x="158" y="474" width="84" height="26" rx="12" fill="#EE9466" stroke="#7A3A1E" stroke-width="4.5"/>
      <path d="M 170 482 L 196 482" stroke="#FFC6A3" stroke-width="4" stroke-linecap="round"/>
      <circle cx="186" cy="522" r="4" fill="#FFF1E0" opacity=".8"/><circle cx="200" cy="530" r="4" fill="#FFF1E0" opacity=".8"/><circle cx="214" cy="522" r="4" fill="#FFF1E0" opacity=".8"/>
    </g>`;
  }
  if (kind === 'sack') {
    return `<g class="trunk">
      <rect x="188" y="452" width="24" height="36" rx="6" fill="#9C6B43" stroke="#5A3A22" stroke-width="4"/>
      <path d="M 176 492 Q 160 500 156 526 Q 152 552 178 556 L 222 556 Q 248 552 244 526 Q 240 500 224 492 Z" fill="#CDA571" stroke="#6E4C22" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M 166 506 L 234 506 M 162 522 L 238 522 M 162 538 L 238 538" stroke="#A9834F" stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round"/>
      <path d="M 172 486 Q 200 498 228 486 L 230 496 Q 200 508 170 496 Z" fill="#D94B4B" stroke="#7E2222" stroke-width="3.5" stroke-linejoin="round"/>
      <path d="M 200 494 q -18 -16 -22 4 q 4 10 22 -4 q 18 -16 22 4 q -4 10 -22 -4" fill="#E55B5B" stroke="#7E2222" stroke-width="3" stroke-linejoin="round"/>
    </g>`;
  }
  // wood
  return `<g class="trunk">
    <path d="M 182 456 L 218 456 L 222 538 Q 222 546 214 546 L 186 546 Q 178 546 178 538 Z" fill="#A8744A" stroke="#5A3A22" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M 204 466 L 206 536 M 192 486 Q 190 500 194 514" stroke="#7E5230" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M 170 546 Q 178 536 186 546 M 214 546 Q 222 536 230 546" fill="#A8744A" stroke="#5A3A22" stroke-width="4" stroke-linejoin="round"/>
  </g>`;
}

export function groundShadow() {
  return `<ellipse cx="${CX}" cy="${GROUND_Y + 14}" rx="120" ry="14" fill="#000" opacity=".12"/>`;
}

// Toàn bộ cây: bóng + thân + tán + sao, bọc trong nhóm có hiệu ứng đung đưa.
export function treeSVG({ canopy = 'tiers', color = 'green', trunk = 'wood', face = false, lights = true, star = true, idPrefix = 'tr', palette } = {}) {
  return `<g class="tree" data-part="tree">
    ${groundShadow()}
    ${trunkSVG(trunk)}
    <g class="tree-sway">${canopySVG(canopy, color, { face, lights, star, idPrefix, palette })}</g>
  </g>`;
}

// CSS hoạt ảnh dùng chung (chèn vào <style> của SVG hoặc trang).
export const TREE_CSS = `
.tree-sway{transform-box:view-box;transform-origin:200px 470px;animation:tree-sway 5.5s ease-in-out infinite}
@keyframes tree-sway{0%,100%{transform:rotate(-.9deg)}50%{transform:rotate(.9deg)}}
.light{animation:twinkle 2.2s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes twinkle{0%,100%{opacity:1}50%{opacity:.35}}
.top-star{transform-box:view-box;animation:star-bob 3s ease-in-out infinite}
.top-star .halo{transform-box:view-box;animation:halo 3s ease-in-out infinite}
@keyframes star-bob{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg) scale(1.04)}}
@keyframes halo{0%,100%{transform:scale(.8);opacity:.2}50%{transform:scale(1.15);opacity:.5}}
.blink{transform-box:fill-box;transform-origin:center;animation:blink 4.6s infinite}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
.shake .tree-sway{animation:tree-shake .7s ease-in-out}
@keyframes tree-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-3.5deg)}40%{transform:rotate(3deg)}60%{transform:rotate(-2deg)}80%{transform:rotate(1deg)}}
.shake .light{animation:flash .9s ease-out}
@keyframes flash{0%{opacity:.2}30%{opacity:1;filter:brightness(1.8)}100%{opacity:1}}
.snow-drop{animation:snow-drop 1.3s ease-in forwards}
@keyframes snow-drop{from{transform:translateY(0);opacity:1}to{transform:translateY(var(--fall,120px));opacity:0}}
@media (prefers-reduced-motion:reduce){.tree-sway,.light,.top-star,.top-star .halo,.blink{animation:none}}
`;
