// 8 phụ kiện treo cho lời nhắn + bong bóng điểm trống.
// Hệ toạ độ riêng: móc treo ở (0, 0), phụ kiện rủ xuống, cao ~44.

export const ORNAMENTS = {
  sock:        { name: 'Tất Noel' },
  star:        { name: 'Ngôi sao' },
  bulb:        { name: 'Bóng đèn' },
  ball:        { name: 'Quả châu' },
  candy:       { name: 'Kẹo gậy' },
  bell:        { name: 'Chuông' },
  gingerbread: { name: 'Bánh gừng' },
  heart:       { name: 'Trái tim' },
  snowflake:   { name: 'Bông tuyết' },
  mitten:      { name: 'Găng tay len' },
  minigift:    { name: 'Hộp quà nhỏ' },
  pinecone:    { name: 'Quả thông' },
  bow:         { name: 'Nơ đỏ' },
  snowman:     { name: 'Người tuyết' },
  moon:        { name: 'Trăng khuyết' },
  lantern:     { name: 'Đèn lồng' },
  stripeball:  { name: 'Châu sọc kẹo' },
  cookie:      { name: 'Bánh quy sao' },
  reindeer:    { name: 'Tuần lộc nhỏ' },
  cocoa:       { name: 'Cốc ca cao' },
};

const L = '#3A2E2A';
const SW = 'stroke="#3A2E2A" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const f = (n) => Math.round(n * 10) / 10;
const face = (y, dx = 5, s = 1) => `<circle cx="${-dx}" cy="${y}" r="${1.7 * s}" fill="${L}"/><circle cx="${dx}" cy="${y}" r="${1.7 * s}" fill="${L}"/><path d="M -2.4 ${y + 3} Q 0 ${y + 5} 2.4 ${y + 3}" fill="none" stroke="${L}" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="${-dx - 3}" cy="${y + 3.2}" rx="2.6" ry="1.6" fill="#FF8FA3" opacity=".7"/><ellipse cx="${dx + 3}" cy="${y + 3.2}" rx="2.6" ry="1.6" fill="#FF8FA3" opacity=".7"/>`;
const string = (len) => `<path d="M 0 0 L 0 ${len}" stroke="${L}" stroke-width="1.6" opacity=".7"/>`;

