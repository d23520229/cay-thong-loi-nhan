// Nguồn vẽ cây thông phong cách màu nước. Xuất ra SVG có bộ lọc -> render WebP theo lớp.
// Khung chung 400 x 600, tâm x = 200, gốc cây chạm đất ở y ≈ 538.

import { CX, TIERS, puffyCircles, halfWidthAt, canopyBounds } from '../../shared/src/geometry.mjs';
export { CX, halfWidthAt, canopyBounds };

export const PALETTES = {
  teal:     { name: 'Xanh ngọc',  light: '#C4F3E8', base: '#86DCCD', mid: '#5DC3C0', deep: '#3E8FB3', accent: '#6FA8E8', edge: '#2F6F86' },
  green:    { name: 'Xanh lá',    light: '#DDF3BF', base: '#9AD587', mid: '#68B86E', deep: '#3B8A55', accent: '#B5DD6E', edge: '#2D6440' },
  pine:     { name: 'Xanh thông', light: '#A9DDB9', base: '#5AAA82', mid: '#3A8862', deep: '#1F5A45', accent: '#3E7FA0', edge: '#173F31' },
  pink:     { name: 'Hồng phấn',  light: '#FFE6EE', base: '#F8BACD', mid: '#EF97B3', deep: '#C96E93', accent: '#F3AEDC', edge: '#8E3F5F' },
  lavender: { name: 'Oải hương',  light: '#ECE5FF', base: '#C4B6F2', mid: '#A493E2', deep: '#7464B8', accent: '#8FB2F0', edge: '#4E428A' },
  frost:    { name: 'Trắng sương',light: '#FFFFFF', base: '#E6F3F8', mid: '#C9E3EE', deep: '#93BDD2', accent: '#BFD8F5', edge: '#5C8499' },
};

export const SHAPES = {
  cloud3: { name: '3 tầng mây' },
  cloud4: { name: 'Thon cao 4 tầng' },
  puffy:  { name: 'Bông tròn' },
  snowy:  { name: '3 tầng phủ tuyết' },
};

export const TRUNK_SHAPES = {
  straight: { name: 'Thẳng' },
  flared:   { name: 'Loe rễ' },
  stout:    { name: 'Mập lùn' },
};

export const WOODS = {
  oak:    { name: 'Gỗ sồi sáng', light: '#F3E2C2', base: '#DDBE90', dark: '#B48E60', grain: '#A07648' },
  walnut: { name: 'Óc chó',      light: '#C79C72', base: '#956840', dark: '#6A4428', grain: '#533420' },
  cedar:  { name: 'Tuyết tùng',  light: '#E69C7C', base: '#BF6C4C', dark: '#8E4A33', grain: '#743622' },
  birch:  { name: 'Bạch dương',  light: '#FFFDF7', base: '#EFE9DC', dark: '#CFC6B4', grain: '#4A4038' },
};

