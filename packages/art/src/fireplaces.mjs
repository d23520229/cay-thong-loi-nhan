// Bộ lò sưởi không ống khói, mỗi kiểu một dáng riêng. Vẽ trong toạ độ căn phòng, neo chân ở (165, 850).
import { f, rng, wrapLayer, bricks, cobbles, stocking, fireOverlay, FIRE_POS } from './room.mjs';

const CX = 200, BASE = 842, DX = 35;
const L = '#3A2E2A';

export const FIREPLACES2 = {
  classic:   { name: 'Cổ điển vòm gạch' },
  stove:     { name: 'Lò gang bụng tròn' },
  rustic:    { name: 'Lò đá dầm gỗ' },
  victorian: { name: 'Lò Victoria cột trắng' },
  modern:    { name: 'Lò hiện đại dài' },
  dome:      { name: 'Lò vòm bánh mì' },
  cabinet:   { name: 'Lò tủ sách gỗ' },
  tiled:     { name: 'Lò sứ Bắc Âu' },
};

// vị trí ngọn lửa cho từng kiểu: [cx, cy, tỉ lệ]
export const FIRE2 = {
  classic: [[CX, 800, 0.95]],
  stove: [[CX, 738, 0.5]],
  rustic: [[CX, 808, 1.15]],
  victorian: [[CX, 806, 0.78]],
  modern: [[CX - 70, 794, 0.55], [CX, 790, 0.6], [CX + 70, 794, 0.55]],
  dome: [[CX, 808, 0.8]],
  cabinet: [[CX, 806, 0.82]],
  tiled: [[CX, 752, 0.42]],
};

export function fire2Overlay(kind) {
  return FIRE2[kind].map(([x, y, k]) => `<g transform="translate(${x} ${y}) scale(${k}) translate(${-FIRE_POS.cx} ${-FIRE_POS.cy})">${fireOverlay()}</g>`).join('');
}

// ---- chi tiết dùng chung ----
const garland = (id, x0, x1, y, amp = 8, seed = 3) => {
  const r = rng(seed);
  let g = '';
  const n = Math.max(10, Math.round((x1 - x0) / 11));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, yy = y + Math.sin(t * Math.PI * 3) * amp;
    g += `<ellipse cx="${f(x)}" cy="${f(yy)}" rx="12" ry="7.5" fill="${r() < 0.5 ? '#2F7A55' : '#3E9468'}" transform="rotate(${f((r() - 0.5) * 60)} ${f(x)} ${f(yy)})"/>`;
    if (i % 4 === 2) g += `<circle cx="${f(x)}" cy="${f(yy + 4)}" r="4.2" fill="#D94B4B"/>`;
  }
  return `<g filter="url(#${id}-wob)">${g}</g>`;
};
const firebox = (id, d, depth = '#231A1E') => `<path d="${d}" fill="${depth}"/>
  <g filter="url(#${id}-soft)"><ellipse cx="${CX}" cy="${BASE - 34}" rx="70" ry="38" fill="#5A2E1E" opacity=".85"/></g>`;
const logs = (id, cx = CX, y = BASE - 14, w = 100) => `<g filter="url(#${id}-wob)">
  <rect x="${cx - w / 2}" y="${y - 12}" width="${w}" height="14" rx="7" fill="#7A4E2C" transform="rotate(-5 ${cx} ${y - 6})"/>
  <rect x="${cx - w / 2 + 4}" y="${y - 6}" width="${w - 8}" height="14" rx="7" fill="#946038" transform="rotate(6 ${cx} ${y})"/>
  <circle cx="${cx - w / 2 + 6}" cy="${y - 4}" r="5" fill="#C9A27A"/></g>`;