const DRAW = {
  sock: () => `${string(6)}
    <path d="M -9 8 L 9 8 L 9 30 Q 10 40 0 42 L -12 42 Q -22 40 -20 33 Q -18 28 -9 28 Z" fill="#D94B4B" ${SW}/>
    <path d="M -8 34 q 4 3 8 0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>
    <rect x="-11" y="4" width="22" height="9" rx="4" fill="#FFFFFF" ${SW}/>`,
  star: () => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 20 : 9.5;
      pts.push(`${f(r * Math.cos(a))},${f(26 + r * Math.sin(a))}`);
    }
    return `${string(8)}<polygon points="${pts.join(' ')}" fill="#FFD447" ${SW}/>${face(26, 4.5, 0.9)}`;
  },
  bulb: () => `${string(4)}
    <rect x="-6" y="4" width="12" height="10" rx="2" fill="#9AA3AD" ${SW}/>
    <path d="M -6 8 L 6 8 M -6 11 L 6 11" stroke="${L}" stroke-width="1.4"/>
    <path d="M -6 14 Q -16 24 -12 34 Q -8 44 0 44 Q 8 44 12 34 Q 16 24 6 14 Z" fill="#7FD0FF" ${SW}/>
    <path d="M -7 22 Q -9 28 -7 33" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/>`,
  ball: () => `${string(4)}
    <rect x="-5" y="3" width="10" height="7" rx="2" fill="#F4C542" ${SW}/>
    <circle cx="0" cy="26" r="17" fill="#2F8360" ${SW}/>
    <path d="M -16 22 Q 0 28 16 22" stroke="#F4C542" stroke-width="3.2" fill="none"/>
    <path d="M -15 31 Q 0 37 15 31" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-dasharray="3 3"/>
    <circle cx="-7" cy="17" r="3" fill="#fff" opacity=".85"/>`,
  candy: () => `${string(2)}
    <path d="M 8 44 L 8 14 Q 8 2 -2 2 Q -12 2 -12 12" fill="none" stroke="${L}" stroke-width="10" stroke-linecap="round"/>
    <path d="M 8 44 L 8 14 Q 8 2 -2 2 Q -12 2 -12 12" fill="none" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M 8 44 L 8 14 Q 8 2 -2 2 Q -12 2 -12 12" fill="none" stroke="#D94B4B" stroke-width="5.5" stroke-dasharray="4 4" stroke-linecap="butt"/>`,
  bell: () => `${string(4)}
    <path d="M -8 6 q -8 -6 -9 1 q 1 5 9 -1 q 8 -6 9 1 q -1 5 -9 -1" fill="#D94B4B" ${SW}/>
    <path d="M 0 8 Q -16 10 -15 30 L -18 36 L 18 36 L 15 30 Q 16 10 0 8 Z" fill="#F4C542" ${SW}/>
    <circle cx="0" cy="39" r="4" fill="#D9A82E" ${SW}/>
    <path d="M -8 18 Q -10 24 -9 29" stroke="#FFF3C4" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  gingerbread: () => `${string(4)}
    <circle cx="0" cy="12" r="9" fill="#C98E5A" ${SW}/>
    <path d="M -6 19 L -18 23 Q -21 28 -16 29 L -7 27 L -11 40 Q -11 45 -6 44 L 0 36 L 6 44 Q 11 45 11 40 L 7 27 L 16 29 Q 21 28 18 23 L 6 19 Z" fill="#C98E5A" ${SW}/>
    <circle cx="-3" cy="11" r="1.4" fill="${L}"/><circle cx="3" cy="11" r="1.4" fill="${L}"/>
    <path d="M -3 15 Q 0 17 3 15" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="0" cy="25" r="1.6" fill="#D94B4B"/><circle cx="0" cy="30" r="1.6" fill="#2F8360"/>
    <path d="M -15 25 l 3 0 M 12 25 l 3 0 M -10 40 l 3 0 M 7 40 l 3 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  heart: () => `${string(8)}
    <path d="M 0 42 L -15 28 Q -22 20 -17 13 Q -10 6 0 15 Q 10 6 17 13 Q 22 20 15 28 Z" fill="#FF6B81" ${SW}/>
    <path d="M -12 16 Q -15 20 -12 24" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>
    ${face(25, 4.5, 0.9)}`,
  snowflake: () => {
    let arms = '';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = Math.cos(a), y = Math.sin(a);
      arms += `<path d="M 0 26 L ${f(x * 17)} ${f(26 + y * 17)} M ${f(x * 10)} ${f(26 + y * 10)} L ${f(x * 10 + Math.cos(a + 0.8) * 6)} ${f(26 + y * 10 + Math.sin(a + 0.8) * 6)} M ${f(x * 10)} ${f(26 + y * 10)} L ${f(x * 10 + Math.cos(a - 0.8) * 6)} ${f(26 + y * 10 + Math.sin(a - 0.8) * 6)}" />`;
    }
    return `${string(9)}<g stroke="#3A2E2A" stroke-width="6" stroke-linecap="round" fill="none">${arms}</g><g stroke="#DDF0FA" stroke-width="3" stroke-linecap="round" fill="none">${arms}</g><circle cx="0" cy="26" r="4" fill="#FFFFFF" ${SW}/>`;
  },
  mitten: () => `${string(4)}
    <path d="M -10 8 L 8 8 L 10 30 Q 12 42 2 43 L -6 43 Q -15 42 -14 32 L -18 26 Q -22 19 -15 18 L -12 22 Z" fill="#4E7FB8" ${SW}/>
    <path d="M -9 32 l 18 0 M -9 36 l 18 0" stroke="#FFFFFF" stroke-width="1.8" stroke-dasharray="2 2"/>
    <rect x="-12" y="4" width="22" height="9" rx="3" fill="#FFFFFF" ${SW}/>`,
  minigift: () => `${string(6)}
    <rect x="-14" y="16" width="28" height="24" rx="3" fill="#3E8A63" ${SW}/>
    <rect x="-16" y="11" width="32" height="8" rx="2.5" fill="#2F7A55" ${SW}/>
    <path d="M 0 11 L 0 40" stroke="#F2C14E" stroke-width="4"/>
    <path d="M 0 11 q -10 -9 -12 -1 q 2 4 12 1 q 10 -9 12 -1 q -2 4 -12 1" fill="#F2C14E" ${SW}/>`,
  pinecone: () => {
    let sc = '';
    for (let r = 0; r < 5; r++) for (let j = -1; j <= 1; j++) {
      const w = 12 - Math.abs(r - 2) * 2, x = j * w * 0.55, y = 14 + r * 6;
      sc += `<path d="M ${f(x - 5)} ${y} q 5 6 10 0" fill="#8A5A36" stroke="#3A2E2A" stroke-width="1.6"/>`;
    }
    return `${string(5)}<path d="M -4 8 q 4 -4 8 0" stroke="#2F7A55" stroke-width="3" fill="none"/><ellipse cx="0" cy="26" rx="12" ry="17" fill="#A8744A" ${SW}/>${sc}`;
  },
  bow: () => `${string(8)}
    <path d="M 0 22 Q -18 6 -20 18 Q -21 30 0 22 Q 21 30 20 18 Q 18 6 0 22 Z" fill="#D94B4B" ${SW}/>
    <path d="M -3 24 L -10 42 L -4 39 L 0 44 L 2 25 M 3 24 L 10 42 L 4 39" fill="#C94040" ${SW}/>
    <circle cx="0" cy="22" r="5" fill="#B83A3A" ${SW}/>`,
  snowman: () => `${string(3)}
    <circle cx="0" cy="34" r="11" fill="#FFFFFF" ${SW}/>
    <circle cx="0" cy="18" r="9" fill="#FFFFFF" ${SW}/>
    <rect x="-8" y="4" width="16" height="5" rx="2" fill="#3A2E2A"/><rect x="-5" y="-2" width="10" height="8" rx="2" fill="#3A2E2A"/>
    <circle cx="-3" cy="17" r="1.3" fill="#3A2E2A"/><circle cx="3" cy="17" r="1.3" fill="#3A2E2A"/>
    <path d="M 0 20 l 6 1.5 l -6 1 Z" fill="#F49B3A"/>
    <path d="M -9 25 Q 0 29 9 25" stroke="#D94B4B" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  moon: () => `${string(6)}
    <mask id="moonm"><rect x="-30" y="0" width="60" height="60" fill="#fff"/><circle cx="9" cy="21" r="14" fill="#000"/></mask>
    <mask id="moonin"><circle cx="0" cy="26" r="17" fill="#fff"/></mask>
    <g mask="url(#moonm)"><circle cx="0" cy="26" r="17" fill="#FFE07A" stroke="#3A2E2A" stroke-width="2.6"/></g>
    <g mask="url(#moonin)"><circle cx="9" cy="21" r="14" fill="none" stroke="#3A2E2A" stroke-width="2.6"/></g>
    <circle cx="-9" cy="27" r="1.5" fill="#3A2E2A"/><path d="M -11 33 q 2 2 4 0" stroke="#3A2E2A" stroke-width="1.4" fill="none"/>
    <ellipse cx="-13" cy="31" rx="2.4" ry="1.5" fill="#FF8FA3" opacity=".7"/>`,
  lantern: () => `${string(4)}
    <rect x="-8" y="4" width="16" height="6" rx="2" fill="#2E3B5C" ${SW}/>
    <path d="M -11 10 L 11 10 L 13 36 L -13 36 Z" fill="#FFE2A0" ${SW}/>
    <path d="M -4 10 L -5 36 M 4 10 L 5 36" stroke="#2E3B5C" stroke-width="2"/>
    <ellipse cx="0" cy="24" rx="4" ry="6" fill="#FFB547"/>
    <rect x="-14" y="36" width="28" height="6" rx="2" fill="#2E3B5C" ${SW}/>`,
  stripeball: () => `${string(4)}
    <rect x="-5" y="3" width="10" height="7" rx="2" fill="#C9C1B5" ${SW}/>
    <clipPath id="sbc"><circle cx="0" cy="26" r="16"/></clipPath>
    <circle cx="0" cy="26" r="16" fill="#FFFFFF"/>
    <g clip-path="url(#sbc)">${[-24, -12, 0, 12, 24].map((x) => `<path d="M ${x - 6} 6 L ${x + 14} 46" stroke="#D94B4B" stroke-width="5"/>`).join('')}</g>
    <circle cx="0" cy="26" r="16" fill="none" ${SW}/>
    <circle cx="-6" cy="19" r="3" fill="#fff" opacity=".85"/>`,
  cookie: () => {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 === 0 ? 19 : 10; pts.push(`${f(r * Math.cos(a))},${f(26 + r * Math.sin(a))}`); }
    return `${string(7)}<polygon points="${pts.join(' ')}" fill="#D9A066" ${SW}/>
      <polygon points="${pts.join(' ')}" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="3 3" transform="translate(0 26) scale(.72) translate(0 -26)"/>
      <circle cx="-4" cy="24" r="1.6" fill="#D94B4B"/><circle cx="4" cy="28" r="1.6" fill="#3E9468"/><circle cx="1" cy="20" r="1.4" fill="#4E7FB8"/>`;
  },
  reindeer: () => `${string(3)}
    <path d="M -8 12 q -6 -10 -2 -14 M -9 6 l -6 -2 M 8 12 q 6 -10 2 -14 M 9 6 l 6 -2" stroke="#7A5233" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="-14" cy="18" rx="6" ry="3.5" fill="#B9845A" ${SW}/><ellipse cx="14" cy="18" rx="6" ry="3.5" fill="#B9845A" ${SW}/>
    <ellipse cx="0" cy="26" rx="13" ry="15" fill="#B9845A" ${SW}/>
    <ellipse cx="0" cy="35" rx="8" ry="6" fill="#FCEBD4"/>
    <circle cx="0" cy="33" r="3.4" fill="#5A3A22"/>
    <circle cx="-5" cy="23" r="1.7" fill="#3A2E2A"/><circle cx="5" cy="23" r="1.7" fill="#3A2E2A"/>`,
  cocoa: () => `${string(8)}
    <path d="M -13 16 L 11 16 L 9 38 Q 9 42 5 42 L -9 42 Q -13 42 -13 38 Z" fill="#D94B4B" ${SW}/>
    <path d="M 11 21 q 9 0 8 8 q -1 6 -9 5" fill="none" ${SW}/>
    <ellipse cx="-1" cy="16" rx="12" ry="3.5" fill="#7A4E2C" ${SW}/>
    <circle cx="-5" cy="13" r="3.5" fill="#FFFFFF" ${SW}/><circle cx="2" cy="12" r="3" fill="#FFFFFF" ${SW}/>
    <path d="M -9 28 l 16 0" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="3 2"/>`,
};