const f = (n) => Math.round(n * 10) / 10;
export const TIER_BOTTOMS = Object.fromEntries(Object.entries(TIERS).map(([k, t]) => [k, t.map((x) => x.bottom)]));
function rng(seed) { let s = seed % 233280; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

// ---------- hình dạng ----------
function tierPath({ top, bottom, hw, n }) {
  const step = (2 * hw) / n;
  const depth = step * 0.48;
  const yJ = bottom - depth * 0.7;        // các khớp giữa hai múi (cao)
  const yC = bottom + depth * 0.32;       // điểm điều khiển đáy múi (thấp)
  const h = bottom - top;
  const xR = CX + hw * 0.97, xL = CX - hw * 0.97, ySide = yJ - depth * 0.35;
  let d = `M ${f(xL)} ${f(ySide)}`;
  d += ` C ${f(CX - hw * 0.72)} ${f(bottom - h * 0.52)} ${f(CX - hw * 0.42)} ${f(top)} ${CX} ${top}`;
  d += ` C ${f(CX + hw * 0.42)} ${f(top)} ${f(CX + hw * 0.72)} ${f(bottom - h * 0.52)} ${f(xR)} ${f(ySide)}`;
  // các múi tròn phình xuống, đi từ phải sang trái; hai múi ngoài phình thêm ra hai bên
  const xs = [xR];
  for (let i = 1; i < n; i++) xs.push(CX + hw - i * step);
  xs.push(xL);
  for (let i = 0; i < n; i++) {
    const xa = xs[i], xb = xs[i + 1];
    const ya = i === 0 ? ySide : yJ, yb = i === n - 1 ? ySide : yJ;
    const c1x = i === 0 ? xa + step * 0.28 : xa - step * 0.02;
    const c2x = i === n - 1 ? xb - step * 0.28 : xb + step * 0.02;
    d += ` C ${f(c1x)} ${f(yC)} ${f(c2x)} ${f(yC)} ${f(xb)} ${f(yb)}`;
  }
  return d + ' Z';
}

// ---------- bộ lọc màu nước ----------
export const DEFS = (id, lite = 1) => `
<filter id="${id}-wob" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="13"/></filter>
<filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="${id}-edge" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="${id}-paper" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.16  0 0 0 0 0.2  0.9 0 0 0 -0.38" result="dark"/>
  <feComposite in="dark" in2="SourceAlpha" operator="in" result="d2"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="11" result="m"/>
  <feColorMatrix in="m" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${0.9 * lite} ${-0.42 * lite}" result="lite"/>
  <feComposite in="lite" in2="SourceAlpha" operator="in" result="l2"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="l2"/><feMergeNode in="d2"/></feMerge>
</filter>`;

function watercolorFill(p, d, clipId, id, seed, box, extra = '') {
  const r = rng(seed);
  const { x0, y0, x1, y1 } = box;
  const w = x1 - x0, h = y1 - y0;
  let blobs = '';
  // vùng sáng phía trên, đậm phía dưới, vài mảng xanh dương loang
  for (let i = 0; i < 9; i++) {
    const t = r();
    const col = t < 0.35 ? p.light : t < 0.65 ? p.mid : t < 0.85 ? p.accent : p.deep;
    const yy = y0 + h * (col === p.light ? 0.15 + r() * 0.35 : 0.35 + r() * 0.6);
    blobs += `<ellipse cx="${f(x0 + r() * w)}" cy="${f(yy)}" rx="${f(18 + r() * w * 0.22)}" ry="${f(14 + r() * h * 0.22)}" fill="${col}" opacity="${f(0.35 + r() * 0.35)}"/>`;
  }
  return `<g clip-path="url(#${clipId})">
    <path d="${d}" fill="${p.base}"/>
    <g filter="url(#${id}-blur)">${blobs}
      <ellipse cx="${f(x0 + w * 0.42)}" cy="${f(y0 + h * 0.32)}" rx="${f(w * 0.3)}" ry="${f(h * 0.22)}" fill="${p.light}" opacity=".8"/>
      <ellipse cx="${f(x0 + w * 0.7)}" cy="${f(y0 + h * 0.85)}" rx="${f(w * 0.35)}" ry="${f(h * 0.18)}" fill="${p.deep}" opacity=".45"/>
    </g>
    ${extra}
    <path d="${d}" fill="none" stroke="${p.edge}" stroke-width="9" opacity=".35" filter="url(#${id}-edge)"/>
  </g>`;
}

// ---------- tuyết ----------
function snowLayer(tiers, paths, i, cid, id, p) {
  const t = tiers[i];
  const h = t.bottom - t.top;
  const r = rng(91 + i * 37);
  let white = '';
  if (i === 0) {
    // chỏm tuyết trên đỉnh: phủ ~38% chiều cao, mép dưới lượn sóng không đều + giọt
    const y = t.top + h * 0.38;
    const k = 7, step = (2 * t.hw + 40) / k;
    let d = `M ${CX - t.hw - 20} ${t.top - 40} L ${CX + t.hw + 20} ${t.top - 40} L ${CX + t.hw + 20} ${f(y)}`;
    for (let j = 0; j < k; j++) {
      const x0 = CX + t.hw + 20 - j * step, x1 = x0 - step;
      const dip = 10 + r() * 20;
      d += ` C ${f(x0 - step * 0.1)} ${f(y + dip)} ${f(x1 + step * 0.1)} ${f(y + dip)} ${f(x1)} ${f(y + (r() - 0.5) * 6)}`;
    }
    white += `<path d="${d} Z"/>`;
  } else {
    // dải tuyết lộ ra ngay dưới các múi của tầng trên
    white += `<path d="${paths[i - 1]}" transform="translate(0 36)"/>`;
    const up = tiers[i - 1];
    const step = (2 * up.hw) / up.n;
    for (let j = 0; j < up.n; j++) {
      const x = CX + up.hw - (j + 0.5) * step;
      if (r() < 0.45) continue;
      const len = 6 + r() * 8;
      white += `<ellipse cx="${f(x + step * 0.25 + (r() - 0.5) * 8)}" cy="${f(up.bottom + 40 + len * 0.3)}" rx="${f(5 + r() * 3)}" ry="${f(len * 0.55)}"/>`;
    }
  }
  // tuyết đọng trên mép dưới của từng múi (nhô ra ngoài tán một chút)
  let rims = '';
  const step = (2 * t.hw) / t.n;
  for (let j = 0; j < t.n; j++) {
    const x = CX + t.hw - (j + 0.5) * step;
    const yb = t.bottom + step * 0.48 * 0.12;
    rims += `<path d="M ${f(x - step * 0.36)} ${f(yb - 4)} Q ${f(x - step * 0.3)} ${f(yb - 16)} ${f(x)} ${f(yb - 14)} Q ${f(x + step * 0.3)} ${f(yb - 16)} ${f(x + step * 0.36)} ${f(yb - 4)} Q ${f(x)} ${f(yb + 4)} ${f(x - step * 0.36)} ${f(yb - 4)} Z"/>`;
  }
  let sparkle = '';
  for (let j = 0; j < 10; j++) {
    const yy = i === 0 ? t.top + 6 + r() * h * 0.35 : tiers[i - 1].bottom + 18 + r() * 26;
    const xx = CX + (r() * 2 - 1) * Math.max(10, halfWidthAt('cloud3', yy) * 0.85);
    sparkle += `<circle cx="${f(xx)}" cy="${f(yy)}" r="${f(1 + r() * 1.6)}" fill="${r() < 0.5 ? '#FFFFFF' : '#CFE6F5'}"/>`;
  }
  let dust = '';
  for (let j = 0; j < 7; j++) {
    const yy = t.top + h * (0.55 + r() * 0.4);
    const xx = CX + (r() * 2 - 1) * halfWidthAt('cloud3', yy) * 0.8;
    dust += `<ellipse cx="${f(xx)}" cy="${f(yy)}" rx="${f(10 + r() * 14)}" ry="${f(5 + r() * 6)}"/>`;
  }
  const shade = '#A9C8DA';
  return `<g clip-path="url(#${cid})">
      <g fill="#FFFFFF" filter="url(#${id}-wob)">${white}</g>
      <g fill="none" stroke="${shade}" stroke-width="7" opacity=".55" filter="url(#${id}-edge)">${white.replace(/<path /g, '<path fill="none" ').replace(/<ellipse /g, '<ellipse fill="none" ')}</g>
      <g fill="#FFFFFF" opacity=".9" filter="url(#${id}-wob)">${white}</g>
    </g>
        <g clip-path="url(#${cid})"><g fill="#FFFFFF" opacity=".5" filter="url(#${id}-soft)">${dust}</g>${sparkle}</g>`;
}

export function canopySource(shape, paletteKey, id = 'cn') {
  const p = PALETTES[paletteKey];
  let body = '', clips = '';
  if (TIERS[shape]) {
    const tiers = TIERS[shape];
    const paths = tiers.map(tierPath);
    // vẽ tầng dưới trước, tầng trên đè lên; bóng của tầng trên đổ xuống tầng dưới
    for (let i = tiers.length - 1; i >= 0; i--) {
      const t = tiers[i], d = paths[i], cid = `${id}-c${i}`;
      clips += `<clipPath id="${cid}"><path d="${d}"/></clipPath>`;
      const shadow = i > 0 ? `<path d="${paths[i - 1]}" transform="translate(0 14)" fill="${p.deep}" opacity=".5" filter="url(#${id}-soft)"/>` : '';
      body += `<path d="${d}" fill="none" stroke="${p.edge}" stroke-width="3" opacity=".55" filter="url(#${id}-wob)"/>`;
      body += watercolorFill(p, d, cid, id, 17 + i * 31 + paletteKey.length, { x0: CX - t.hw, y0: t.top, x1: CX + t.hw, y1: t.bottom }, shadow);
      if (shape === 'snowy') body += snowLayer(tiers, paths, i, cid, id, p);
      body += `<path d="${d}" fill="none" stroke="${p.edge}" stroke-width="2.2" opacity=".5" filter="url(#${id}-wob)"/>`;
    }
  } else {
    const cs = puffyCircles();
    // nền lấp khe giữa các bông
    body += `<path d="M ${CX} 120 L 300 300 L 330 420 L 70 420 L 100 300 Z" fill="${p.mid}"/>`;
    cs.forEach((c, i) => {
      const cid = `${id}-p${i}`;
      const d = `M ${f(c.x - c.r)} ${f(c.y)} a ${c.r} ${c.r} 0 1 0 ${2 * c.r} 0 a ${c.r} ${c.r} 0 1 0 ${-2 * c.r} 0 Z`;
      clips += `<clipPath id="${cid}"><path d="${d}"/></clipPath>`;
      body += `<path d="${d}" fill="none" stroke="${p.edge}" stroke-width="3" opacity=".5" filter="url(#${id}-wob)"/>`;
      body += watercolorFill(p, d, cid, id, 23 + i * 17 + paletteKey.length, { x0: c.x - c.r, y0: c.y - c.r, x1: c.x + c.r, y1: c.y + c.r });
      body += `<path d="${d}" fill="none" stroke="${p.edge}" stroke-width="2" opacity=".45" filter="url(#${id}-wob)"/>`;
    });
  }
  return `<defs>${DEFS(id)}${clips}</defs><g filter="url(#${id}-paper)">${body}</g>`;
}

// ---------- thân cây ----------
function trunkPath(shape) {
  if (shape === 'flared') return 'M 182 420 L 218 420 Q 216 480 222 512 Q 230 532 252 540 Q 230 546 214 538 Q 206 548 194 540 Q 178 548 150 540 Q 170 532 178 512 Q 184 480 182 420 Z';
  if (shape === 'stout') return 'M 166 430 L 234 430 L 236 524 Q 236 540 200 542 Q 164 540 164 524 Z';
  return 'M 178 420 L 222 420 L 224 528 Q 224 540 200 541 Q 176 540 176 528 Z';
}

export function trunkSource(shape, woodKey, id = 'tk') {
  const w = WOODS[woodKey];
  const d = trunkPath(shape);
  const r = rng(woodKey.length * 13 + shape.length);
  let grain = '';
  if (woodKey === 'birch') {
    for (let i = 0; i < 9; i++) {
      const y = 438 + r() * 92, x = 172 + r() * 50, len = 6 + r() * 14;
      grain += `<path d="M ${f(x)} ${f(y)} q ${f(len / 2)} ${f(-2 - r() * 2)} ${f(len)} 0" stroke="${w.grain}" stroke-width="${f(2 + r() * 2.5)}" stroke-linecap="round" fill="none" opacity=".75"/>`;
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const x = 170 + i * 10 + r() * 6;
      grain += `<path d="M ${f(x)} 420 Q ${f(x + (r() - 0.5) * 10)} 470 ${f(x + (r() - 0.5) * 6)} 540" stroke="${w.grain}" stroke-width="${f(1.2 + r() * 1.6)}" fill="none" opacity=".45"/>`;
    }
    grain += `<ellipse cx="${f(192 + r() * 14)}" cy="${f(480 + r() * 30)}" rx="5" ry="8" fill="none" stroke="${w.grain}" stroke-width="2" opacity=".55"/><ellipse cx="${f(192 + r() * 14)}" cy="${f(480 + r() * 30)}" rx="2" ry="3.5" fill="${w.grain}" opacity=".45"/>`;
  }
  return `<defs>${DEFS(id)}
    <clipPath id="${id}-c"><path d="${d}"/></clipPath>
    <linearGradient id="${id}-g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${w.dark}"/><stop offset=".35" stop-color="${w.base}"/><stop offset=".62" stop-color="${w.light}"/><stop offset="1" stop-color="${w.base}"/></linearGradient>
  </defs>
  <g filter="url(#${id}-paper)">
    <ellipse cx="200" cy="542" rx="70" ry="9" fill="#1C1420" opacity=".22" filter="url(#${id}-soft)"/>
    <g clip-path="url(#${id}-c)"><rect x="140" y="400" width="120" height="160" fill="url(#${id}-g)"/>${grain}
      <rect x="140" y="400" width="120" height="40" fill="#1C1420" opacity=".25" filter="url(#${id}-soft)"/>
      <path d="${d}" fill="none" stroke="${w.dark}" stroke-width="8" opacity=".4" filter="url(#${id}-edge)"/></g>
    <path d="${d}" fill="none" stroke="${w.grain}" stroke-width="2.2" opacity=".6" filter="url(#${id}-wob)"/>
  </g>`;
}

// ---------- lớp đèn (SVG nhẹ, không bộ lọc, chạy hoạt ảnh bằng CSS) ----------
export function lightsSource(shape, count = 14, seed = 3) {
  const r = rng(seed * 101 + shape.length);
  const { top, bottom } = canopyBounds(shape);
  let s = '';
  let placed = 0, guard = 0;
  const pts = [];
  while (placed < count && guard++ < 2000) {
    const y = top + 40 + r() * (bottom - top - 60);
    const hw = halfWidthAt(shape, y) * 0.8;
    if (hw < 20) continue;
    const x = CX + (r() * 2 - 1) * hw;
    if (pts.some((p) => (p[0] - x) ** 2 + (p[1] - y) ** 2 < 46 * 46)) continue;
    pts.push([x, y]); placed++;
  }
  pts.forEach(([x, y], i) => {
    const big = i % 3 === 0;
    const col = i % 4 === 1 ? '#FFE9A8' : '#FFFFFF';
    s += `<g class="glow-light" style="--d:${((i * 0.53) % 2.6).toFixed(2)}s">
      <circle cx="${f(x)}" cy="${f(y)}" r="${big ? 16 : 11}" fill="url(#lg)"/>
      <path d="M ${f(x)} ${f(y - (big ? 7 : 5))} Q ${f(x + 1)} ${f(y - 1)} ${f(x + (big ? 7 : 5))} ${f(y)} Q ${f(x + 1)} ${f(y + 1)} ${f(x)} ${f(y + (big ? 7 : 5))} Q ${f(x - 1)} ${f(y + 1)} ${f(x - (big ? 7 : 5))} ${f(y)} Q ${f(x - 1)} ${f(y - 1)} ${f(x)} ${f(y - (big ? 7 : 5))} Z" fill="${col}"/>
    </g>`;
  });
  return `<defs><radialGradient id="lg"><stop offset="0" stop-color="#FFF8D6" stop-opacity=".95"/><stop offset=".4" stop-color="#FFF1B0" stop-opacity=".45"/><stop offset="1" stop-color="#FFF1B0" stop-opacity="0"/></radialGradient></defs>${s}`;
}

export function starSource(shape) {
  const { top } = canopyBounds(shape);
  const y = top - 26;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? 38 : 17;
    pts.push([CX + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  // sao bo tròn đầu nhọn: dùng đường cong qua các điểm
  let d = '';
  for (let i = 0; i < 10; i++) {
    const p = pts[i], n = pts[(i + 1) % 10];
    const mx = (p[0] + n[0]) / 2, my = (p[1] + n[1]) / 2;
    d += i === 0 ? `M ${f(mx)} ${f(my)}` : '';
    const nn = pts[(i + 2) % 10];
    d += ` Q ${f(n[0])} ${f(n[1])} ${f((n[0] + nn[0]) / 2)} ${f((n[1] + nn[1]) / 2)}`;
  }
  return `<defs>
    <radialGradient id="sg" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFF4B8"/><stop offset=".45" stop-color="#FFD24A"/><stop offset="1" stop-color="#F0A21E"/></radialGradient>
    <radialGradient id="sh"><stop offset="0" stop-color="#FFE48A" stop-opacity=".75"/><stop offset="1" stop-color="#FFE48A" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="top-star2" style="transform-origin:${CX}px ${f(y)}px">
    <circle class="star-halo" cx="${CX}" cy="${f(y)}" r="62" fill="url(#sh)" style="transform-origin:${CX}px ${f(y)}px"/>
    <path d="${d} Z" fill="url(#sg)" stroke="#D88A12" stroke-width="2" stroke-linejoin="round"/>
    <path d="M ${CX - 12} ${f(y - 10)} Q ${CX - 8} ${f(y - 20)} ${CX - 2} ${f(y - 22)}" stroke="#FFFBE6" stroke-width="4" stroke-linecap="round" fill="none" opacity=".9"/>
  </g>`;
}

export const TREE2_CSS = `
.glow-light{animation:glow-tw 2.8s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes glow-tw{0%,100%{opacity:1}50%{opacity:.3}}
.top-star2{transform-box:view-box;animation:star2 3.2s ease-in-out infinite}
.star-halo{transform-box:view-box;animation:halo2 3.2s ease-in-out infinite}
@keyframes star2{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg) scale(1.04)}}
@keyframes halo2{0%,100%{transform:scale(.85);opacity:.6}50%{transform:scale(1.15);opacity:1}}
.sway2{transform-origin:50% 90%;animation:sway2 6s ease-in-out infinite}
@keyframes sway2{0%,100%{transform:rotate(-.7deg)}50%{transform:rotate(.7deg)}}
.shake .sway2{animation:shake2 .8s ease-in-out}
@keyframes shake2{0%,100%{transform:rotate(0)}15%{transform:rotate(-3.5deg)}35%{transform:rotate(3deg)}55%{transform:rotate(-2deg)}75%{transform:rotate(1deg)}}
.shake .glow-light{animation:glow-flash .9s ease-out}
@keyframes glow-flash{0%{opacity:.2}30%{opacity:1;filter:brightness(1.6)}100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.glow-light,.top-star2,.star-halo,.sway2{animation:none}}
`;