const shadow = (id, rx = 150) => `<ellipse cx="${CX}" cy="${BASE + 6}" rx="${rx}" ry="16" fill="#140E14" opacity=".3" filter="url(#${id}-soft)"/>`;
const candles = (id, x, y) => `<g filter="url(#${id}-wob)"><rect x="${x}" y="${y - 40}" width="15" height="40" rx="4" fill="#FFF3DD"/><rect x="${x + 20}" y="${y - 28}" width="13" height="28" rx="4" fill="#FFF3DD"/><path d="M ${x + 7} ${y - 42} q -4 -7 0 -12 q 4 5 0 12 Z" fill="#FFC56B"/><path d="M ${x + 26} ${y - 30} q -4 -7 0 -12 q 4 5 0 12 Z" fill="#FFC56B"/></g>`;
const frame = (id, x, y, w = 42, h = 52, art = '#9BC7A9') => `<g filter="url(#${id}-wob)"><rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="5" fill="#F4E7CF" stroke="#B9A07A" stroke-width="3"/><circle cx="${x + w / 2}" cy="${y - h / 2}" r="${w * 0.28}" fill="${art}"/></g>`;
const arch = (x0, x1, top, bottom, r) => `M ${x0} ${bottom} L ${x0} ${top + r} Q ${x0} ${top} ${x0 + r} ${top} L ${x1 - r} ${top} Q ${x1} ${top} ${x1} ${top + r} L ${x1} ${bottom} Z`;
const round = (x0, x1, top, bottom) => { const w = x1 - x0; return `M ${x0} ${bottom} L ${x0} ${top + w / 2} A ${w / 2} ${w / 2} 0 0 1 ${x1} ${top + w / 2} L ${x1} ${bottom} Z`; };

// ---- từng kiểu ----
function classic(id) {
  const x0 = 70, x1 = 330, top = 528;
  const tones = ['#B85A44', '#A84F3B', '#C66A50', '#9E4836', '#B05A42'];
  return `${shadow(id)}
  <g filter="url(#${id}-wob)">${bricks(id, x0, x1, top, BASE, tones, '#D8B8A0')}</g>
  <path d="${round(CX - 92, CX + 92, top + 64, BASE)}" fill="#7A4E2C" filter="url(#${id}-wob)"/>
  ${firebox(id, round(CX - 78, CX + 78, top + 80, BASE))}${logs(id)}
  <g filter="url(#${id}-wob)"><rect x="${x0 - 20}" y="${top - 18}" width="${x1 - x0 + 40}" height="30" rx="8" fill="#6B4226"/><rect x="${x0 - 8}" y="${BASE - 4}" width="${x1 - x0 + 16}" height="14" rx="4" fill="#7A4E2C"/></g>
  ${garland(id, x0 - 14, x1 + 14, top + 22)}
  ${stocking(x0 + 44, top + 18, '#C94545', '#FFF6EA', id)}${stocking(x1 - 44, top + 18, '#3E8A63', '#FFF6EA', id)}
  ${candles(id, x0 + 8, top - 18)}${frame(id, x1 - 70, top - 18)}`;
}

function stove(id) {
  const cy = 700;
  return `${shadow(id, 120)}
  <g filter="url(#${id}-wob)">
    <ellipse cx="${CX}" cy="${BASE - 2}" rx="112" ry="18" fill="#8C847C"/>
    <path d="M ${CX - 60} ${BASE - 40} l -14 36 M ${CX + 60} ${BASE - 40} l 14 36" stroke="#2A2628" stroke-width="12" stroke-linecap="round"/>
    <ellipse cx="${CX}" cy="${cy + 20}" rx="88" ry="112" fill="#34303A"/>
    <rect x="${CX - 62}" y="${cy - 116}" width="124" height="30" rx="10" fill="#2A2628"/>
    <rect x="${CX - 76}" y="${cy - 96}" width="152" height="16" rx="6" fill="#4A4552"/>
    <rect x="${CX - 70}" y="${BASE - 60}" width="140" height="22" rx="8" fill="#2A2628"/>
    <path d="M ${CX - 84} ${cy - 20} Q ${CX} ${cy - 6} ${CX + 84} ${cy - 20}" stroke="#4A4552" stroke-width="6" fill="none"/>
  </g>
  <g filter="url(#${id}-soft)"><ellipse cx="${CX - 40}" cy="${cy - 30}" rx="18" ry="50" fill="#6A6474" opacity=".7"/></g>
  <circle cx="${CX}" cy="${cy + 40}" r="48" fill="#1A1418"/>
  <g filter="url(#${id}-soft)"><circle cx="${CX}" cy="${cy + 48}" r="34" fill="#7A3A1E" opacity=".9"/></g>
  <circle cx="${CX}" cy="${cy + 40}" r="50" fill="none" stroke="#B9935A" stroke-width="7" filter="url(#${id}-wob)"/>
  <path d="M ${CX - 50} ${cy + 40} L ${CX + 50} ${cy + 40} M ${CX} ${cy - 10} L ${CX} ${cy + 90}" stroke="#B9935A" stroke-width="4" opacity=".8"/>
  <g filter="url(#${id}-wob)">
    <path d="M ${CX - 30} ${cy - 132} q 30 -36 60 0 Z" fill="#C94545"/>
    <ellipse cx="${CX}" cy="${cy - 132}" rx="36" ry="9" fill="#A83838"/>
    <path d="M ${CX + 30} ${cy - 150} q 18 -4 22 10" stroke="#A83838" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${cy - 162}" r="6" fill="#2A2628"/>
  </g>
  ${garland(id, CX - 82, CX + 82, cy - 86, 5, 7)}`;
}

