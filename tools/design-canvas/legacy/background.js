// Phông nền căn phòng (4 kiểu) trong khung cảnh 400 x 600. Sàn bắt đầu ở y = 460.

export const BACKGROUNDS = {
  'night-window': { name: 'Cửa sổ đêm tuyết' },
  'warm-wall':    { name: 'Tường gạch ấm' },
  'mint':         { name: 'Bạc hà ô cửa tròn' },
  'cream-stripes':{ name: 'Kem sọc hồng' },
};

const FLOOR_Y = 460;
const LINE = '#3A2E2A';
const f = (n) => Math.round(n * 10) / 10;

// số giả ngẫu nhiên cố định để bông tuyết luôn ở cùng vị trí
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

function snowfall(x, y, w, h, n, seed, big = 1) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const cx = x + r() * w;
    const cy = y + r() * h;
    const rad = (1.6 + r() * 2.4) * big;
    const dur = (5 + r() * 5).toFixed(2);
    const del = (-r() * 10).toFixed(2);
    out += `<circle class="snowflake" cx="${f(cx)}" cy="${f(cy)}" r="${f(rad)}" fill="#fff" style="--fall:${f(h + 40)}px;--dx:${f((r() - 0.5) * 30)}px;animation-duration:${dur}s;animation-delay:${del}s"/>`;
  }
  return out;
}

function floor(base, line, plank) {
  let s = `<rect x="0" y="${FLOOR_Y}" width="400" height="140" fill="${base}"/>`;
  for (let i = 1; i < 5; i++) {
    const y = FLOOR_Y + i * 28;
    s += `<path d="M 0 ${y} L 400 ${y}" stroke="${line}" stroke-width="2" opacity=".5"/>`;
    const off = (i * 97) % 140;
    for (let x = off; x < 400; x += 140) s += `<path d="M ${x} ${y - 28} L ${x} ${y}" stroke="${line}" stroke-width="2" opacity=".5"/>`;
  }
  s += `<rect x="0" y="${FLOOR_Y - 14}" width="400" height="16" fill="${plank}" stroke="${LINE}" stroke-width="3"/>`;
  return s;
}

function stringLights(y0, sag, count, seed) {
  // dây đèn võng qua phía trên tường
  const cols = ['#FFD45C', '#FF7A7A', '#7FD0FF', '#9BE58A', '#FFB0E0'];
  let wire = `<path d="M -10 ${y0} Q 100 ${y0 + sag} 200 ${y0} Q 300 ${y0 + sag} 410 ${y0}" fill="none" stroke="${LINE}" stroke-width="2.5" opacity=".7"/>`;
  let bulbs = '';
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const half = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const xa = t < 0.5 ? -10 : 200, xb = t < 0.5 ? 200 : 410;
    const x = (1 - half) * (1 - half) * xa + 2 * (1 - half) * half * ((xa + xb) / 2) + half * half * xb;
    const y = (1 - half) * (1 - half) * y0 + 2 * (1 - half) * half * (y0 + sag) + half * half * y0;
    const c = cols[(i + seed) % cols.length];
    bulbs += `<g class="wall-light" style="--d:${((i * 0.41) % 1.8).toFixed(2)}s"><rect x="${f(x - 3)}" y="${f(y)}" width="6" height="5" rx="1.5" fill="#6B5A52"/><ellipse cx="${f(x)}" cy="${f(y + 13)}" rx="11" ry="12" fill="${c}" opacity=".3"/><ellipse cx="${f(x)}" cy="${f(y + 12)}" rx="5.5" ry="8" fill="${c}" stroke="${LINE}" stroke-width="1.8"/></g>`;
  }
  return `<g class="wall-lights">${wire}${bulbs}</g>`;
}

function hangingStar(x, y, len, col) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 15 : 7;
    pts.push(`${f(x + r * Math.cos(a))},${f(y + len + r * Math.sin(a))}`);
  }
  return `<g class="hang" style="transform-origin:${x}px ${y}px;--d:${(x % 7) / 3}s"><path d="M ${x} ${y} L ${x} ${y + len - 14}" stroke="${LINE}" stroke-width="2" opacity=".6"/><polygon points="${pts.join(' ')}" fill="${col}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/></g>`;
}

