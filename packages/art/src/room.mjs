// Căn phòng phong cách màu nước. Mọi lớp vẽ trong cùng khung 720 x 1080 để chồng thẳng lên nhau.
// Bố cục cố định: lò sưởi lệch trái, cây lệch phải, quà dưới gốc cây, mèo cạnh lò sưởi.
import { DEFS } from './tree.mjs';

export const W = 720, H = 1080, FLOOR = 770;
export const TREE_POS = { cx: 492, baseY: 912, scale: 1.2 };   // gốc cây (khung cây 400x600, gốc ở y=538)

export const f = (n) => Math.round(n * 10) / 10;
export function rng(seed) { let s = seed % 233280; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
export const wrapLayer = (id, inner, lite = 0) => `<defs>${DEFS(id, lite)}</defs><g filter="url(#${id}-paper)">${inner}</g>`;

export const ROOMS = {
  night: { name: 'Đêm ấm' },
  wood:  { name: 'Nhà gỗ' },
  stone: { name: 'Tường đá' },
  home:  { name: 'Nhà xinh' },
  sage:  { name: 'Xanh rêu' },
  rose:  { name: 'Hồng phấn sọc' },
  navy:  { name: 'Xanh đêm sao' },
  whitebrick: { name: 'Gạch trắng' },
  shiplap: { name: 'Ván trắng' },
};
export const FIREPLACES = { brick: { name: 'Gạch đỏ' }, stone: { name: 'Đá cuội' }, plaster: { name: 'Vữa trắng' }, whitebrick: { name: 'Gạch quét vôi' }, marble: { name: 'Cẩm thạch' }, oaktile: { name: 'Gỗ tối gạch men' }, cherry: { name: 'Gỗ anh đào' }, teal: { name: 'Gạch men xanh ngọc' } };
export const RUGS = { plaid: { name: 'Thảm kẻ đỏ' }, knit: { name: 'Thảm len kem' }, none: { name: 'Không thảm' } };
export const GIFTS = { warm: { name: 'Quà đỏ xanh' }, pastel: { name: 'Quà pastel' }, none: { name: 'Không quà' } };

// ---------- cửa sổ (dùng chung, chỉ đổi màu khung) ----------
const WIN = { x: 406, y: 96, w: 232, h: 272 };
function windowSVG(id, frame, frameDark) {
  const { x, y, w, h } = WIN;
  const r = rng(77);
  let stars = '';
  for (let i = 0; i < 16; i++) stars += `<circle cx="${f(x + 10 + r() * (w - 20))}" cy="${f(y + 10 + r() * h * 0.55)}" r="${f(0.8 + r() * 1.6)}" fill="#FFF6D6" opacity="${f(0.5 + r() * 0.5)}"/>`;
  return `<clipPath id="${id}-win"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
  <g clip-path="url(#${id}-win)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1E2C52"/>
    <g filter="url(#${id}-blur)"><ellipse cx="${x + w * 0.3}" cy="${y + 40}" rx="90" ry="60" fill="#33477A" opacity=".8"/><ellipse cx="${x + w * 0.8}" cy="${y + h * 0.5}" rx="80" ry="70" fill="#2A3B6A"/></g>
    ${stars}
    <circle cx="${x + w * 0.74}" cy="${y + 62}" r="22" fill="#FFF3C8" opacity=".95"/><circle cx="${x + w * 0.74}" cy="${y + 62}" r="40" fill="#FFF3C8" opacity=".15"/>
    <path d="M ${x - 10} ${y + h * 0.78} Q ${x + w * 0.35} ${y + h * 0.66} ${x + w * 0.6} ${y + h * 0.76} Q ${x + w * 0.85} ${y + h * 0.84} ${x + w + 10} ${y + h * 0.74} L ${x + w + 10} ${y + h + 10} L ${x - 10} ${y + h + 10} Z" fill="#DCE8F2" filter="url(#${id}-wob)"/>
    <path d="M ${x + 40} ${y + h * 0.74} l 14 -42 l 14 42 Z M ${x + 150} ${y + h * 0.7} l 11 -32 l 11 32 Z" fill="#2F5D63" opacity=".85" filter="url(#${id}-wob)"/>
  </g>
  <g filter="url(#${id}-wob)">
    <rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" fill="none" stroke="${frame}" stroke-width="16"/>
    <path d="M ${x + w / 3} ${y} L ${x + w / 3} ${y + h} M ${x + (2 * w) / 3} ${y} L ${x + (2 * w) / 3} ${y + h} M ${x} ${y + h / 3} L ${x + w} ${y + h / 3} M ${x} ${y + (2 * h) / 3} L ${x + w} ${y + (2 * h) / 3}" stroke="${frame}" stroke-width="8"/>
    <rect x="${x - 14}" y="${y + h + 4}" width="${w + 28}" height="16" rx="4" fill="${frame}"/>
    <rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 34}" fill="none" stroke="${frameDark}" stroke-width="2.5" opacity=".7"/>
  </g>`;
}

// ---------- phông nền ----------
function floorPlanks(id, base, light, dark, seed) {
  const r = rng(seed);
  let s = `<rect x="0" y="${FLOOR}" width="${W}" height="${H - FLOOR}" fill="${base}"/>`;
  let blobs = '';
  for (let i = 0; i < 10; i++) blobs += `<ellipse cx="${f(r() * W)}" cy="${f(FLOOR + 40 + r() * 280)}" rx="${f(60 + r() * 120)}" ry="${f(20 + r() * 40)}" fill="${r() < 0.5 ? light : dark}" opacity=".22"/>`;
  s += `<g filter="url(#${id}-blur)">${blobs}</g>`;
  // ván sàn: các đường hội tụ nhẹ về giữa
  let lines = '';
  for (let i = -6; i <= 12; i++) {
    const xb = i * 72, xt = W / 2 + (xb - W / 2) * 0.62;
    lines += `<path d="M ${f(xt)} ${FLOOR} L ${f(xb)} ${H}" stroke="${dark}" stroke-width="2.4" opacity=".55"/>`;
  }
  for (let j = 0; j < 7; j++) {
    const y = FLOOR + 30 + j * j * 7 + j * 22;
    for (let k = 0; k < 6; k++) {
      const x = (k * 137 + j * 61) % W;
      lines += `<path d="M ${x} ${f(y)} l 40 0" stroke="${dark}" stroke-width="2" opacity=".35"/>`;
    }
  }
  s += `<g filter="url(#${id}-wob)">${lines}</g>`;
  s += `<rect x="0" y="${FLOOR - 16}" width="${W}" height="22" fill="${dark}" opacity=".9" filter="url(#${id}-wob)"/>`;
  return s;
}

function vignette(id, warm = '#FFB66B') {
  // ánh lửa ấm từ lò sưởi bên trái + góc tối
  return `<defs><radialGradient id="${id}-fire" cx="0.24" cy="0.66" r="0.6"><stop offset="0" stop-color="${warm}" stop-opacity=".38"/><stop offset=".6" stop-color="${warm}" stop-opacity=".08"/><stop offset="1" stop-color="${warm}" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}-vig" cx=".5" cy=".55" r=".75"><stop offset=".55" stop-color="#140E18" stop-opacity="0"/><stop offset="1" stop-color="#140E18" stop-opacity=".55"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#${id}-vig)"/>`;
}

function roomNight(id) {
  let stripes = '';
  for (let x = 0; x < W; x += 48) stripes += `<rect x="${x + 18}" y="0" width="12" height="${FLOOR}" fill="#463D50" opacity=".6"/>`;
  return `<defs><linearGradient id="${id}-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E3647"/><stop offset="1" stop-color="#564C60"/></linearGradient></defs>
    <rect width="${W}" height="${FLOOR}" fill="url(#${id}-wall)"/><g filter="url(#${id}-wob)">${stripes}</g>
    ${floorPlanks(id, '#3A3036', '#463B42', '#2A2128', 9)}
    ${vignette(id)}`;
}

function roomWood(id) {
  const r = rng(13);
  let planks = '';
  for (let y = 0; y < FLOOR; y += 44) {
    const tone = ['#C48F5A', '#B98351', '#CC9963', '#B07A48'][(y / 44) % 4];
    planks += `<rect x="0" y="${y}" width="${W}" height="44" fill="${tone}"/>`;
    planks += `<path d="M 0 ${y + 43} L ${W} ${y + 43}" stroke="#7A4E2C" stroke-width="3" opacity=".7"/>`;
    for (let k = 0; k < 3; k++) {
      const x = (r() * W) | 0;
      planks += `<path d="M ${x} ${y + 6} Q ${x + 60} ${y + 18} ${x + 140} ${y + 10}" stroke="#8E5E36" stroke-width="1.6" fill="none" opacity=".5"/>`;
      if (r() < 0.4) planks += `<ellipse cx="${f(x + 70)}" cy="${y + 22}" rx="9" ry="5" fill="none" stroke="#8E5E36" stroke-width="1.6" opacity=".55"/>`;
    }
    const joint = (y * 7) % W;
    planks += `<path d="M ${joint} ${y} L ${joint} ${y + 44}" stroke="#7A4E2C" stroke-width="2.4" opacity=".6"/>`;
  }
  let blobs = '';
  for (let i = 0; i < 8; i++) blobs += `<ellipse cx="${f(r() * W)}" cy="${f(r() * FLOOR)}" rx="${f(90 + r() * 120)}" ry="${f(60 + r() * 100)}" fill="${r() < 0.5 ? '#E2B27A' : '#8E5E36'}" opacity=".18"/>`;
  return `<g filter="url(#${id}-wob)">${planks}</g><g filter="url(#${id}-blur)">${blobs}</g>
    ${floorPlanks(id, '#8A5A36', '#A8744A', '#5E3A20', 21)}
    ${vignette(id)}`;
}

function roomStone(id) {
  const r = rng(29);
  let stones = '';
  for (let row = 0, y = 0; y < FLOOR; row++) {
    const h = 46 + r() * 22;
    let x = row % 2 ? -30 : -10;
    while (x < W) {
      const w = 60 + r() * 60;
      const tone = ['#B7AFA4', '#A79F95', '#C4BDB2', '#9C948A', '#B0A89C'][(r() * 5) | 0];
      stones += `<rect x="${f(x + 4)}" y="${f(y + 4)}" width="${f(w - 8)}" height="${f(h - 8)}" rx="${f(14 + r() * 10)}" fill="${tone}" stroke="#7C746B" stroke-width="2.4"/>`;
      if (r() < 0.5) stones += `<path d="M ${f(x + 14)} ${f(y + 14)} q ${f(w * 0.2)} -4 ${f(w * 0.4)} 2" stroke="#D8D2C8" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
      x += w;
    }
    y += h;
  }
  return `<rect width="${W}" height="${FLOOR}" fill="#8E867C"/><g filter="url(#${id}-wob)">${stones}</g>
    ${floorPlanks(id, '#7D756E', '#958C83', '#5A534D', 33)}
    ${vignette(id, '#FFB070')}`;
}

function roomHome(id) {
  const r = rng(41);
  let sprigs = '';
  for (let y = 30; y < 520; y += 70) for (let x = (y / 70) % 2 ? 20 : 55; x < W; x += 70) {
    sprigs += `<g transform="translate(${x} ${y}) rotate(${f((r() - 0.5) * 40)})"><path d="M 0 10 Q 0 0 0 -10" stroke="#9BB59A" stroke-width="2" fill="none"/><ellipse cx="-5" cy="-2" rx="5" ry="2.6" fill="#A9C7A6"/><ellipse cx="5" cy="-6" rx="5" ry="2.6" fill="#A9C7A6"/><circle cx="0" cy="-12" r="2.6" fill="#E59C9C"/></g>`;
  }
  let panels = '';
  for (let x = 20; x < W; x += 140) panels += `<rect x="${x}" y="590" width="110" height="150" rx="6" fill="none" stroke="#6E8A72" stroke-width="3"/>`;
  return `<rect width="${W}" height="560" fill="#F3E6D3"/><g filter="url(#${id}-soft)"><ellipse cx="200" cy="200" rx="260" ry="160" fill="#FBF2E4" opacity=".7"/></g>
    <g filter="url(#${id}-wob)">${sprigs}</g>
    <rect x="0" y="560" width="${W}" height="${FLOOR - 560}" fill="#8FAA92"/>
    <g filter="url(#${id}-wob)"><rect x="0" y="552" width="${W}" height="16" fill="#EFE3CF" stroke="#6E8A72" stroke-width="2.5"/>${panels}</g>
    ${floorPlanks(id, '#C8955E', '#DDB07A', '#986A3E', 47)}
    ${vignette(id)}`;
}


function wallBase(id, color, seed, light, dark) {
  const r = rng(seed);
  let blobs = '';
  for (let i = 0; i < 8; i++) blobs += `<ellipse cx="${f(r() * W)}" cy="${f(r() * FLOOR)}" rx="${f(90 + r() * 120)}" ry="${f(60 + r() * 100)}" fill="${r() < 0.5 ? light : dark}" opacity=".35"/>`;
  return `<rect width="${W}" height="${FLOOR}" fill="${color}"/><g filter="url(#${id}-blur)">${blobs}</g>`;
}
function herringbone(id, base, light, dark) {
  let s = `<rect x="0" y="${FLOOR}" width="${W}" height="${H - FLOOR}" fill="${base}"/>`;
  let p = '';
  const r = rng(61);
  for (let row = 0, y = FLOOR; y < H + 30; row++, y += 26) for (let x = -40 + (row % 2) * 26; x < W + 40; x += 52) {
    const tone = r() < 0.5 ? base : light;
    p += `<path d="M ${x} ${y} l 26 13 l 0 13 l -26 -13 Z" fill="${tone}" stroke="${dark}" stroke-width="1.5"/><path d="M ${x + 26} ${y + 13} l 26 -13 l 0 13 l -26 13 Z" fill="${tone === base ? light : base}" stroke="${dark}" stroke-width="1.5"/>`;
  }
  s += `<g filter="url(#${id}-wob)" opacity=".95">${p}</g><rect x="0" y="${FLOOR - 16}" width="${W}" height="22" fill="${dark}" filter="url(#${id}-wob)"/>`;
  return s;
}
function roomSage(id) {
  let pat = '';
  for (let y = 30; y < FLOOR; y += 64) for (let x = (y / 64) % 2 ? 0 : 32; x < W + 32; x += 64) pat += `<path d="M ${x} ${y - 14} l 10 14 l -10 14 l -10 -14 Z" fill="#7E9A86"/><circle cx="${x}" cy="${y}" r="2.5" fill="#A9BFA8"/>`;
  return `${wallBase(id, '#6C8875', 71, '#86A08B', '#556E5D')}<g filter="url(#${id}-wob)">${pat}</g>
    ${floorPlanks(id, '#5A3D2A', '#6E4C34', '#3E281A', 73)}${vignette(id)}`;
}
function roomRose(id) {
  let st = '';
  for (let x = 0; x < W; x += 40) st += `<rect x="${x + 10}" y="0" width="20" height="${FLOOR}" fill="#DDB0AB"/><path d="M ${x + 34} 0 L ${x + 34} ${FLOOR}" stroke="#C9A060" stroke-width="1.6" opacity=".7"/>`;
  return `${wallBase(id, '#EBCBC6', 79, '#F5DCD8', '#D4A8A2')}<g filter="url(#${id}-wob)">${st}</g>
    <g filter="url(#${id}-wob)"><rect x="0" y="${FLOOR - 120}" width="${W}" height="${120}" fill="#F3E4DC"/><rect x="0" y="${FLOOR - 128}" width="${W}" height="12" fill="#FFFFFF" stroke="#C9A89E" stroke-width="2"/></g>
    ${floorPlanks(id, '#D6AC7A', '#E6C293', '#A97F50', 83)}${vignette(id)}`;
}
function roomNavy(id) {
  const r = rng(89);
  let st = '';
  for (let i = 0; i < 60; i++) {
    const x = r() * W, y = r() * (FLOOR - 20);
    if (r() < 0.35) st += `<path d="M ${f(x)} ${f(y - 6)} L ${f(x + 1.6)} ${f(y - 1.6)} L ${f(x + 6)} ${f(y)} L ${f(x + 1.6)} ${f(y + 1.6)} L ${f(x)} ${f(y + 6)} L ${f(x - 1.6)} ${f(y + 1.6)} L ${f(x - 6)} ${f(y)} L ${f(x - 1.6)} ${f(y - 1.6)} Z" fill="#E8C66A"/>`;
    else st += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + r() * 1.6)}" fill="#D9BE7A" opacity=".8"/>`;
  }
  return `${wallBase(id, '#26324F', 97, '#34436A', '#1A2340')}<g filter="url(#${id}-wob)">${st}</g>
    ${floorPlanks(id, '#6B4630', '#80583C', '#4A2E1C', 101)}${vignette(id)}`;
}
function roomWhiteBrick(id) {
  return `<g filter="url(#${id}-wob)">${bricks(id, 0, W, 0, FLOOR, ['#F1ECE5', '#E8E2D9', '#F6F2EC', '#E2DBD0'], '#C9C1B5', 30, 64)}</g>
    <g filter="url(#${id}-blur)"><ellipse cx="200" cy="200" rx="260" ry="180" fill="#FFFFFF" opacity=".25"/></g>
    ${floorPlanks(id, '#A8A097', '#BDB5AB', '#857D74', 103)}${vignette(id)}`;
}
function roomShiplap(id) {
  let b = '';
  for (let y = 0; y < FLOOR; y += 38) b += `<rect x="0" y="${y}" width="${W}" height="38" fill="${(y / 38) % 2 ? '#F3EFE7' : '#F7F4EE'}"/><path d="M 0 ${y + 37} L ${W} ${y + 37}" stroke="#CFC6B6" stroke-width="2.4"/>`;
  return `<g filter="url(#${id}-wob)">${b}</g>${herringbone(id, '#C8955E', '#DDB07A', '#9C6A3C')}${vignette(id)}`;
}

export const WINDOWS = { wood: { name: 'Cửa sổ gỗ', frame: '#7A5236', dark: '#4A2E1C' }, white: { name: 'Cửa sổ trắng', frame: '#F4F1EA', dark: '#A39A8C' }, honey: { name: 'Cửa sổ gỗ sáng', frame: '#C99A63', dark: '#7A5236' } };
export const WINDOW_ANCHOR = { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h + 20 };
export function windowSource(kind, id = 'wd') { const w = WINDOWS[kind]; return wrapLayer(id, windowSVG(id, w.frame, w.dark)); }

// từng hộp quà đơn lẻ, đặt tại GIFT_ANCHOR
export const GIFT_ANCHOR = { x: 360, y: 1000 };
export const GIFT_SINGLES = {
  red:   { name: 'Hộp đỏ chấm bi', w: 112, h: 74, c: ['#C94545', '#9E3030', '#F2C14E'], pat: 'dots' },
  green: { name: 'Hộp xanh sọc', w: 84, h: 56, c: ['#3E8A63', '#2A6A4A', '#F6EBDD'], pat: 'stripes' },
  gold:  { name: 'Hộp vàng nhỏ', w: 54, h: 42, c: ['#F2C14E', '#C99A2E', '#C94545'], pat: '' },
  blue:  { name: 'Hộp xanh dương', w: 76, h: 56, c: ['#4E7FB8', '#355E92', '#F6EBDD'], pat: 'stripes' },
  cream: { name: 'Hộp kem', w: 58, h: 48, c: ['#F6EBDD', '#D8CBB5', '#C94545'], pat: 'dots' },
  pink:  { name: 'Hộp hồng cao', w: 62, h: 88, c: ['#F4B6C8', '#D98FA6', '#FFFFFF'], pat: 'dots' },
  mint:  { name: 'Hộp bạc hà', w: 80, h: 60, c: ['#A9D6C8', '#7DB5A6', '#F6A6B8'], pat: 'stripes' },
  lilac: { name: 'Hộp tím nhạt', w: 66, h: 50, c: ['#C7B8F0', '#9F8EDB', '#FFFFFF'], pat: '' },
};
export function giftSingleSource(kind, id = 'gs') {
  const g = GIFT_SINGLES[kind];
  const { x, y } = GIFT_ANCHOR;
  const pattern = g.pat === 'dots' ? dots(x, y, g.w, g.h, g.c[2]) : g.pat === 'stripes' ? stripes(x, y, g.w, g.h, g.c[2]) : '';
  return wrapLayer(id, `<ellipse cx="${x}" cy="${y + 4}" rx="${g.w * 0.62}" ry="10" fill="#140E14" opacity=".3" filter="url(#${id}-soft)"/>
    <g transform="translate(${x} ${y}) scale(1.3) translate(${-x} ${-y})">${box(id, { x, y, w: g.w, h: g.h, rot: 0, color: g.c[0], dark: g.c[1], ribbon: g.c[2], pattern })}</g>`);
}

export function roomSource(kind, id = 'rm') {
  const inner = { night: roomNight, wood: roomWood, stone: roomStone, home: roomHome, sage: roomSage, rose: roomRose, navy: roomNavy, whitebrick: roomWhiteBrick, shiplap: roomShiplap }[kind](id);
  return wrapLayer(id, inner);
}

// ---------- lò sưởi ----------
const FP = { x0: 28, x1: 302, top: 470, base: 842, chimL: 70, chimR: 260 };
export const FIRE_POS = { cx: 165, cy: 790 };

export function bricks(id, x0, x1, y0, y1, tones, mortar, h = 22, w = 46) {
  const r = rng(x0 + y0);
  let s = '';
  for (let row = 0, y = y0; y < y1; row++, y += h) for (let x = x0 + (row % 2 ? -w / 2 : 0); x < x1; x += w) {
    const xa = Math.max(x + 2, x0 + 1), xb = Math.min(x + w - 2, x1 - 1);
    if (xb - xa < 6) continue;
    s += `<rect x="${f(xa)}" y="${f(y + 2)}" width="${f(xb - xa)}" height="${h - 4}" rx="3" fill="${tones[(r() * tones.length) | 0]}"/>`;
  }
  return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${mortar}"/>${s}`;
}
export function cobbles(id, x0, x1, y0, y1, tones, mortar) {
  const r = rng(x1 + y1);
  let s = '';
  for (let y = y0; y < y1; ) {
    const h = 26 + r() * 16;
    for (let x = x0 - 10; x < x1; ) {
      const w = 34 + r() * 30;
      s += `<rect x="${f(x + 3)}" y="${f(y + 3)}" width="${f(w - 6)}" height="${f(h - 6)}" rx="${f(10 + r() * 8)}" fill="${tones[(r() * tones.length) | 0]}"/>`;
      x += w;
    }
    y += h;
  }
  return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${mortar}"/>${s}`;
}

export function stocking(x, y, color, cuff, id) {
  return `<g filter="url(#${id}-wob)"><path d="M ${x - 15} ${y} L ${x + 15} ${y} L ${x + 15} ${y + 46} Q ${x + 16} ${y + 62} ${x} ${y + 64} L ${x - 18} ${y + 64} Q ${x - 34} ${y + 62} ${x - 32} ${y + 50} Q ${x - 30} ${y + 42} ${x - 15} ${y + 42} Z" fill="${color}" stroke="#3A2E2A" stroke-width="2.2" stroke-opacity=".6"/>
    <path d="M ${x - 10} ${y + 22} l 20 0 M ${x - 10} ${y + 32} l 20 0" stroke="#FFFFFF" stroke-width="3" opacity=".6"/>
    <rect x="${x - 19}" y="${y - 6}" width="38" height="15" rx="6" fill="${cuff}" stroke="#3A2E2A" stroke-width="2" stroke-opacity=".5"/></g>`;
}

export function fireplaceSource(kind, id = 'fp') {
  const { x0, x1, top, base, chimL, chimR } = FP;
  let body, chimney, trim = '#7A4E2C', mantelC = '#6B4226';
  if (kind === 'brick') {
    const tones = ['#B85A44', '#A84F3B', '#C66A50', '#9E4836', '#B05A42'];
    chimney = bricks(id, chimL, chimR, 0, top, tones, '#D8B8A0');
    body = bricks(id, x0, x1, top, base, tones, '#D8B8A0');
  } else if (kind === 'stone') {
    const tones = ['#B9B0A4', '#A69C90', '#C8C0B4', '#968C80'];
    chimney = cobbles(id, chimL, chimR, 0, top, tones, '#827870');
    body = cobbles(id, x0, x1, top, base, tones, '#827870');
    mantelC = '#5A3A22';
  } else if (kind === 'whitebrick') {
    const tones = ['#F3EEE7', '#E9E3DA', '#F7F3ED', '#E0D9CE'];
    chimney = bricks(id, chimL, chimR, 0, top, tones, '#C2B9AC');
    body = bricks(id, x0, x1, top, base, tones, '#C2B9AC');
    trim = '#5E5A55'; mantelC = '#8A6A4A';
  } else if (kind === 'marble') {
    const veins = (xa, xb, ya, yb, seed) => { const r = rng(seed); let v = ''; for (let i = 0; i < 9; i++) { const x = xa + r() * (xb - xa), y = ya + r() * (yb - ya); v += `<path d="M ${f(x)} ${f(y)} q ${f(20 + r() * 30)} ${f(10 + r() * 20)} ${f(50 + r() * 40)} ${f(-10 + r() * 30)} t ${f(40 + r() * 30)} ${f(10 + r() * 20)}" stroke="#A9A6A3" stroke-width="${f(1 + r() * 1.6)}" fill="none" opacity=".7"/>`; } return v; };
    chimney = `<rect x="${chimL}" y="0" width="${chimR - chimL}" height="${top}" fill="#F2EFEA"/>${veins(chimL, chimR - 40, 20, top - 40, 5)}`;
    body = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="#F4F1EC"/>${veins(x0, x1 - 60, top + 20, base - 30, 9)}`;
    trim = '#2E2C30'; mantelC = '#EDE9E3';
  } else if (kind === 'oaktile') {
    let tiles = '';
    const r = rng(17);
    for (let y = top + 40; y < base - 6; y += 22) for (let x = x0 + 20; x < x1 - 20; x += 22) tiles += `<rect x="${x + 1}" y="${y + 1}" width="20" height="20" rx="2" fill="${['#4E8A6E', '#5C9A7C', '#447A60'][(r() * 3) | 0]}"/>`;
    let panels = '';
    for (let y = 30; y < top - 20; y += 120) panels += `<rect x="${chimL + 16}" y="${y}" width="${chimR - chimL - 32}" height="100" rx="6" fill="none" stroke="#3E2716" stroke-width="4" opacity=".7"/>`;
    chimney = `<rect x="${chimL}" y="0" width="${chimR - chimL}" height="${top}" fill="#5E3E27"/>${panels}`;
    body = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="#5E3E27"/><rect x="${x0 + 18}" y="${top + 38}" width="${x1 - x0 - 36}" height="${base - top - 44}" fill="#2E3B33"/>${tiles}`;
    trim = '#2A3A31'; mantelC = '#3E2716';
  } else if (kind === 'cherry') {
    chimney = `<rect x="${chimL}" y="0" width="${chimR - chimL}" height="${top}" fill="#E9DCC8"/><rect x="${chimL + 18}" y="60" width="${chimR - chimL - 36}" height="${top - 120}" rx="10" fill="none" stroke="#CDBA9C" stroke-width="5"/>`;
    body = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="#8E3B2E"/>
      <rect x="${x0 + 8}" y="${top + 30}" width="34" height="${base - top - 40}" rx="6" fill="#A44A3A"/><rect x="${x1 - 42}" y="${top + 30}" width="34" height="${base - top - 40}" rx="6" fill="#A44A3A"/>
      <path d="M ${x0 + 25} ${top + 44} L ${x0 + 25} ${base - 20} M ${x1 - 25} ${top + 44} L ${x1 - 25} ${base - 20}" stroke="#6E2A20" stroke-width="3"/>
      <rect x="${x0 + 50}" y="${top + 26}" width="${x1 - x0 - 100}" height="30" rx="6" fill="#A44A3A"/>`;
    trim = '#3A1E18'; mantelC = '#6E2A20';
  } else if (kind === 'teal') {
    let tiles = '';
    const r = rng(23);
    for (let y = top + 20; y < base - 6; y += 26) for (let x = x0 + 4; x < x1 - 4; x += 26) tiles += `<rect x="${x + 1}" y="${y + 1}" width="24" height="24" rx="3" fill="${['#3E9C9A', '#4FAEAA', '#358A88', '#5CB8B2'][(r() * 4) | 0]}"/>`;
    chimney = `<rect x="${chimL}" y="0" width="${chimR - chimL}" height="${top}" fill="#F3EFE7"/>`;
    body = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="#E8F1EF"/>${tiles}`;
    trim = '#F4F1EA'; mantelC = '#F4F1EA';
  } else {
    chimney = `<rect x="${chimL}" y="0" width="${chimR - chimL}" height="${top}" fill="#F1ECE4"/><rect x="${chimL + 18}" y="60" width="${chimR - chimL - 36}" height="${top - 120}" rx="10" fill="none" stroke="#D6CCBE" stroke-width="5"/>`;
    body = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="#F4EFE7"/><rect x="${x0 + 14}" y="${top + 14}" width="${x1 - x0 - 28}" height="${base - top - 28}" rx="6" fill="none" stroke="#D6CCBE" stroke-width="5"/>`;
    trim = '#C9BBA8'; mantelC = '#E7DCCD';
  }
  const cx = (x0 + x1) / 2;
  const opening = `M ${cx - 92} ${base} L ${cx - 92} ${top + 110} Q ${cx - 92} ${top + 62} ${cx - 44} ${top + 62} L ${cx + 44} ${top + 62} Q ${cx + 92} ${top + 62} ${cx + 92} ${top + 110} L ${cx + 92} ${base} Z`;
  const inner = `M ${cx - 76} ${base} L ${cx - 76} ${top + 116} Q ${cx - 76} ${top + 80} ${cx - 40} ${top + 80} L ${cx + 40} ${top + 80} Q ${cx + 76} ${top + 80} ${cx + 76} ${top + 116} L ${cx + 76} ${base} Z`;
  let garland = '';
  const r = rng(3);
  for (let i = 0; i < 26; i++) {
    const t = i / 25, x = x0 - 6 + (x1 - x0 + 12) * t, y = top + 34 + Math.sin(t * Math.PI * 3) * 9;
    garland += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="13" ry="8" fill="${r() < 0.5 ? '#2F7A55' : '#3E9468'}" transform="rotate(${f((r() - 0.5) * 60)} ${f(x)} ${f(y)})"/>`;
    if (i % 4 === 2) garland += `<circle cx="${f(x)}" cy="${f(y + 4)}" r="4.5" fill="#D94B4B"/>`;
  }
  const inner2 = `
    <g filter="url(#${id}-wob)">${chimney}</g>
    <rect x="${chimL}" y="0" width="${chimR - chimL}" height="${top}" fill="#1A1218" opacity=".12"/>
    <g filter="url(#${id}-wob)">${body}</g>
    <path d="${opening}" fill="${trim}" filter="url(#${id}-wob)"/>
    <path d="${inner}" fill="#231A1E"/>
    <g filter="url(#${id}-soft)"><ellipse cx="${cx}" cy="${base - 30}" rx="66" ry="40" fill="#5A2E1E" opacity=".9"/></g>
    <g filter="url(#${id}-wob)">
      <rect x="${cx - 54}" y="${base - 26}" width="108" height="14" rx="7" fill="#7A4E2C" transform="rotate(-5 ${cx} ${base - 20})"/>
      <rect x="${cx - 50}" y="${base - 20}" width="100" height="14" rx="7" fill="#946038" transform="rotate(6 ${cx} ${base - 14})"/>
      <path d="M ${cx - 60} ${base - 6} L ${cx + 60} ${base - 6}" stroke="#2A2024" stroke-width="5"/>
    </g>
    <g filter="url(#${id}-wob)"><rect x="${x0 - 22}" y="${top - 8}" width="${x1 - x0 + 44}" height="30" rx="8" fill="${mantelC}"/><rect x="${x0 - 22}" y="${top + 16}" width="${x1 - x0 + 44}" height="8" fill="#1A1218" opacity=".25"/></g>
    <g filter="url(#${id}-wob)">${garland}</g>
    ${stocking(x0 + 50, top + 26, '#C94545', '#FFF6EA', id)}${stocking(x1 - 50, top + 26, '#3E8A63', '#FFF6EA', id)}
    <g filter="url(#${id}-wob)">
      <rect x="${x0 + 18}" y="${top - 46}" width="16" height="38" rx="4" fill="#FFF3DD"/><rect x="${x0 + 40}" y="${top - 34}" width="14" height="26" rx="4" fill="#FFF3DD"/>
      <rect x="${x1 - 74}" y="${top - 62}" width="44" height="54" rx="6" fill="#F4E7CF" stroke="#B9A07A" stroke-width="3"/><circle cx="${x1 - 52}" cy="${top - 35}" r="12" fill="#9BC7A9"/>
    </g>
    <rect x="${x0 - 10}" y="${base - 4}" width="${x1 - x0 + 20}" height="16" rx="4" fill="${trim}" filter="url(#${id}-wob)"/>`;
  return wrapLayer(id, inner2);
}

// lớp lửa động (SVG nhẹ, không bộ lọc)
export function fireOverlay() {
  const { cx, cy } = FIRE_POS;
  return `<defs>
    <radialGradient id="fglow"><stop offset="0" stop-color="#FFC56B" stop-opacity=".85"/><stop offset=".5" stop-color="#FF8A3A" stop-opacity=".3"/><stop offset="1" stop-color="#FF8A3A" stop-opacity="0"/></radialGradient>
    <linearGradient id="fl1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF6A2A"/><stop offset="1" stop-color="#FFB347" stop-opacity=".9"/></linearGradient>
    <linearGradient id="fl2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFB547"/><stop offset="1" stop-color="#FFE9A0"/></linearGradient>
  </defs>
  <g class="fire2">
    <ellipse class="fire-glow2" cx="${cx}" cy="${cy}" rx="110" ry="80" fill="url(#fglow)"/>
    <path class="fl-a" d="M ${cx - 48} ${cy + 26} Q ${cx - 58} ${cy - 20} ${cx - 26} ${cy - 50} Q ${cx - 24} ${cy - 22} ${cx - 10} ${cy - 18} Q ${cx - 8} ${cy - 62} ${cx + 18} ${cy - 84} Q ${cx + 18} ${cy - 44} ${cx + 36} ${cy - 34} Q ${cx + 58} ${cy - 10} ${cx + 46} ${cy + 26} Z" fill="url(#fl1)"/>
    <path class="fl-b" d="M ${cx - 30} ${cy + 26} Q ${cx - 36} ${cy - 6} ${cx - 12} ${cy - 22} Q ${cx - 6} ${cy - 6} ${cx + 4} ${cy - 6} Q ${cx + 8} ${cy - 34} ${cx + 22} ${cy - 44} Q ${cx + 26} ${cy - 16} ${cx + 32} ${cy - 4} Q ${cx + 38} ${cy + 12} ${cx + 30} ${cy + 26} Z" fill="url(#fl2)"/>
    <path class="fl-c" d="M ${cx - 12} ${cy + 26} Q ${cx - 14} ${cy + 4} ${cx + 2} ${cy - 8} Q ${cx + 14} ${cy + 6} ${cx + 14} ${cy + 26} Z" fill="#FFF6D0"/>
    <g class="sparks2">${[[-20, -60], [8, -90], [26, -70], [-4, -100], [14, -50]].map(([dx, dy], i) => `<circle style="--d:${i * 0.11}s" cx="${cx + dx}" cy="${cy + dy}" r="2.6" fill="#FFD86B"/>`).join('')}</g>
  </g>`;
}

// ---------- thảm dưới gốc cây ----------
export function rugSource(kind, id = 'rg') {
  if (kind === 'none') return '';
  const { cx, baseY } = TREE_POS;
  const rx = 212, ry = 56, y = baseY - 4;
  let inner;
  if (kind === 'plaid') {
    let lines = '';
    for (let i = -10; i <= 10; i++) lines += `<path d="M ${cx + i * 26} ${y - ry} L ${cx + i * 26 + 30} ${y + ry}" stroke="#7E2A2A" stroke-width="5" opacity=".55"/><path d="M ${cx - rx} ${y + i * 12} L ${cx + rx} ${y + i * 12 - 4}" stroke="#E8C9A8" stroke-width="2" opacity=".4"/>`;
    let lace = '';
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; lace += `<circle cx="${f(cx + Math.cos(a) * (rx + 6))}" cy="${f(y + Math.sin(a) * (ry + 4))}" r="7" fill="#EADBC6"/>`; }
    inner = `<ellipse cx="${cx}" cy="${y + 10}" rx="${rx + 20}" ry="${ry + 14}" fill="#140E14" opacity=".25" filter="url(#${id}-soft)"/>
      <g filter="url(#${id}-wob)">${lace}</g>
      <clipPath id="${id}-c"><ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}"/></clipPath>
      <g clip-path="url(#${id}-c)"><rect x="${cx - rx}" y="${y - ry}" width="${2 * rx}" height="${2 * ry}" fill="#A8383A"/><g filter="url(#${id}-wob)">${lines}</g>
      <g filter="url(#${id}-blur)"><ellipse cx="${cx - 60}" cy="${y - 20}" rx="90" ry="20" fill="#C94F4F" opacity=".6"/></g></g>`;
  } else {
    let knit = '';
    for (let ring = 1; ring <= 4; ring++) knit += `<ellipse cx="${cx}" cy="${y}" rx="${rx * ring / 4.4}" ry="${ry * ring / 4.4}" fill="none" stroke="#D9C9AE" stroke-width="5" stroke-dasharray="10 6"/>`;
    inner = `<ellipse cx="${cx}" cy="${y + 10}" rx="${rx + 14}" ry="${ry + 12}" fill="#140E14" opacity=".25" filter="url(#${id}-soft)"/>
      <ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="#F1E6D2" filter="url(#${id}-wob)"/>
      <g filter="url(#${id}-wob)">${knit}</g>`;
  }
  return wrapLayer(id, inner);
}

// ---------- chồng quà ----------
function box(id, { x, y, w, h, rot = 0, color, dark, ribbon, pattern = '' }) {
  const lid = 14;
  return `<g transform="rotate(${rot} ${x} ${y})" filter="url(#${id}-wob)">
    <rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" rx="4" fill="${color}"/>
    <rect x="${x + w * 0.1}" y="${y - h}" width="${w * 0.4}" height="${h}" fill="${dark}" opacity=".45"/>
    ${pattern}
    <rect x="${x - 6}" y="${y - h}" width="12" height="${h}" fill="${ribbon}"/>
    <rect x="${x - w / 2 - 5}" y="${y - h - lid + 2}" width="${w + 10}" height="${lid}" rx="4" fill="${color}"/>
    <rect x="${x - w / 2 - 5}" y="${y - h + 2}" width="${w + 10}" height="5" fill="#1A1218" opacity=".2"/>
    <rect x="${x - 6}" y="${y - h - lid + 2}" width="12" height="${lid}" fill="${ribbon}"/>
    <path d="M ${x} ${y - h - lid + 2} q -26 -22 -30 -2 q 4 12 30 2 q 26 -22 30 -2 q -4 12 -30 2" fill="${ribbon}" stroke="#3A2E2A" stroke-width="1.8" stroke-opacity=".5"/>
    <circle cx="${x}" cy="${y - h - lid + 1}" r="6" fill="${ribbon}" stroke="#3A2E2A" stroke-width="1.6" stroke-opacity=".5"/>
  </g>`;
}
const dots = (x, y, w, h, c) => { let s = ''; for (let i = 0; i < 6; i++) s += `<circle cx="${f(x - w / 2 + 10 + ((i * 23) % (w - 20)))}" cy="${f(y - 10 - ((i * 17) % (h - 20)))}" r="3.4" fill="${c}" opacity=".8"/>`; return s; };
const stripes = (x, y, w, h, c) => { let s = ''; for (let k = 12; k < h; k += 14) s += `<path d="M ${x - w / 2} ${y - k} l ${w} -6" stroke="${c}" stroke-width="4" opacity=".6"/>`; return s; };

export function giftsSource(kind, id = 'gf') {
  if (kind === 'none') return '';
  const P = kind === 'warm'
    ? { a: ['#C94545', '#9E3030', '#F2C14E'], b: ['#3E8A63', '#2A6A4A', '#F6EBDD'], c: ['#F2C14E', '#C99A2E', '#C94545'], d: ['#4E7FB8', '#355E92', '#F6EBDD'], e: ['#F6EBDD', '#D8CBB5', '#C94545'] }
    : { a: ['#F4B6C8', '#D98FA6', '#FFFFFF'], b: ['#A9D6C8', '#7DB5A6', '#F6A6B8'], c: ['#FBE3A6', '#E2C27A', '#9DB8E8'], d: ['#C7B8F0', '#9F8EDB', '#FFFFFF'], e: ['#FFFFFF', '#E6DCCB', '#F4B6C8'] };
  const g = (k, o) => box(id, { ...o, color: P[k][0], dark: P[k][1], ribbon: P[k][2] });
  // cụm phải phía trước gốc cây: chồng 3 hộp lệch nhau + 1 hộp tròn bên cạnh
  const R = { x: 590, y: 1010 };
  const L = { x: 352, y: 978 };
  return wrapLayer(id, `
    <ellipse cx="${R.x}" cy="${R.y + 4}" rx="110" ry="18" fill="#140E14" opacity=".3" filter="url(#${id}-soft)"/>
    <g transform="translate(${R.x} ${R.y}) scale(1.3) translate(${-R.x} ${-R.y})">
    ${g('a', { x: R.x - 14, y: R.y, w: 112, h: 74, rot: 2, pattern: dots(R.x - 14, R.y, 112, 74, P.a[2]) })}
    ${g('b', { x: R.x + 6, y: R.y - 86, w: 78, h: 52, rot: -9, pattern: stripes(R.x - 4, R.y - 88, 82, 56, P.b[2]) })}
    ${g('c', { x: R.x - 86, y: R.y + 8, w: 50, h: 38, rot: -12 })}
    ${g('e', { x: R.x + 70, y: R.y + 6, w: 54, h: 46, rot: 6, pattern: dots(R.x + 70, R.y + 6, 54, 46, P.e[2]) })}
    </g>
  `);
}

// ---------- mèo nằm trên đệm cạnh lò sưởi ----------
export const CAT_POS = { x: 236, y: 958 };
export const CAT_SCALE = 1.25;
function sketchOutline(pts, seed, color = '#3A2E2A', w = 2.6) {
  // nét viền đứt đoạn như vẽ tay: các đoạn ngắn lệch nhẹ theo đường viền
  const r = rng(seed);
  let s = '';
  let i = 0;
  while (i < pts.length - 1) {
    const len = 3 + ((r() * 4) | 0);
    const seg = pts.slice(i, Math.min(pts.length, i + len + 1));
    if (seg.length > 1) {
      const off = (r() - 0.5) * 1.6;
      s += `<polyline points="${seg.map((p) => `${f(p[0] + off)},${f(p[1] + off)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${f(w * (0.75 + r() * 0.5))}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    i += len + (r() < 0.25 ? 1 : 0);
  }
  return s;
}
function blobPts(cx, cy, rx, ry, n, wobble = 0, seed = 1, a0 = 0, a1 = Math.PI * 2) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const k = 1 + (r() - 0.5) * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}
const ptsPath = (pts) => 'M ' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L ') + ' Z';
function furTicks(pts, seed, every = 3, out = 7, color = '#3A2E2A') {
  const r = rng(seed);
  let s = '';
  for (let i = 1; i < pts.length - 1; i += every) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    const nx = y2 - y, ny = -(x2 - x), l = Math.hypot(nx, ny) || 1;
    const o = out * (0.6 + r() * 0.8);
    s += `<path d="M ${f(x)} ${f(y)} q ${f((nx / l) * o * 0.5 + (x2 - x) * 0.3)} ${f((ny / l) * o * 0.5 + (y2 - y) * 0.3)} ${f((nx / l) * o)} ${f((ny / l) * o)}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}

export function catSource(id = 'cat') {
  const { x, y } = CAT_POS;
  const grey = '#9A9AA2', greyL = '#B9B9C0', greyD = '#77767F', white = '#FAF7F2';
  // đệm
  const cushion = `<ellipse cx="${x}" cy="${y + 6}" rx="118" ry="30" fill="#140E14" opacity=".28" filter="url(#${id}-soft)"/>
    <g filter="url(#${id}-wob)"><ellipse cx="${x}" cy="${y - 6}" rx="112" ry="30" fill="#C7A27A"/><ellipse cx="${x}" cy="${y - 14}" rx="100" ry="22" fill="#D9B98E"/>
    <path d="M ${x - 96} ${y - 10} Q ${x} ${y + 8} ${x + 96} ${y - 10}" stroke="#A8845C" stroke-width="3" fill="none"/></g>`;
  // thân mèo nằm (dáng "ổ bánh mì")
  const bodyPts = blobPts(x + 14, y - 52, 92, 46, 70, 0.05, 3);
  const headPts = blobPts(x - 44, y - 104, 50, 44, 60, 0.06, 5);
  const earL = [[x - 86, y - 122], [x - 82, y - 168], [x - 52, y - 142]];
  const earR = [[x - 30, y - 144], [x + 2, y - 166], [x + 4, y - 124]];
  const chestPts = blobPts(x - 40, y - 54, 40, 34, 40, 0.12, 9);
  const muzzlePts = blobPts(x - 44, y - 86, 24, 18, 30, 0.08, 11);
  const pawL = blobPts(x - 66, y - 12, 20, 12, 24, 0.08, 13), pawR = blobPts(x - 22, y - 10, 20, 12, 24, 0.08, 15);
  const fill = (pts, c, extra = '') => `<path d="${ptsPath(pts)}" fill="${c}" ${extra}/>`;
  const clipBody = `<clipPath id="${id}-b"><path d="${ptsPath(bodyPts)}"/></clipPath><clipPath id="${id}-h"><path d="${ptsPath(headPts)}"/></clipPath>`;
  // vằn và mảng màu loang
  let stripesBody = '';
  for (let i = 0; i < 6; i++) stripesBody += `<path d="M ${x + 20 + i * 14} ${y - 98} q -6 22 -2 40" stroke="${greyD}" stroke-width="8" stroke-linecap="round" fill="none" opacity=".55"/>`;
  let stripesHead = '';
  for (let i = -1; i <= 1; i++) stripesHead += `<path d="M ${x - 44 + i * 11} ${y - 146} q ${i * 2} 12 ${i * 3} 22" stroke="${greyD}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".6"/>`;
  const inner = `
    ${cushion}
    <defs>${clipBody}</defs>
    ${fill(bodyPts, grey)}
    <g clip-path="url(#${id}-b)"><g filter="url(#${id}-soft)"><ellipse cx="${x + 30}" cy="${y - 80}" rx="60" ry="20" fill="${greyL}"/><ellipse cx="${x + 40}" cy="${y - 24}" rx="70" ry="20" fill="${greyD}" opacity=".5"/></g><g filter="url(#${id}-wob)">${stripesBody}</g></g>
    ${fill(chestPts, white)}
    <g filter="url(#${id}-wob)">${fill(earL, grey)}${fill(earR, grey)}<path d="M ${x - 80} ${y - 128} L ${x - 78} ${y - 156} L ${x - 60} ${y - 140} Z M ${x - 24} ${y - 142} L ${x - 2} ${y - 156} L ${x - 2} ${y - 130} Z" fill="#F2B8C0"/></g>
    ${fill(headPts, grey)}
    <g clip-path="url(#${id}-h)"><g filter="url(#${id}-soft)"><ellipse cx="${x - 60}" cy="${y - 130}" rx="30" ry="14" fill="${greyL}"/></g>
      <path d="M ${x - 44} ${y - 150} Q ${x - 62} ${y - 104} ${x - 70} ${y - 70} L ${x - 18} ${y - 70} Q ${x - 26} ${y - 104} ${x - 44} ${y - 150} Z" fill="${white}" filter="url(#${id}-wob)"/>
      <g filter="url(#${id}-wob)">${stripesHead}</g></g>
    ${fill(muzzlePts, white)}
    ${fill(pawL, white)}${fill(pawR, white)}
    <g filter="url(#${id}-wob)">
      ${sketchOutline(bodyPts.slice(5, 66), 21)}
      ${sketchOutline(headPts, 23)}
      ${sketchOutline([...earL, earL[0]], 25)}${sketchOutline([...earR, earR[0]], 27)}
      ${sketchOutline(pawL.slice(28 * 0 + 2, 22), 29)}${sketchOutline(pawR.slice(2, 22), 31)}
      ${furTicks(chestPts.slice(2, 22), 33, 2, 6)}
      ${furTicks(headPts.slice(10, 26), 35, 3, 6)}${furTicks(headPts.slice(36, 52), 37, 3, 6)}
      ${furTicks(bodyPts.slice(46, 66), 39, 3, 7)}
      <path d="M ${x - 50} ${y - 82} q 6 6 6 0 q 0 6 6 0" stroke="#3A2E2A" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M ${x - 47} ${y - 90} l 6 0 l -3 4 Z" fill="#E89AA6" stroke="#3A2E2A" stroke-width="1.2"/>
      <path d="M ${x - 72} ${y - 88} l -24 -4 M ${x - 72} ${y - 82} l -22 4 M ${x - 16} ${y - 88} l 24 -4 M ${x - 16} ${y - 82} l 22 4" stroke="#3A2E2A" stroke-width="1.3" opacity=".7"/>
      <ellipse cx="${x - 74}" cy="${y - 92}" rx="9" ry="5" fill="#F2A6B0" opacity=".45"/><ellipse cx="${x - 14}" cy="${y - 92}" rx="9" ry="5" fill="#F2A6B0" opacity=".45"/>
    </g>`;
  return wrapLayer(id, `<g transform="translate(${x} ${y}) scale(${CAT_SCALE}) translate(${-x} ${-y})">${inner}</g>`);
}

// đuôi mèo (lớp riêng để vẫy)
export function catTailSource(id = 'ct') {
  const { x, y } = CAT_POS;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push([x + 100 - 10 * t + Math.sin(t * Math.PI) * -6, y - 30 + t * 20]);
  }
  const d = `M ${x + 98} ${y - 46} C ${x + 140} ${y - 40} ${x + 150} ${y - 6} ${x + 110} ${y - 4} C ${x + 70} ${y - 2} ${x + 40} ${y - 4} ${x + 20} ${y - 12}`;
  return wrapLayer(id, `<g transform="translate(${x} ${y}) scale(${CAT_SCALE}) translate(${-x} ${-y})">
    <g filter="url(#${id}-wob)">
      <path d="${d}" stroke="#3A2E2A" stroke-width="26" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="#9A9AA2" stroke-width="21" fill="none" stroke-linecap="round"/>
      <path d="${d}" stroke="#77767F" stroke-width="21" fill="none" stroke-linecap="butt" stroke-dasharray="7 13" opacity=".7"/>
      <path d="M ${x + 26} ${y - 12} l -8 -2" stroke="#FAF7F2" stroke-width="14" stroke-linecap="round"/>
    </g></g>`);
}

// mắt mèo (lớp động nhẹ để chớp mắt)
export function catEyesOverlay() {
  const { x, y } = CAT_POS;
  const eye = (cx) => `<g class="cat-eye" style="transform-origin:${f(x + (cx - x) * CAT_SCALE)}px ${f(y - 100 * CAT_SCALE)}px">
    <ellipse cx="${cx}" cy="${y - 100}" rx="9.5" ry="10.5" fill="#E9B44C" stroke="#3A2E2A" stroke-width="2"/>
    <ellipse cx="${cx + 0.5}" cy="${y - 99}" rx="5.5" ry="7.5" fill="#1E1A22"/>
    <circle cx="${cx + 3}" cy="${y - 104}" r="2.6" fill="#FFFFFF"/><circle cx="${cx - 2.5}" cy="${y - 96}" r="1.2" fill="#FFFFFF" opacity=".8"/>
  </g>`;
  return `<g transform="translate(${x} ${y}) scale(${CAT_SCALE}) translate(${-x} ${-y})">${eye(x - 62)}${eye(x - 26)}</g>`;
}

export const ROOM_CSS = `
.fire2 .fl-a,.fire2 .fl-b,.fire2 .fl-c{transform-box:fill-box;transform-origin:50% 100%}
.fire2 .fl-a{animation:fl 1.1s ease-in-out infinite alternate}
.fire2 .fl-b{animation:fl .8s ease-in-out infinite alternate-reverse}
.fire2 .fl-c{animation:fl .6s ease-in-out infinite alternate}
@keyframes fl{from{transform:scale(1,1) skewX(-4deg)}to{transform:scale(.9,1.14) skewX(4deg)}}
.fire-glow2{transform-box:fill-box;transform-origin:center;animation:fglow 1.8s ease-in-out infinite}
@keyframes fglow{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.07)}}
.sparks2 circle{opacity:0}
.fx-fire .fl-a,.fx-fire .fl-b{animation:fburst 1.1s ease-out}
@keyframes fburst{30%{transform:scale(1.25,1.6)}}
.fx-fire .sparks2 circle{animation:spark2 1.2s ease-out;animation-delay:var(--d,0s)}
@keyframes spark2{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-80px)}}
.cat-breath{transform-origin:236px 958px;animation:catb 3.4s ease-in-out infinite}
@keyframes catb{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,.985)}}
.cat-tail{transform-origin:261px 936px;animation:catt 2.6s ease-in-out infinite}
@keyframes catt{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}
.cat-eye{transform-box:view-box;animation:blink2 5s infinite}
@keyframes blink2{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
.fx-cat .cat-breath{animation:cathop .6s cubic-bezier(.3,1.6,.5,1)}
@keyframes cathop{40%{transform:translateY(-14px) scale(1.02,.98)}}
.fx-cat .cat-tail{animation:catt .2s ease-in-out 6}
.gift-bounce{transform-origin:600px 1000px}
.fx-gifts .gift-bounce{animation:gb .7s cubic-bezier(.3,1.6,.5,1)}
@keyframes gb{30%{transform:scale(1.04,.94)}60%{transform:translateY(-10px)}}
.win-snow circle{animation:wsnow linear infinite}
@keyframes wsnow{from{transform:translate(0,-300px)}to{transform:translate(12px,0)}}
@media (prefers-reduced-motion:reduce){.fire2 *,.cat-breath,.cat-tail,.cat-eye,.win-snow circle{animation:none}}
`;

// tuyết rơi ngoài cửa sổ
export function windowSnowOverlay() {
  const r = rng(99);
  let s = '';
  for (let i = 0; i < 26; i++) s += `<circle cx="${f(WIN.x + r() * WIN.w)}" cy="${f(WIN.y + r() * WIN.h)}" r="${f(1.4 + r() * 2.2)}" fill="#FFFFFF" opacity=".9" style="animation-duration:${f(6 + r() * 6)}s;animation-delay:${f(-r() * 12)}s"/>`;
  return `<clipPath id="wsc"><rect x="${WIN.x}" y="${WIN.y}" width="${WIN.w}" height="${WIN.h}"/></clipPath><g class="win-snow" clip-path="url(#wsc)">${s}</g>`;
}
