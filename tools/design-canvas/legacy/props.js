// Đồ vật trong phòng: lò sưởi + ống khói, nội thất, hộp quà, đồ trang trí.
// Hệ toạ độ riêng: tâm x = 0, đáy chạm sàn y = 0 (vòng nguyệt quế: móc treo ở y = 0).

export const PROPS = {
  'fireplace':       { name: 'Lò sưởi gạch đỏ', group: 'fireplace' },
  'fireplace-stone': { name: 'Lò sưởi đá trắng', group: 'fireplace' },
  'furn-armchair':   { name: 'Ghế bành', group: 'furniture' },
  'furn-table':      { name: 'Bàn bánh quy & sữa', group: 'furniture' },
  'furn-rug':        { name: 'Thảm tròn', group: 'furniture' },
  'furn-bookshelf':  { name: 'Kệ sách nhỏ', group: 'furniture' },
  'gift-red':        { name: 'Quà đỏ', group: 'gift' },
  'gift-green':      { name: 'Quà xanh', group: 'gift' },
  'gift-gold':       { name: 'Quà vàng', group: 'gift' },
  'gift-blue':       { name: 'Quà xanh dương', group: 'gift' },
  'deco-wreath':     { name: 'Vòng nguyệt quế', group: 'deco' },
  'deco-candle':     { name: 'Đèn lồng nến', group: 'deco' },
  'deco-snowman':    { name: 'Người tuyết', group: 'deco' },
};

const L = '#3A2E2A';
const SW = 'stroke="#3A2E2A" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
const f = (n) => Math.round(n * 10) / 10;

function sparkles(y, n = 5) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = -50 + (100 * i) / (n - 1);
    const yy = y - ((i * 37) % 30);
    s += `<path style="--d:${(i * 0.08).toFixed(2)}s" d="M ${f(x)} ${f(yy - 7)} L ${f(x + 2)} ${f(yy - 2)} L ${f(x + 7)} ${f(yy)} L ${f(x + 2)} ${f(yy + 2)} L ${f(x)} ${f(yy + 7)} L ${f(x - 2)} ${f(yy + 2)} L ${f(x - 7)} ${f(yy)} L ${f(x - 2)} ${f(yy - 2)} Z" fill="#FFD447" stroke="${L}" stroke-width="1.5"/>`;
  }
  return `<g class="sparkles">${s}</g>`;
}

function sock(x, y, color, cuff, i) {
  return `<g class="stocking" style="transform-origin:${x}px ${y}px;--d:${i * 0.6}s">
    <path d="M ${x - 11} ${y} L ${x + 11} ${y} L ${x + 11} ${y + 34} Q ${x + 12} ${y + 46} ${x} ${y + 48} L ${x - 14} ${y + 48} Q ${x - 26} ${y + 46} ${x - 24} ${y + 38} Q ${x - 22} ${y + 32} ${x - 11} ${y + 32} Z" fill="${color}" ${SW}/>
    <rect x="${x - 14}" y="${y - 4}" width="28" height="12" rx="5" fill="${cuff}" ${SW}/>
  </g>`;
}