function curtain(side, color, shade) {
  // rèm hai bên, mép dưới buộc gọn
  const x = side === 'left' ? 0 : 400;
  const s = side === 'left' ? 1 : -1;
  const d = `M ${x} 0 L ${x + s * 86} 0 Q ${x + s * 70} 140 ${x + s * 44} 250 Q ${x + s * 30} 310 ${x + s * 58} 420 L ${x} 420 Z`;
  return `<g class="curtain" style="transform-origin:${x}px 0px">
    <path d="${d}" fill="${color}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M ${x + s * 30} 10 Q ${x + s * 26} 140 ${x + s * 18} 250 M ${x + s * 58} 10 Q ${x + s * 50} 140 ${x + s * 34} 250" stroke="${shade}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="${side === 'left' ? 30 : 346}" y="244" width="24" height="16" rx="7" fill="#F4C542" stroke="${LINE}" stroke-width="3"/>
  </g>`;
}

function nightWindow(id) {
  const wx = 46, wy = 44, ww = 308, wh = 250;
  let s = `<rect width="400" height="600" fill="#F3D9B9"/>`;
  // giấy dán tường chấm nhỏ
  for (let y = 20; y < FLOOR_Y; y += 40) for (let x = (y / 40) % 2 ? 20 : 40; x < 400; x += 40) s += `<circle cx="${x}" cy="${y}" r="2.5" fill="#E7C6A0"/>`;
  s += `<clipPath id="${id}-w"><rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="18"/></clipPath>`;
  s += `<g clip-path="url(#${id}-w)">
    <rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="#24345C"/>
    <circle class="moon-glow" cx="290" cy="98" r="44" fill="#FFF3C4" opacity=".18"/>
    <circle cx="290" cy="98" r="24" fill="#FFF3C4"/><circle cx="281" cy="92" r="4.5" fill="#F1DFA0"/><circle cx="297" cy="106" r="3" fill="#F1DFA0"/>
    ${[[90, 80], [140, 120], [200, 70], [120, 180], [330, 160], [240, 140]].map(([x, y], i) => `<path class="twinkle-star" style="--d:${i * 0.5}s" d="M ${x} ${y - 6} L ${x + 1.8} ${y - 1.8} L ${x + 6} ${y} L ${x + 1.8} ${y + 1.8} L ${x} ${y + 6} L ${x - 1.8} ${y + 1.8} L ${x - 6} ${y} L ${x - 1.8} ${y - 1.8} Z" fill="#FFF6C8"/>`).join('')}
    <path d="M ${wx} 260 Q 120 220 200 250 Q 280 280 ${wx + ww} 236 L ${wx + ww} ${wy + wh} L ${wx} ${wy + wh} Z" fill="#E9F3F7"/>
    <path d="M 82 252 l 14 -34 l 14 34 Z M 300 246 l 12 -30 l 12 30 Z" fill="#2F7D5B" stroke="#1E4D39" stroke-width="2"/>
    <g class="snow-layer">${snowfall(wx, wy, ww, wh, 34, 7)}</g>
  </g>`;
  // khung cửa gỗ
  s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="18" fill="none" stroke="#8A5A36" stroke-width="12"/>
    <rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="18" fill="none" stroke="${LINE}" stroke-width="3"/>
    <path d="M 200 ${wy} L 200 ${wy + wh} M ${wx} ${wy + wh / 2} L ${wx + ww} ${wy + wh / 2}" stroke="#8A5A36" stroke-width="9"/>
    <rect x="${wx - 16}" y="${wy + wh}" width="${ww + 32}" height="16" rx="7" fill="#A8744A" stroke="${LINE}" stroke-width="3"/>
    <path d="M ${wx - 10} ${wy + wh + 2} Q ${wx + 40} ${wy + wh - 10} ${wx + 90} ${wy + wh + 2} Q ${wx + 160} ${wy + wh - 8} ${wx + 230} ${wy + wh + 2} Q ${wx + 290} ${wy + wh - 10} ${wx + ww + 10} ${wy + wh + 2} Z" fill="#fff"/>`;
  s += curtain('left', '#D94B4B', '#B83A3A') + curtain('right', '#D94B4B', '#B83A3A');
  s += floor('#D9A066', '#B98048', '#C98E5A');
  return s;
}

function warmWall() {
  let s = `<rect width="400" height="600" fill="#C8674F"/>`;
  for (let row = 0; row * 30 < FLOOR_Y; row++) {
    const y = row * 30;
    const off = row % 2 ? -30 : 0;
    for (let x = off; x < 400; x += 60) {
      const tone = ((row * 7 + x) % 3) === 0 ? '#D27A60' : ((row + x) % 5 === 0 ? '#B85C46' : '#CC6E55');
      s += `<rect x="${x + 3}" y="${y + 3}" width="54" height="24" rx="6" fill="${tone}"/>`;
    }
  }
  s += `<rect width="400" height="${FLOOR_Y}" fill="#3A1E14" opacity=".08"/>`;
  s += stringLights(18, 46, 14, 0);
  // khung ảnh nhỏ và đồng hồ
  s += `<g><rect x="26" y="150" width="70" height="86" rx="10" fill="#F6E7CF" stroke="#7A4A2A" stroke-width="7"/><path d="M 40 222 l 20 -34 l 12 18 l 8 -10 l 12 26 Z" fill="#78B1E0"/><circle cx="74" cy="176" r="7" fill="#F4C542"/></g>`;
  s += `<g><circle cx="344" cy="190" r="34" fill="#FFF6E5" stroke="#7A4A2A" stroke-width="7"/><path class="clock-hand" d="M 344 190 L 344 168" stroke="${LINE}" stroke-width="3.5" stroke-linecap="round" style="transform-origin:344px 190px"/><path d="M 344 190 L 358 196" stroke="${LINE}" stroke-width="3.5" stroke-linecap="round"/><circle cx="344" cy="190" r="3.5" fill="#D94B4B"/></g>`;
  s += floor('#B07A4E', '#8C5C36', '#9A6640');
  return s;
}

function mint(id) {
  let s = `<rect width="400" height="600" fill="#BFE6D6"/>`;
  for (let x = 0; x < 400; x += 32) s += `<rect x="${x}" y="0" width="12" height="${FLOOR_Y}" fill="#ADDCC8"/>`;
  // dây cờ đuôi nheo
  const cols = ['#D94B4B', '#F4C542', '#FFFFFF', '#2F7D5B'];
  s += `<path d="M -5 26 Q 200 70 405 26" stroke="${LINE}" stroke-width="2.5" fill="none" opacity=".7"/>`;
  for (let i = 0; i < 11; i++) {
    const t = (i + 0.5) / 11;
    const x = -5 + 410 * t;
    const y = (1 - t) * (1 - t) * 26 + 2 * (1 - t) * t * 70 + t * t * 26;
    s += `<g class="flag" style="transform-origin:${f(x)}px ${f(y)}px;--d:${(i * 0.23).toFixed(2)}s"><path d="M ${f(x - 13)} ${f(y)} L ${f(x + 13)} ${f(y)} L ${f(x)} ${f(y + 30)} Z" fill="${cols[i % 4]}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/></g>`;
  }
  // ô cửa tròn có tuyết
  s += `<clipPath id="${id}-p"><circle cx="322" cy="150" r="52"/></clipPath>`;
  s += `<g clip-path="url(#${id}-p)"><rect x="260" y="90" width="130" height="130" fill="#7FA9D9"/><path d="M 260 186 Q 320 166 390 182 L 390 220 L 260 220 Z" fill="#fff"/><g class="snow-layer">${snowfall(266, 96, 116, 110, 14, 21)}</g></g>`;
  s += `<circle cx="322" cy="150" r="52" fill="none" stroke="#FFF6E5" stroke-width="12"/><circle cx="322" cy="150" r="58" fill="none" stroke="${LINE}" stroke-width="3"/><circle cx="322" cy="150" r="46" fill="none" stroke="${LINE}" stroke-width="2.5"/>`;
  // kệ với nến và cốc
  s += `<rect x="18" y="200" width="104" height="12" rx="5" fill="#A8744A" stroke="${LINE}" stroke-width="3"/>
    <rect x="34" y="166" width="18" height="34" rx="4" fill="#FFF6E5" stroke="${LINE}" stroke-width="2.5"/><path class="flame" d="M 43 164 q -7 -10 0 -20 q 7 10 0 20 Z" fill="#FFB547" stroke="#C9741A" stroke-width="2" style="transform-origin:43px 164px"/>
    <path d="M 70 176 h 32 v 18 q 0 6 -6 6 h -20 q -6 0 -6 -6 Z" fill="#D94B4B" stroke="${LINE}" stroke-width="2.5"/><path d="M 102 182 q 10 0 10 7 q 0 7 -10 7" fill="none" stroke="${LINE}" stroke-width="2.5"/>
    <path class="steam" d="M 80 170 q -5 -8 0 -16 q 5 -8 0 -16 M 92 170 q -5 -8 0 -16 q 5 -8 0 -16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
  s += floor('#E8C9A0', '#C9A57A', '#D9B88C');
  return s;
}

function creamStripes() {
  let s = `<rect width="400" height="600" fill="#FFF1E2"/>`;
  for (let x = 10; x < 400; x += 44) s += `<rect x="${x}" y="0" width="16" height="${FLOOR_Y}" fill="#FAD6D6"/>`;
  for (let x = 32; x < 400; x += 44) for (let y = 30; y < FLOOR_Y; y += 60) s += `<circle cx="${x}" cy="${y}" r="3" fill="#F4B6B6"/>`;
  s += `<rect x="0" y="0" width="400" height="14" fill="#E9A8A8"/>`;
  [[54, 0, 70, '#F4C542'], [120, 0, 40, '#FFFFFF'], [290, 0, 54, '#F4C542'], [350, 0, 86, '#FFFFFF']].forEach(([x, y, l, c]) => { s += hangingStar(x, y, l, c); });
  // kệ treo tường bên phải: hộp quà nhỏ + gấu bông mini
  s += `<rect x="286" y="236" width="96" height="12" rx="5" fill="#C98E5A" stroke="${LINE}" stroke-width="3"/>
    <rect x="296" y="210" width="28" height="26" rx="4" fill="#78B1E0" stroke="${LINE}" stroke-width="2.5"/><path d="M 310 210 v 26 M 296 222 h 28" stroke="#F4C542" stroke-width="4"/>
    <circle cx="352" cy="220" r="15" fill="#D9A066" stroke="${LINE}" stroke-width="2.5"/><circle cx="341" cy="207" r="6" fill="#D9A066" stroke="${LINE}" stroke-width="2.5"/><circle cx="363" cy="207" r="6" fill="#D9A066" stroke="${LINE}" stroke-width="2.5"/><circle cx="347" cy="218" r="2" fill="${LINE}"/><circle cx="357" cy="218" r="2" fill="${LINE}"/><ellipse cx="352" cy="225" rx="4" ry="3" fill="#7A4A2A"/>`;
  // khung ảnh trái
  s += `<rect x="24" y="190" width="74" height="60" rx="10" fill="#FFFFFF" stroke="#C98E5A" stroke-width="6"/><path d="M 34 238 q 14 -26 26 -10 q 10 -16 28 10 Z" fill="#9BD3B5"/><circle cx="80" cy="208" r="6" fill="#FF9AA8"/>`;
  s += floor('#E5B98A', '#C79A6A', '#D8A876');
  return s;
}

export function backgroundSVG(kind = 'night-window', idPrefix = 'bg') {
  let inner;
  if (kind === 'warm-wall') inner = warmWall();
  else if (kind === 'mint') inner = mint(idPrefix);
  else if (kind === 'cream-stripes') inner = creamStripes();
  else inner = nightWindow(idPrefix);
  return `<g class="bg" data-part="background">${inner}</g>`;
}

export const BACKGROUND_CSS = `
.snowflake{animation:snowfall linear infinite}
@keyframes snowfall{from{transform:translate(0,calc(-1 * var(--fall,300px)))}to{transform:translate(var(--dx,0),0)}}
.gust .snowflake{animation-duration:1.4s!important}
.twinkle-star{animation:twinkle 2.6s ease-in-out infinite;animation-delay:var(--d,0s)}
.moon-glow{transform-box:fill-box;transform-origin:center;animation:moon 4s ease-in-out infinite}
@keyframes moon{0%,100%{transform:scale(1);opacity:.15}50%{transform:scale(1.2);opacity:.3}}
.gust .moon-glow{animation:moon .6s ease-in-out 3}
.curtain{transform-box:view-box;animation:curtain 7s ease-in-out infinite}
@keyframes curtain{0%,100%{transform:skewX(0)}50%{transform:skewX(1.2deg)}}
.gust .curtain{animation:curtain-gust 1.2s ease-in-out}
@keyframes curtain-gust{0%,100%{transform:skewX(0)}30%{transform:skewX(4deg)}60%{transform:skewX(-2deg)}}
.wall-light{animation:twinkle 1.8s ease-in-out infinite;animation-delay:var(--d,0s)}
.gust .wall-light{animation:chase .25s linear 6;animation-delay:var(--d,0s)}
@keyframes chase{0%,100%{opacity:1}50%{opacity:.2}}
.hang,.flag{transform-box:view-box;animation:swing 3.4s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes swing{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.gust .hang,.gust .flag{animation:swing .5s ease-in-out 3}
.flame{transform-box:view-box;animation:flame .9s ease-in-out infinite alternate}
@keyframes flame{from{transform:scale(1,1) rotate(-3deg)}to{transform:scale(.9,1.12) rotate(3deg)}}
.steam{animation:steam 3s ease-in-out infinite}
@keyframes steam{0%{opacity:0;transform:translateY(6px)}40%{opacity:.8}100%{opacity:0;transform:translateY(-10px)}}
.clock-hand{transform-box:view-box;animation:clock 10s linear infinite}
@keyframes clock{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.snowflake,.twinkle-star,.moon-glow,.curtain,.wall-light,.hang,.flag,.flame,.steam,.clock-hand{animation:none}}
`;