// state: 'filled' (khách thấy) | 'locked' (chủ cây, trước giờ mở) | 'unread' | 'read'
export function ornamentSVG(kind, state = 'filled', delay = 0) {
  const draw = DRAW[kind] || DRAW.ball;
  const lockBow = state === 'locked'
    ? `<g class="lock-bow"><path d="M 0 4 q -10 -8 -11 0 q 1 6 11 0 q 10 -8 11 0 q -1 6 -11 0" fill="#D94B4B" stroke="${L}" stroke-width="2"/><circle cx="0" cy="4" r="2.6" fill="#B83A3A"/></g>` : '';
  const glint = state === 'unread'
    ? `<g class="glint"><path d="M 16 10 l 1.6 4 l 4 1.6 l -4 1.6 l -1.6 4 l -1.6 -4 l -4 -1.6 l 4 -1.6 Z" fill="#FFF6C8" stroke="#E5B92E" stroke-width="1"/><path d="M -18 32 l 1.2 3 l 3 1.2 l -3 1.2 l -1.2 3 l -1.2 -3 l -3 -1.2 l 3 -1.2 Z" fill="#FFF6C8" stroke="#E5B92E" stroke-width="1"/></g>` : '';
  const st = delay == null ? '' : ` style="--d:${delay}s"`;
  return `<g class="ornament orn-${kind} st-${state}"${st} data-part="ornament"><g class="orn-body">${draw()}</g>${lockBow}${glint}</g>`;
}