function rustic(id) {
  const x0 = 35, x1 = 365, top = 610;
  const tones = ['#B9B0A4', '#A69C90', '#C8C0B4', '#968C80', '#ADA396'];
  return `${shadow(id, 180)}
  <g filter="url(#${id}-wob)">${cobbles(id, x0, x1, top, BASE, tones, '#7C7268')}</g>
  <path d="${arch(CX - 104, CX + 104, top + 52, BASE, 26)}" fill="#5A524A" filter="url(#${id}-wob)"/>
  ${firebox(id, arch(CX - 92, CX + 92, top + 64, BASE, 20))}${logs(id, CX, BASE - 12, 130)}${logs(id, CX + 6, BASE - 26, 90)}
  <g filter="url(#${id}-wob)">
    <path d="M ${x0 - 18} ${top - 36} L ${x1 + 18} ${top - 40} L ${x1 + 22} ${top - 2} L ${x0 - 22} ${top + 2} Z" fill="#7A4E2C"/>
    <path d="M ${x0} ${top - 26} Q ${CX} ${top - 32} ${x1} ${top - 26} M ${x0 + 20} ${top - 12} Q ${CX} ${top - 18} ${x1 - 20} ${top - 14}" stroke="#5A3820" stroke-width="2.4" fill="none"/>
    <ellipse cx="${x0 - 16}" cy="${top - 17}" rx="8" ry="18" fill="#C9A27A"/><ellipse cx="${x1 + 18}" cy="${top - 20}" rx="8" ry="18" fill="#C9A27A"/>
    <rect x="${x0 - 10}" y="${BASE - 10}" width="${x1 - x0 + 20}" height="18" rx="5" fill="#8C847C"/>
  </g>
  <g filter="url(#${id}-wob)">
    <rect x="${x0 + 24}" y="${top - 98}" width="40" height="58" rx="6" fill="#2E3B5C"/><rect x="${x0 + 30}" y="${top - 90}" width="28" height="42" rx="4" fill="#FFE2A0"/><path d="M ${x0 + 34} ${top - 98} q 10 -14 20 0" stroke="#2E3B5C" stroke-width="4" fill="none"/>
    ${[0, 1, 2].map((i) => `<ellipse cx="${x1 - 80 + i * 22}" cy="${top - 50}" rx="10" ry="14" fill="#8A5A36"/><path d="M ${x1 - 88 + i * 22} ${top - 54} l 16 0 M ${x1 - 88 + i * 22} ${top - 46} l 16 0" stroke="#5A3820" stroke-width="2"/>`).join('')}
  </g>
  ${garland(id, x0 + 70, x1 - 100, top - 26, 4, 11)}`;
}