function fireplace(stone) {
  const wall = stone ? '#E7E3DC' : '#C8674F';
  const brick = stone ? '#D4CEC4' : '#B4553F';
  const mantel = stone ? '#8A5A36' : '#7A4A2A';
  // gạch / đá cho thân lò và ống khói
  let bricks = '';
  const brickRows = (x0, x1, y0, y1, h, w) => {
    let s = '';
    for (let r = 0, y = y0; y < y1; r++, y += h) {
      for (let x = x0 + (r % 2 ? -w / 2 : 0); x < x1; x += w) {
        const xa = Math.max(x + 2, x0 + 2), xb = Math.min(x + w - 2, x1 - 2);
        if (xb - xa > 6) s += `<rect x="${f(xa)}" y="${f(y + 2)}" width="${f(xb - xa)}" height="${f(h - 4)}" rx="${stone ? 7 : 3}" fill="${brick}"/>`;
      }
    }
    return s;
  };
  bricks += brickRows(-46, 46, -330, -178, 16, stone ? 30 : 26);
  bricks += brickRows(-92, 92, -162, 0, 18, stone ? 34 : 28);
  return `
  <g class="chimney-smoke">
    <circle class="puff" style="--d:0s" cx="-6" cy="-352" r="12" fill="#fff" stroke="#C9C2BA" stroke-width="2.5"/>
    <circle class="puff" style="--d:1.2s" cx="8" cy="-352" r="10" fill="#fff" stroke="#C9C2BA" stroke-width="2.5"/>
    <circle class="puff" style="--d:2.4s" cx="0" cy="-352" r="14" fill="#fff" stroke="#C9C2BA" stroke-width="2.5"/>
  </g>
  <rect x="-46" y="-330" width="92" height="160" fill="${wall}" ${SW}/>
  <rect x="-56" y="-344" width="112" height="18" rx="5" fill="${stone ? '#BDB6AC' : '#9C4A36'}" ${SW}/>
  <rect x="-92" y="-162" width="184" height="162" fill="${wall}" ${SW}/>
  ${bricks}
  <rect x="-46" y="-330" width="92" height="160" fill="none" ${SW}/>
  <rect x="-92" y="-162" width="184" height="162" fill="none" ${SW}/>
  <path d="M -58 0 L -58 -96 Q -58 -124 -30 -124 L 30 -124 Q 58 -124 58 -96 L 58 0 Z" fill="#3A2E2A" stroke="${L}" stroke-width="4"/>
  <path d="M -48 0 L -48 -90 Q -48 -112 -26 -112 L 26 -112 Q 48 -112 48 -90 L 48 0 Z" fill="#4A2E26"/>
  <g class="fire">
    <ellipse class="fire-glow" cx="0" cy="-44" rx="42" ry="32" fill="#FFB547" opacity=".35"/>
    <path class="flame-a" d="M -30 -14 Q -36 -46 -14 -66 Q -14 -46 -4 -42 Q -2 -70 14 -84 Q 14 -56 26 -48 Q 38 -36 30 -14 Z" fill="#FF7A3A" stroke="#B9461A" stroke-width="3" stroke-linejoin="round"/>
    <path class="flame-b" d="M -18 -14 Q -22 -38 -6 -48 Q -2 -34 4 -34 Q 6 -52 16 -58 Q 18 -38 22 -30 Q 26 -20 20 -14 Z" fill="#FFC94A"/>
    <path class="flame-c" d="M -6 -14 Q -8 -28 2 -34 Q 8 -24 10 -14 Z" fill="#FFF3C4"/>
  </g>
  <g class="fire-sparks">${[[-16, -60], [6, -78], [20, -64], [-4, -88]].map(([x, y], i) => `<circle style="--d:${i * 0.1}s" cx="${x}" cy="${y}" r="3" fill="#FFD447"/>`).join('')}</g>
  <rect x="-38" y="-16" width="76" height="12" rx="6" fill="#8A5A36" ${SW} transform="rotate(-6 0 -10)"/>
  <rect x="-36" y="-12" width="72" height="12" rx="6" fill="#A8744A" ${SW} transform="rotate(7 0 -6)"/>
  <rect x="-108" y="-176" width="216" height="20" rx="7" fill="${mantel}" ${SW}/>
  <path d="M -96 -158 Q -76 -146 -56 -158 Q -36 -146 -16 -158 Q 4 -146 24 -158 Q 44 -146 64 -158 Q 84 -146 98 -158" fill="none" stroke="#2F8360" stroke-width="9" stroke-linecap="round"/>
  ${[-80, -40, 0, 40, 80].map((x, i) => `<circle class="light" style="--d:${(i * 0.4).toFixed(1)}s" cx="${x - 8}" cy="${i % 2 ? -150 : -152}" r="4.5" fill="${['#FFD45C', '#FF7A7A', '#7FD0FF', '#FFB0E0', '#9BE58A'][i]}" stroke="${L}" stroke-width="1.5"/>`).join('')}
  ${sock(-62, -150, '#D94B4B', '#FFFFFF', 0)}${sock(62, -150, '#2F8360', '#FFFFFF', 1)}
  <g transform="translate(0 -176)"><rect x="-12" y="-28" width="12" height="28" rx="3" fill="#FFF6E5" ${SW}/><path class="flame" d="M -6 -30 q -6 -9 0 -18 q 6 9 0 18 Z" fill="#FFB547" stroke="#C9741A" stroke-width="2" style="transform-origin:-6px -30px"/><rect x="10" y="-18" width="22" height="18" rx="4" fill="#F4C542" ${SW}/></g>
  ${sparkles(-200, 5)}`;
}