// Bong bóng điểm nhắn trống: tâm ở (0, 22) để khớp với vị trí phụ kiện.
export function slotBubbleSVG(delay = 0, dim = false) {
  const st = delay == null ? '' : ` style="--d:${delay}s"`;
  return `<g class="slot-bubble${dim ? ' dim' : ''}"${st} data-part="slot">
    <circle class="bubble-glow" cx="0" cy="22" r="22" fill="#FFF6C8" opacity=".45"/>
    <circle cx="0" cy="22" r="16" fill="#FFFFFF" fill-opacity=".38" stroke="#FFFFFF" stroke-width="2.4" stroke-opacity=".95"/>
    <path d="M -6 15 Q -9 18 -9 22" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".9"/>
    <path d="M 0 16 L 0 28 M -6 22 L 6 22" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" opacity=".95"/>
    <path d="M 0 16 L 0 28 M -6 22 L 6 22" stroke="#3A2E2A" stroke-width="1.2" stroke-linecap="round" opacity=".25"/>
  </g>`;
}

export const ORNAMENTS_CSS = `
.ornament{transform-box:fill-box;transform-origin:50% 0%;animation:orn-swing 3.4s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes orn-swing{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
.ornament.st-locked .orn-body{filter:saturate(.25) brightness(1.08);opacity:.75}
.ornament.st-unread .orn-body{animation:orn-shine 1.6s ease-in-out infinite}
@keyframes orn-shine{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35) drop-shadow(0 0 4px #FFE27A)}}
.glint path{transform-box:fill-box;transform-origin:center;animation:glint 1.4s ease-in-out infinite}
.glint path:nth-child(2){animation-delay:.7s}
@keyframes glint{0%,100%{transform:scale(.3);opacity:0}50%{transform:scale(1.1);opacity:1}}
.slot-bubble{transform-box:fill-box;transform-origin:50% 60%;animation:bubble 2.6s ease-in-out infinite;animation-delay:var(--d,0s)}
@keyframes bubble{0%,100%{transform:scale(.92);opacity:.75}50%{transform:scale(1.06);opacity:1}}
.slot-bubble .bubble-glow{transform-box:fill-box;transform-origin:center;animation:glow 2.6s ease-in-out infinite;animation-delay:var(--d,0s)}
.slot-bubble.dim{opacity:.45;animation:none}
.pop .ornament{animation:orn-ring .9s ease-in-out}
@keyframes orn-ring{0%,100%{transform:rotate(0)}15%{transform:rotate(-26deg)}35%{transform:rotate(20deg)}55%{transform:rotate(-12deg)}75%{transform:rotate(6deg)}}
.pop .slot-bubble{animation:bubble-pop .5s ease-out}
@keyframes bubble-pop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
.drop-in .ornament{animation:orn-drop .9s cubic-bezier(.3,1.5,.5,1)}
@keyframes orn-drop{0%{transform:translateY(-60px);opacity:0}60%{transform:translateY(4px);opacity:1}100%{transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){.ornament,.slot-bubble,.slot-bubble .bubble-glow,.glint path,.ornament.st-unread .orn-body{animation:none}}
`;