function victorian(id) {
  const x0 = 73, x1 = 327, top = 520;
  let tiles = '';
  const r = rng(31);
  for (let y = top + 60; y < BASE - 10; y += 22) for (const x of [CX - 112, CX + 90]) tiles += `<rect x="${x}" y="${y}" width="22" height="20" rx="2" fill="${['#5C8FB0', '#7AA8C4', '#4E7E9E'][(r() * 3) | 0]}"/><circle cx="${x + 11}" cy="${y + 10}" r="4" fill="#E8F0F4" opacity=".8"/>`;
  return `${shadow(id)}
  <g filter="url(#${id}-wob)">
    <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${BASE - top}" fill="#F3EEE6"/>
    <rect x="${x0 + 4}" y="${top + 26}" width="32" height="${BASE - top - 26}" fill="#E6DED2"/><rect x="${x1 - 36}" y="${top + 26}" width="32" height="${BASE - top - 26}" fill="#E6DED2"/>
    <rect x="${x0}" y="${top + 26}" width="40" height="14" fill="#FFFFFF"/><rect x="${x1 - 40}" y="${top + 26}" width="40" height="14" fill="#FFFFFF"/>
    <path d="M ${x0 + 6} ${top + 26} q 14 -26 34 0 M ${x1 - 40} ${top + 26} q 14 -26 34 0" fill="#E6DED2"/>
  </g>
  <g filter="url(#${id}-wob)">${tiles}</g>
  <path d="${round(CX - 78, CX + 78, top + 56, BASE)}" fill="#26232A" filter="url(#${id}-wob)"/>
  <path d="M ${CX - 60} ${top + 120} Q ${CX} ${top + 70} ${CX + 60} ${top + 120}" stroke="#4A4552" stroke-width="5" fill="none"/>
  ${firebox(id, round(CX - 62, CX + 62, top + 78, BASE - 8), '#17121A')}${logs(id, CX, BASE - 20, 80)}
  <path d="M ${CX - 64} ${BASE - 16} L ${CX + 64} ${BASE - 16} M ${CX - 54} ${BASE - 16} l 0 -26 M ${CX - 30} ${BASE - 16} l 0 -26 M ${CX - 6} ${BASE - 16} l 0 -26 M ${CX + 18} ${BASE - 16} l 0 -26 M ${CX + 42} ${BASE - 16} l 0 -26" stroke="#4A4552" stroke-width="4"/>
  <g filter="url(#${id}-wob)"><rect x="${x0 - 18}" y="${top - 16}" width="${x1 - x0 + 36}" height="22" rx="6" fill="#FFFFFF"/><rect x="${x0 - 10}" y="${top + 4}" width="${x1 - x0 + 20}" height="10" fill="#E6DED2"/><rect x="${x0 - 6}" y="${BASE - 4}" width="${x1 - x0 + 12}" height="14" rx="4" fill="#8C847C"/></g>
  <g filter="url(#${id}-wob)"><circle cx="${CX}" cy="${top - 46}" r="26" fill="#F2C14E"/><circle cx="${CX}" cy="${top - 46}" r="19" fill="#FFF8E8"/><path d="M ${CX} ${top - 46} l 0 -12 M ${CX} ${top - 46} l 9 4" stroke="${L}" stroke-width="2.4" stroke-linecap="round"/><rect x="${CX - 22}" y="${top - 24}" width="44" height="8" rx="3" fill="#C99A2E"/></g>
  <g filter="url(#${id}-wob)"><rect x="${x0 + 6}" y="${top - 56}" width="8" height="40" fill="#C99A2E"/><rect x="${x1 - 14}" y="${top - 56}" width="8" height="40" fill="#C99A2E"/><rect x="${x0 + 4}" y="${top - 74}" width="12" height="20" rx="3" fill="#FFF3DD"/><rect x="${x1 - 16}" y="${top - 74}" width="12" height="20" rx="3" fill="#FFF3DD"/></g>
  ${garland(id, x0 - 10, x1 + 10, top + 14, 6, 13)}`;
}