function armchair() {
  const c = '#D94B4B', d = '#B83A3A';
  return `
  <rect x="-48" y="-14" width="10" height="16" rx="4" fill="#7A4A2A" ${SW}/><rect x="38" y="-14" width="10" height="16" rx="4" fill="#7A4A2A" ${SW}/>
  <path d="M -46 -60 Q -48 -118 0 -120 Q 48 -118 46 -60 Z" fill="${c}" ${SW}/>
  <path d="M -30 -66 Q -28 -104 0 -106 Q 28 -104 30 -66" fill="none" stroke="${d}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="-14" cy="-90" r="3" fill="${d}"/><circle cx="14" cy="-90" r="3" fill="${d}"/><circle cx="0" cy="-104" r="3" fill="${d}"/>
  <rect class="cushion" x="-44" y="-50" width="88" height="24" rx="11" fill="#F6C9C9" ${SW}/>
  <rect x="-46" y="-30" width="92" height="20" rx="8" fill="${c}" ${SW}/>
  <path d="M -64 -16 Q -70 -64 -48 -66 Q -34 -64 -36 -16 Z" fill="${c}" ${SW}/>
  <path d="M 64 -16 Q 70 -64 48 -66 Q 34 -64 36 -16 Z" fill="${c}" ${SW}/>
  <path d="M -60 -50 Q -50 -60 -42 -50" fill="none" stroke="#FFB3B3" stroke-width="3" stroke-linecap="round"/>
  <path d="M -40 -64 Q -42 -84 -24 -80 L -12 -60 Z" fill="#9BD3B5" ${SW} transform="rotate(-8 -24 -70)"/>`;
}