// bản màu nước mềm cho phụ kiện treo (cùng cách làm với thú cưng)
function mixC(hex, t, to) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const d = to === 'w' ? 255 : 0;
  return '#' + c.map((v) => Math.round(v + (d - v) * t).toString(16).padStart(2, '0')).join('');
}
export function ornamentSVGSoft(kind, state = 'filled', delay = null) {
  let s = ornamentSVG(kind, state, delay);
  s = s.replace(/stroke="#3A2E2A" stroke-width="([\d.]+)"/g, (m, w) => `stroke="#6E5A52" stroke-width="${Math.max(1.4, +w * 0.75).toFixed(1)}" stroke-opacity=".9"`);
  const used = new Set();
  s = s.replace(/fill="(#[0-9A-Fa-f]{6})"/g, (m, hex) => { const h = hex.toUpperCase(); if (h === '#3A2E2A') return m; used.add(h); return `fill="url(#ow-${h.slice(1)})"`; });
  const defs = [...used].map((h) => `<radialGradient id="ow-${h.slice(1)}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${mixC(h, 0.35, 'w')}"/><stop offset=".55" stop-color="${h}"/><stop offset="1" stop-color="${mixC(h, 0.15, 'b')}"/></radialGradient>`).join('');
  return `<defs>${defs}</defs>${s}`;
}