function modern(id) {
  const x0 = 41, x1 = 359, top = 680;
  return `${shadow(id, 175)}
  <g filter="url(#${id}-wob)">
    <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${BASE - top}" rx="6" fill="#E9E6E1"/>
    <rect x="${x0}" y="${top}" width="${x1 - x0}" height="16" fill="#D6D1CA"/>
    <rect x="${x0 + 30}" y="${top + 44}" width="${x1 - x0 - 60}" height="${BASE - top - 74}" rx="8" fill="#3A3640"/>
  </g>
  <path d="M ${x0 + 40} ${BASE - 38} L ${x0 + 40} ${top + 54} L ${x1 - 40} ${top + 54} L ${x1 - 40} ${BASE - 38} Z" fill="#1E1A22"/>
  <g filter="url(#${id}-wob)"><rect x="${x0 + 50}" y="${BASE - 52}" width="${x1 - x0 - 100}" height="12" rx="6" fill="#8C847C"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${x0 + 70 + i * 40}" cy="${BASE - 52}" rx="11" ry="7" fill="#C9C1B5"/>`).join('')}</g>
  <g filter="url(#${id}-wob)">
    <rect x="${x0 + 20}" y="${top - 90}" width="${x1 - x0 - 40}" height="14" rx="4" fill="#B48A5E"/>
    <path d="M ${x0 + 60} ${top - 90} q -8 -40 6 -58 q 14 18 6 58 Z" fill="#E6DED2"/><path d="M ${x0 + 66} ${top - 150} q -16 -30 -4 -40 M ${x0 + 66} ${top - 150} q 10 -34 22 -34" stroke="#5A7A5E" stroke-width="3" fill="none"/>
    <rect x="${x1 - 120}" y="${top - 150}" width="58" height="60" rx="4" fill="#FFFFFF" stroke="#2E2C30" stroke-width="3"/><circle cx="${x1 - 91}" cy="${top - 120}" r="14" fill="#D94B4B" opacity=".8"/>
    <circle cx="${x1 - 40}" cy="${top - 104}" r="14" fill="#F2C14E"/><circle cx="${x1 - 40}" cy="${top - 104}" r="14" fill="none" stroke="#C99A2E" stroke-width="2"/>
  </g>
  ${garland(id, x0 + 20, x1 - 20, top - 70, 10, 17)}`;
}

function dome(id) {
  const x0 = 85, x1 = 315, top = 560;
  const tones = ['#C97A5A', '#B86A4C', '#D48A6A', '#AA5E44'];
  let br = '';
  const r = rng(41);
  for (let ring = 0; ring < 9; ring++) {
    const y = BASE - 10 - ring * 30, half = Math.sqrt(Math.max(0, 1 - ((BASE - y - 40) / (BASE - top)) ** 2)) * (x1 - x0) / 2;
    for (let x = CX - half + (ring % 2) * 14; x < CX + half - 10; x += 34) br += `<rect x="${f(x)}" y="${f(y - 26)}" width="30" height="24" rx="6" fill="${tones[(r() * 4) | 0]}"/>`;
  }
  const domePath = `M ${x0} ${BASE} L ${x0} ${top + 120} Q ${x0} ${top} ${CX} ${top} Q ${x1} ${top} ${x1} ${top + 120} L ${x1} ${BASE} Z`;
  return `${shadow(id, 140)}
  <clipPath id="${id}-dm"><path d="${domePath}"/></clipPath>
  <path d="${domePath}" fill="#E8C9B0"/>
  <g clip-path="url(#${id}-dm)" filter="url(#${id}-wob)">${br}</g>
  <path d="${domePath}" fill="none" stroke="#8E4E36" stroke-width="4" opacity=".6" filter="url(#${id}-wob)"/>
  <path d="${round(CX - 70, CX + 70, top + 100, BASE)}" fill="#8E4E36" filter="url(#${id}-wob)"/>
  ${firebox(id, round(CX - 58, CX + 58, top + 112, BASE))}${logs(id, CX, BASE - 14, 86)}
  <g filter="url(#${id}-wob)">
    ${[0, 1, 2, 3].map((i) => `<rect x="${x1 + 2}" y="${BASE - 22 - i * 18}" width="${50 - (i % 2) * 8}" height="16" rx="8" fill="${i % 2 ? '#946038' : '#7A4E2C'}"/><circle cx="${x1 + 4}" cy="${BASE - 14 - i * 18}" r="6" fill="#C9A27A"/>`).join('')}
    <rect x="${x0 - 14}" y="${BASE - 6}" width="${x1 - x0 + 28}" height="14" rx="4" fill="#8C847C"/>
  </g>
  <g filter="url(#${id}-wob)" transform="translate(${CX} ${top + 6})">${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `<ellipse cx="${f(Math.cos(a) * 26)}" cy="${f(Math.sin(a) * 26 - 30)}" rx="12" ry="7" fill="${i % 2 ? '#2F7A55' : '#3E9468'}" transform="rotate(${f((a * 180) / Math.PI + 90)} ${f(Math.cos(a) * 26)} ${f(Math.sin(a) * 26 - 30)})"/>`; }).join('')}<path d="M -10 2 q -14 -12 -16 2 q 4 8 16 -2 q 14 -12 16 2 q -4 8 -16 -2" fill="#D94B4B"/></g>`;
}

function cabinet(id) {
  const x0 = 35, x1 = 365, top = 520;
  const books = (bx, by, w, seed) => { const r = rng(seed); let s = '', x = bx; const cols = ['#C94545', '#3E8A63', '#F2C14E', '#4E7FB8', '#F4B6C8', '#8A5A36']; while (x < bx + w - 10) { const bw = 8 + r() * 6, bh = 30 + r() * 14; s += `<rect x="${f(x)}" y="${f(by - bh)}" width="${f(bw)}" height="${f(bh)}" rx="1.5" fill="${cols[(r() * 6) | 0]}"/>`; x += bw + 1.5; } return s; };
  return `${shadow(id, 180)}
  <g filter="url(#${id}-wob)">
    <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${BASE - top}" rx="6" fill="#9A6A42"/>
    ${[0, 1, 2].map((i) => `<rect x="${x0 + 8}" y="${top + 30 + i * 96}" width="56" height="86" rx="4" fill="#5A3A24"/><rect x="${x1 - 64}" y="${top + 30 + i * 96}" width="56" height="86" rx="4" fill="#5A3A24"/>`).join('')}
    ${[0, 1, 2].map((i) => books(x0 + 10, top + 114 + i * 96, 52, 50 + i) + books(x1 - 62, top + 114 + i * 96, 52, 60 + i)).join('')}
    <rect x="${x0 + 74}" y="${top + 30}" width="${x1 - x0 - 148}" height="${BASE - top - 30}" fill="#E6DCC8"/>
  </g>
  <path d="${arch(CX - 70, CX + 70, top + 70, BASE, 18)}" fill="#3A2E2A" filter="url(#${id}-wob)"/>
  ${firebox(id, arch(CX - 60, CX + 60, top + 80, BASE, 14))}${logs(id, CX, BASE - 14, 90)}
  <g filter="url(#${id}-wob)"><rect x="${x0 - 14}" y="${top - 18}" width="${x1 - x0 + 28}" height="26" rx="6" fill="#6B4226"/><rect x="${x0 + 6}" y="${BASE - 4}" width="${x1 - x0 - 12}" height="12" rx="4" fill="#5A3A24"/></g>
  ${garland(id, x0 - 8, x1 + 8, top + 16, 7, 19)}
  ${stocking(CX - 50, top + 14, '#C94545', '#FFF6EA', id)}${stocking(CX + 50, top + 14, '#4E7FB8', '#FFF6EA', id)}
  ${frame(id, x0 + 20, top - 18, 46, 56, '#F2C14E')}${candles(id, x1 - 60, top - 18)}`;
}

function tiled(id) {
  const x0 = 117, x1 = 283, top = 380;
  let tiles = '';
  for (let y = top + 50; y < BASE - 40; y += 34) for (let x = x0 + 6; x < x1 - 6; x += 32) tiles += `<rect x="${x}" y="${y}" width="30" height="32" rx="3" fill="#F7F6F2" stroke="#C9D6E0" stroke-width="1.5"/><path d="M ${x + 15} ${y + 8} q 6 8 0 16 q -6 -8 0 -16 M ${x + 7} ${y + 16} q 8 -6 16 0 q -8 6 -16 0" fill="#5C8FB0" opacity=".85"/>`;
  return `${shadow(id, 110)}
  <g filter="url(#${id}-wob)">
    <rect x="${x0 - 10}" y="${BASE - 40}" width="${x1 - x0 + 20}" height="40" rx="6" fill="#E6E1D8"/>
    <rect x="${x0}" y="${top + 40}" width="${x1 - x0}" height="${BASE - top - 80}" fill="#EDEBE5"/>
    ${tiles}
    <path d="M ${x0 - 12} ${top + 44} L ${x0 - 12} ${top + 22} Q ${CX} ${top - 50} ${x1 + 12} ${top + 22} L ${x1 + 12} ${top + 44} Z" fill="#F3F1EC"/>
    <path d="M ${x0 + 8} ${top + 16} Q ${CX} ${top - 30} ${x1 - 8} ${top + 16}" stroke="#5C8FB0" stroke-width="4" fill="none"/>
    <circle cx="${CX}" cy="${top - 18}" r="12" fill="#C99A2E"/>
    <rect x="${x0 - 8}" y="${top + 40}" width="${x1 - x0 + 16}" height="10" fill="#D9D3C8"/>
  </g>
  <g filter="url(#${id}-wob)"><rect x="${CX - 40}" y="${BASE - 150}" width="80" height="70" rx="8" fill="#B9935A"/><rect x="${CX - 32}" y="${BASE - 142}" width="64" height="54" rx="5" fill="#1E1A22"/></g>
  <g filter="url(#${id}-soft)"><ellipse cx="${CX}" cy="${BASE - 100}" rx="26" ry="16" fill="#7A3A1E" opacity=".9"/></g>
  <path d="M ${CX - 32} ${BASE - 115} L ${CX + 32} ${BASE - 115}" stroke="#B9935A" stroke-width="3"/>
  ${garland(id, x0 - 14, x1 + 14, top + 40, 5, 23)}`;
}

const DRAW = { classic, stove, rustic, victorian, modern, dome, cabinet, tiled };
export function fireplace2Source(kind, id = 'f2') { return wrapLayer(id, DRAW[kind](id)); }