function table() {
  return `
  <path d="M -6 -50 L -10 -4 M 6 -50 L 10 -4" stroke="${L}" stroke-width="12" stroke-linecap="round"/>
  <path d="M -6 -50 L -10 -4 M 6 -50 L 10 -4" stroke="#A8744A" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="0" cy="-2" rx="28" ry="7" fill="#A8744A" ${SW}/>
  <ellipse cx="0" cy="-54" rx="52" ry="12" fill="#C98E5A" ${SW}/>
  <ellipse cx="-14" cy="-60" rx="26" ry="6" fill="#FFFFFF" ${SW}/>
  <g class="cookie"><circle cx="-24" cy="-66" r="10" fill="#D9A066" ${SW}/><circle cx="-27" cy="-68" r="1.8" fill="#5A3A22"/><circle cx="-21" cy="-63" r="1.8" fill="#5A3A22"/></g>
  <g class="cookie" style="--d:.1s"><circle cx="-6" cy="-68" r="10" fill="#D9A066" ${SW}/><path d="M -10 -70 q 4 -3 8 0" stroke="#fff" stroke-width="2" fill="none"/><circle cx="-4" cy="-66" r="1.8" fill="#5A3A22"/></g>
  <path d="M 18 -60 L 20 -96 L 40 -96 L 42 -60 Q 30 -56 18 -60 Z" fill="#FFFFFF" ${SW}/>
  <path class="milk" d="M 19.5 -80 L 40.5 -80 L 41.5 -61 Q 30 -57.5 18.5 -61 Z" fill="#EAF4FF"/>
  <path d="M 24 -90 L 25 -66" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
}

function rug() {
  return `
  <ellipse cx="0" cy="-14" rx="96" ry="22" fill="#D94B4B" ${SW}/>
  <ellipse cx="0" cy="-14" rx="76" ry="16" fill="#F4C542" stroke="#C99A1F" stroke-width="2.5"/>
  <ellipse cx="0" cy="-14" rx="56" ry="11" fill="#2F8360" stroke="#1E5A41" stroke-width="2.5"/>
  <ellipse cx="0" cy="-14" rx="34" ry="6.5" fill="#FFF6E5"/>
  ${[-90, -60, -30, 0, 30, 60, 90].map((x) => `<path d="M ${x} ${f(-14 + 22 * Math.sqrt(Math.max(0, 1 - (x / 96) ** 2)))} l 0 6" stroke="#F4C542" stroke-width="3" stroke-linecap="round"/>`).join('')}`;
}

function bookshelf() {
  const cols = ['#D94B4B', '#2F8360', '#F4C542', '#78B1E0', '#F6A3BA', '#9C6B43'];
  let books = '';
  let x = -36;
  for (let i = 0; i < 6; i++) {
    const w = 9 + (i % 3) * 2, h = 34 + ((i * 7) % 10);
    books += `<rect x="${x}" y="${-54 - h}" width="${w}" height="${h}" rx="2" fill="${cols[i]}" stroke="${L}" stroke-width="2.5"/>`;
    x += w + 1.5;
  }
  let x2 = -36;
  for (let i = 0; i < 5; i++) {
    const w = 10 + (i % 2) * 3, h = 30 + ((i * 5) % 9);
    books += `<rect x="${x2}" y="${-10 - h}" width="${w}" height="${h}" rx="2" fill="${cols[(i + 3) % 6]}" stroke="${L}" stroke-width="2.5"/>`;
    x2 += w + 1.5;
  }
  return `
  <rect x="-46" y="-104" width="92" height="104" rx="6" fill="#A8744A" ${SW}/>
  <rect x="-38" y="-96" width="76" height="42" fill="#7A4A2A"/>
  <rect x="-38" y="-50" width="76" height="40" fill="#7A4A2A"/>
  ${books}
  <rect x="-46" y="-56" width="92" height="6" fill="#A8744A" stroke="${L}" stroke-width="2.5"/>
  <g class="shelf-plant"><path d="M 22 -54 L 24 -70 L 36 -70 L 38 -54 Z" fill="#D9774A" stroke="${L}" stroke-width="2.5"/><path d="M 30 -70 Q 22 -86 18 -84 M 30 -70 Q 32 -90 36 -88 M 30 -70 Q 40 -80 44 -76" stroke="#2F8360" stroke-width="5" stroke-linecap="round" fill="none"/></g>
  <circle cx="26" cy="-22" r="10" fill="#F4C542" stroke="${L}" stroke-width="2.5"/>`;
}

const GIFT = {
  red:   { box: '#D94B4B', dark: '#B83A3A', ribbon: '#F4C542', w: 64, h: 50 },
  green: { box: '#2F8360', dark: '#236A4D', ribbon: '#D94B4B', w: 50, h: 64 },
  gold:  { box: '#F4C542', dark: '#D9A82E', ribbon: '#D94B4B', w: 56, h: 40 },
  blue:  { box: '#78B1E0', dark: '#5690C4', ribbon: '#FFFFFF', w: 46, h: 46 },
};

function gift(kind) {
  const g = GIFT[kind];
  const hw = g.w / 2;
  let pattern = '';
  if (kind === 'red' || kind === 'blue') for (let i = 0; i < 4; i++) pattern += `<circle cx="${f(-hw + 8 + ((i * 13) % (g.w - 14)))}" cy="${f(-8 - ((i * 11) % (g.h - 18)))}" r="3" fill="#fff" opacity=".7"/>`;
  if (kind === 'green') for (let y = -12; y > -g.h + 4; y -= 12) pattern += `<path d="M ${-hw + 3} ${y} L ${hw - 3} ${y - 6}" stroke="#55AC85" stroke-width="3"/>`;
  return `
  <rect x="${-hw}" y="${-g.h}" width="${g.w}" height="${g.h}" rx="5" fill="${g.box}" ${SW}/>
  ${pattern}
  <rect x="-5" y="${-g.h}" width="10" height="${g.h}" fill="${g.ribbon}" stroke="${L}" stroke-width="2.5"/>
  <g class="gift-lid">
    <rect x="${-hw - 5}" y="${-g.h - 12}" width="${g.w + 10}" height="16" rx="5" fill="${g.dark}" ${SW}/>
    <rect x="-5" y="${-g.h - 12}" width="10" height="16" fill="${g.ribbon}" stroke="${L}" stroke-width="2.5"/>
    <g class="bow"><path d="M 0 ${-g.h - 12} q -22 -18 -24 -2 q 2 10 24 2 q 22 -18 24 -2 q -2 10 -24 2" fill="${g.ribbon}" ${SW}/><circle cx="0" cy="${-g.h - 13}" r="5" fill="${g.ribbon}" ${SW}/></g>
  </g>
  ${sparkles(-g.h - 30, 4)}`;
}

function wreath() {
  let leaves = '';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const x = Math.cos(a) * 36, y = 46 + Math.sin(a) * 36;
    leaves += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="14" ry="8" fill="${i % 2 ? '#2F8360' : '#3E9760'}" stroke="#1E5A41" stroke-width="2.5" transform="rotate(${f((a * 180) / Math.PI + 90)} ${f(x)} ${f(y)})"/>`;
  }
  const berries = [0.3, 1.4, 2.6, 3.7, 4.9].map((a, i) => `<circle class="light" style="--d:${i * 0.3}s" cx="${f(Math.cos(a) * 38)}" cy="${f(46 + Math.sin(a) * 38)}" r="5" fill="#D94B4B" stroke="${L}" stroke-width="2"/>`).join('');
  return `<g class="swing">
  <path d="M 0 0 L 0 12" stroke="${L}" stroke-width="3"/>
  ${leaves}${berries}
  <g class="bow"><path d="M 0 82 q -24 -16 -24 2 q 4 10 24 -2 q 24 -16 24 2 q -4 10 -24 -2" fill="#D94B4B" ${SW}/><path d="M -4 84 L -14 104 M 4 84 L 14 104" stroke="#D94B4B" stroke-width="7" stroke-linecap="round"/><circle cx="0" cy="82" r="6" fill="#B83A3A" ${SW}/></g>
  </g>`;
}

function candle() {
  return `
  <path d="M -22 -78 L 22 -78 L 26 -4 Q 26 0 22 0 L -22 0 Q -26 0 -26 -4 Z" fill="#FFE9B3" fill-opacity=".55" ${SW}/>
  <rect x="-30" y="-8" width="60" height="10" rx="4" fill="#2E3B5C" ${SW}/>
  <path d="M -26 -78 L 26 -78 L 16 -96 L -16 -96 Z" fill="#2E3B5C" ${SW}/>
  <path d="M -8 -96 Q 0 -114 8 -96" fill="none" stroke="${L}" stroke-width="4"/>
  <ellipse class="candle-glow" cx="0" cy="-44" rx="22" ry="26" fill="#FFD447" opacity=".35"/>
  <rect x="-8" y="-36" width="16" height="28" rx="3" fill="#FFF6E5" ${SW}/>
  <path class="flame" d="M 0 -38 q -8 -12 0 -24 q 8 12 0 24 Z" fill="#FFB547" stroke="#C9741A" stroke-width="2" style="transform-origin:0px -38px"/>
  <path d="M -22 -78 L -24 0 M 22 -78 L 24 0" stroke="${L}" stroke-width="3"/>`;
}

function snowman() {
  return `
  <circle cx="0" cy="-30" r="30" fill="#FFFFFF" ${SW}/>
  <circle cx="0" cy="-30" r="3" fill="${L}"/><circle cx="0" cy="-16" r="3" fill="${L}"/>
  <path d="M -26 -54 L -50 -72 M -44 -68 L -50 -62 M 26 -54 L 50 -72 M 44 -68 L 46 -78" stroke="#7A4A2A" stroke-width="4" stroke-linecap="round"/>
  <g class="head">
    <circle cx="0" cy="-80" r="24" fill="#FFFFFF" ${SW}/>
    <g class="eyes"><circle cx="-8" cy="-84" r="3.5" fill="${L}"/><circle cx="8" cy="-84" r="3.5" fill="${L}"/></g>
    <path d="M 0 -78 L 18 -74 L 0 -73 Z" fill="#F49B3A" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="-15" cy="-74" rx="5" ry="3" fill="#FF8FA3" opacity=".6"/><ellipse cx="15" cy="-74" rx="5" ry="3" fill="#FF8FA3" opacity=".6"/>
    <g class="hat"><rect x="-22" y="-104" width="44" height="8" rx="3" fill="${L}"/><rect x="-14" y="-128" width="28" height="26" rx="4" fill="${L}"/><rect x="-14" y="-110" width="28" height="5" fill="#D94B4B"/></g>
  </g>
  <path d="M -22 -60 Q 0 -50 22 -60 L 20 -52 Q 0 -44 -20 -52 Z" fill="#78B1E0" ${SW}/>
  <path class="scarf-tail" d="M 12 -54 L 18 -32 L 26 -34 L 20 -56" fill="#78B1E0" ${SW}/>`;
}

const HEAVY = new Set(['fireplace', 'fireplace-stone', 'furn-rug', 'furn-bookshelf', 'deco-wreath']);

export function propSVG(kind) {
  let body;
  switch (kind) {
    case 'fireplace': body = fireplace(false); break;
    case 'fireplace-stone': body = fireplace(true); break;
    case 'furn-armchair': body = armchair(); break;
    case 'furn-table': body = table(); break;
    case 'furn-rug': body = rug(); break;
    case 'furn-bookshelf': body = bookshelf(); break;
    case 'deco-wreath': body = wreath(); break;
    case 'deco-candle': body = candle(); break;
    case 'deco-snowman': body = snowman(); break;
    default: body = gift(kind.replace('gift-', '')); break;
  }
  const shadow = kind === 'deco-wreath' || kind === 'furn-rug' ? '' : `<ellipse cx="0" cy="3" rx="${kind.startsWith('fireplace') ? 104 : 46}" ry="7" fill="#000" opacity=".12"/>`;
  return `<g class="prop prop-${kind}${HEAVY.has(kind) ? ' heavy' : ''}" data-part="prop">${shadow}${body}</g>`;
}

export const PROPS_CSS = `
.prop{transform-box:fill-box;transform-origin:50% 100%}
.fire .flame-a{transform-box:fill-box;transform-origin:50% 100%;animation:fire 1.1s ease-in-out infinite alternate}
.fire .flame-b{transform-box:fill-box;transform-origin:50% 100%;animation:fire .8s ease-in-out infinite alternate-reverse}
.fire .flame-c{transform-box:fill-box;transform-origin:50% 100%;animation:fire .6s ease-in-out infinite alternate}
@keyframes fire{from{transform:scale(1,1) skewX(-3deg)}to{transform:scale(.92,1.12) skewX(3deg)}}
.fire-glow{transform-box:fill-box;transform-origin:center;animation:glow 1.6s ease-in-out infinite}
@keyframes glow{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.45;transform:scale(1.08)}}
.puff{transform-box:fill-box;transform-origin:center;opacity:0;animation:puff 3.6s ease-out infinite;animation-delay:var(--d,0s)}
@keyframes puff{0%{opacity:0;transform:translate(0,10px) scale(.4)}20%{opacity:1}100%{opacity:0;transform:translate(14px,-46px) scale(1.4)}}
.fire-sparks circle{opacity:0}
.stocking{transform-box:view-box;animation:swing 3.6s ease-in-out infinite;animation-delay:var(--d,0s)}
.flame{transform-box:view-box;animation:flame .9s ease-in-out infinite alternate}
.candle-glow{transform-box:fill-box;transform-origin:center;animation:glow 2s ease-in-out infinite}
.bow{transform-box:fill-box;transform-origin:50% 80%;animation:bow 2.8s ease-in-out infinite}
@keyframes bow{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
.swing{transform-box:fill-box;transform-origin:50% 0%;animation:swing 4s ease-in-out infinite}
.scarf-tail{transform-box:fill-box;transform-origin:0% 0%;animation:bow 1.8s ease-in-out infinite}
.sparkles path{opacity:0;transform-box:fill-box;transform-origin:center}
.prop .eyes{transform-box:fill-box;transform-origin:center;animation:blink 5.2s infinite}
.pop .prop:not(.heavy){animation:prop-hop .6s cubic-bezier(.3,1.6,.5,1)}
@keyframes prop-hop{0%{transform:translateY(0) scale(1,1)}25%{transform:scale(1.08,.9)}55%{transform:translateY(-16px) scale(.96,1.05)}100%{transform:translateY(0)}}
.pop .sparkles path{animation:sparkle 1s ease-out;animation-delay:var(--d,0s)}
@keyframes sparkle{0%{opacity:0;transform:scale(.2) translateY(10px)}30%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(.6) translateY(-18px)}}
.pop .gift-lid{transform-box:fill-box;transform-origin:50% 100%;animation:lid .9s ease-in-out}
@keyframes lid{0%,100%{transform:translateY(0) rotate(0)}40%{transform:translateY(-22px) rotate(-12deg)}70%{transform:translateY(-8px) rotate(5deg)}}
.pop .fire .flame-a,.pop .fire .flame-b{animation:fire-burst 1.2s ease-out}
@keyframes fire-burst{0%{transform:scale(1)}30%{transform:scale(1.25,1.6)}100%{transform:scale(1)}}
.pop .fire-sparks circle{animation:fire-spark 1.2s ease-out;animation-delay:var(--d,0s)}
@keyframes fire-spark{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-70px)}}
.pop .puff{animation-duration:1.2s}
.pop .stocking{animation:swing .4s ease-in-out 3}
.pop .swing{animation:swing .5s ease-in-out 3}
.pop .cushion{transform-box:fill-box;transform-origin:50% 100%;animation:squish .6s ease-in-out}
@keyframes squish{40%{transform:scale(1.08,.7)}}
.pop .flame{animation:flame .15s ease-in-out 8 alternate}
.pop .prop-deco-snowman .hat{transform-box:fill-box;transform-origin:0% 100%;animation:hat-tip .9s ease-in-out}
@keyframes hat-tip{40%{transform:translateY(-10px) rotate(-18deg)}}
.pop .prop-furn-rug{animation:rug .6s ease-in-out}
@keyframes rug{30%{transform:scale(1.04,.92)}}
.pop .shelf-plant{transform-box:fill-box;transform-origin:50% 100%;animation:swing .3s ease-in-out 4}
@media (prefers-reduced-motion:reduce){.fire .flame-a,.fire .flame-b,.fire .flame-c,.fire-glow,.puff,.stocking,.flame,.candle-glow,.bow,.swing,.scarf-tail{animation:none}}
`;
