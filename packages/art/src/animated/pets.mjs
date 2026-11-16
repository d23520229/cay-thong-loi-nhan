// Thú cưng (6 loại). Mỗi con vẽ trong hệ toạ độ riêng: tâm x = 0, chân chạm y = 0, cao ~125.
// Khi đặt vào cảnh: <g transform="translate(x y) scale(s)"> + petSVG(kind).

export const PETS = {
  cat:     { name: 'Mèo cam' },
  dog:     { name: 'Cún' },
  deer:    { name: 'Tuần lộc' },
  bear:    { name: 'Gấu bông' },
  owl:     { name: 'Cú mèo' },
  penguin: { name: 'Chim cánh cụt' },
};

const L = '#3A2E2A';
const SW = 'stroke="#3A2E2A" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';

const blush = (dx, y, r = 7) => `<ellipse cx="${-dx}" cy="${y}" rx="${r}" ry="${r * 0.6}" fill="#FF8FA3" opacity=".6"/><ellipse cx="${dx}" cy="${y}" rx="${r}" ry="${r * 0.6}" fill="#FF8FA3" opacity=".6"/>`;
const eyes = (dx, y, rx = 4.6, ry = 6) => `<g class="eyes"><ellipse cx="${-dx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${L}"/><ellipse cx="${dx}" cy="${y}" rx="${rx}" ry="${ry}" fill="${L}"/><circle cx="${-dx + 1.5}" cy="${y - 2}" r="1.6" fill="#fff"/><circle cx="${dx + 1.5}" cy="${y - 2}" r="1.6" fill="#fff"/></g>`;
const hearts = (y) => `<g class="pet-hearts"><path d="M -14 ${y} c -6 -8 -18 -2 -10 8 l 10 9 l 10 -9 c 8 -10 -4 -16 -10 -8 Z" fill="#FF6B81" stroke="${L}" stroke-width="2.5" transform="translate(-18 0) scale(.8)"/><path d="M 0 ${y} c -6 -8 -18 -2 -10 8 l 10 9 l 10 -9 c 8 -10 -4 -16 -10 -8 Z" fill="#FF6B81" stroke="${L}" stroke-width="2.5" transform="translate(22 -10) scale(.6)"/></g>`;

function cat() {
  const c = '#F2A65A', d = '#D9853A', belly = '#FFE3C4';
  return `
  <path class="tail" d="M 26 -8 Q 62 -6 60 -40 Q 58 -62 44 -60" fill="none" stroke="${L}" stroke-width="15" stroke-linecap="round"/>
  <path class="tail" d="M 26 -8 Q 62 -6 60 -40 Q 58 -62 44 -60" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>
  <g class="breath">
    <path d="M -34 0 Q -42 -52 -16 -64 L 16 -64 Q 42 -52 34 0 Z" fill="${c}" ${SW}/>
    <ellipse cx="0" cy="-26" rx="17" ry="22" fill="${belly}"/>
    <ellipse cx="-14" cy="-3" rx="11" ry="7" fill="${belly}" ${SW}/><ellipse cx="14" cy="-3" rx="11" ry="7" fill="${belly}" ${SW}/>
  </g>
  <g class="head">
    <path d="M -34 -92 L -30 -126 L -8 -110 Z M 34 -92 L 30 -126 L 8 -110 Z" fill="${c}" ${SW}/>
    <path d="M -28 -101 L -27 -118 L -16 -109 Z M 28 -101 L 27 -118 L 16 -109 Z" fill="#FFB3C1"/>
    <ellipse cx="0" cy="-86" rx="40" ry="32" fill="${c}" ${SW}/>
    <path d="M -8 -114 L -8 -104 M 0 -116 L 0 -105 M 8 -114 L 8 -104" stroke="${d}" stroke-width="4" stroke-linecap="round"/>
    ${eyes(15, -86)}
    ${blush(26, -74)}
    <path d="M -4 -77 L 4 -77 L 0 -72 Z" fill="#FF8FA3" stroke="${L}" stroke-width="2"/>
    <path d="M -7 -68 Q -3.5 -64 0 -68 Q 3.5 -64 7 -68" fill="none" stroke="${L}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M -44 -80 L -58 -82 M -44 -74 L -57 -70 M 44 -80 L 58 -82 M 44 -74 L 57 -70" stroke="${L}" stroke-width="2" stroke-linecap="round"/>
  </g>
  ${hearts(-140)}`;
}

function dog() {
  const c = '#E9C28E', e = '#A8744A', w = '#FFF6E8';
  return `
  <path class="tail" d="M 28 -14 Q 50 -22 52 -44" fill="none" stroke="${L}" stroke-width="14" stroke-linecap="round"/>
  <path class="tail" d="M 28 -14 Q 50 -22 52 -44" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
  <g class="breath">
    <path d="M -34 0 Q -40 -54 -14 -64 L 14 -64 Q 40 -54 34 0 Z" fill="${c}" ${SW}/>
    <ellipse cx="0" cy="-28" rx="16" ry="22" fill="${w}"/>
    <ellipse cx="-14" cy="-3" rx="11" ry="7" fill="${w}" ${SW}/><ellipse cx="14" cy="-3" rx="11" ry="7" fill="${w}" ${SW}/>
    <path d="M -24 -62 Q 0 -54 24 -62" fill="none" stroke="#D94B4B" stroke-width="7" stroke-linecap="round"/>
    <circle cx="0" cy="-54" r="5.5" fill="#F4C542" stroke="${L}" stroke-width="2"/>
  </g>
  <g class="head">
    <ellipse cx="0" cy="-90" rx="38" ry="33" fill="${c}" ${SW}/>
    <path class="ear ear-l" d="M -30 -112 Q -54 -108 -52 -78 Q -50 -64 -38 -72 Q -30 -90 -24 -108 Z" fill="${e}" ${SW}/>
    <path class="ear ear-r" d="M 30 -112 Q 54 -108 52 -78 Q 50 -64 38 -72 Q 30 -90 24 -108 Z" fill="${e}" ${SW}/>
    ${eyes(14, -94)}
    ${blush(26, -80)}
    <ellipse cx="0" cy="-76" rx="17" ry="12" fill="${w}" ${SW}/>
    <ellipse cx="0" cy="-82" rx="6.5" ry="4.5" fill="${L}"/>
    <path d="M -6 -72 Q 0 -68 6 -72" fill="none" stroke="${L}" stroke-width="2.5" stroke-linecap="round"/>
    <path class="tongue" d="M -4 -70 Q 0 -60 4 -70 Z" fill="#FF7E95" stroke="${L}" stroke-width="2"/>
  </g>
  ${hearts(-140)}`;
}

function deer() {
  const c = '#B9845A', w = '#FCEBD4', a = '#7A5233';
  const antler = (s) => `<path d="M ${s * 16} -112 Q ${s * 22} -134 ${s * 36} -146 M ${s * 24} -130 Q ${s * 36} -128 ${s * 44} -134 M ${s * 30} -140 Q ${s * 30} -150 ${s * 26} -158" fill="none" stroke="${L}" stroke-width="10" stroke-linecap="round"/><path d="M ${s * 16} -112 Q ${s * 22} -134 ${s * 36} -146 M ${s * 24} -130 Q ${s * 36} -128 ${s * 44} -134 M ${s * 30} -140 Q ${s * 30} -150 ${s * 26} -158" fill="none" stroke="${a}" stroke-width="4.5" stroke-linecap="round"/>`;
  return `
  <g class="breath">
    <path d="M -32 0 Q -40 -54 -14 -64 L 14 -64 Q 40 -54 32 0 Z" fill="${c}" ${SW}/>
    <ellipse cx="0" cy="-28" rx="15" ry="21" fill="${w}"/>
    <circle cx="-18" cy="-44" r="3" fill="${w}"/><circle cx="20" cy="-36" r="2.5" fill="${w}"/><circle cx="-22" cy="-24" r="2.5" fill="${w}"/>
    <rect x="-24" y="-12" width="16" height="12" rx="5" fill="${a}" ${SW}/><rect x="8" y="-12" width="16" height="12" rx="5" fill="${a}" ${SW}/>
    <path d="M -26 -60 Q 0 -50 26 -60 L 24 -52 Q 0 -42 -24 -52 Z" fill="#2F8360" ${SW}/>
    <path d="M 14 -52 L 20 -30 L 28 -32 L 22 -54" fill="#2F8360" ${SW}/>
  </g>
  <g class="head">
    ${antler(-1)}${antler(1)}
    <path d="M -34 -96 Q -56 -104 -54 -88 Q -46 -80 -32 -88 Z M 34 -96 Q 56 -104 54 -88 Q 46 -80 32 -88 Z" fill="${c}" ${SW}/>
    <ellipse cx="0" cy="-90" rx="34" ry="30" fill="${c}" ${SW}/>
    ${eyes(13, -96)}
    ${blush(24, -82)}
    <ellipse cx="0" cy="-74" rx="16" ry="12" fill="${w}" ${SW}/>
    <ellipse cx="0" cy="-79" rx="6" ry="4.5" fill="#5A3A22"/>
    <path d="M -5 -70 Q 0 -66 5 -70" fill="none" stroke="${L}" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  ${hearts(-170)}`;
}

function bear() {
  const c = '#B47A4C', w = '#F2D3B0';
  return `
  <g class="breath">
    <path d="M -36 0 Q -44 -56 -14 -66 L 14 -66 Q 44 -56 36 0 Z" fill="${c}" ${SW}/>
    <ellipse cx="0" cy="-30" rx="18" ry="22" fill="${w}"/>
    <path d="M -9 -36 c -4 -5 -11 -1 -6 5 l 6 5 l 6 -5 c 5 -6 -2 -10 -6 -5 Z" fill="#FF8FA3"/>
    <ellipse cx="-20" cy="-4" rx="13" ry="9" fill="${c}" ${SW}/><ellipse cx="20" cy="-4" rx="13" ry="9" fill="${c}" ${SW}/>
    <ellipse cx="-20" cy="-4" rx="6" ry="4.5" fill="${w}"/><ellipse cx="20" cy="-4" rx="6" ry="4.5" fill="${w}"/>
    <path d="M -32 -52 Q -46 -36 -38 -22" fill="none" stroke="${L}" stroke-width="15" stroke-linecap="round"/><path d="M -32 -52 Q -46 -36 -38 -22" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>
  </g>
  <g class="arm-r"><path d="M 32 -52 Q 46 -36 38 -22" fill="none" stroke="${L}" stroke-width="15" stroke-linecap="round"/><path d="M 32 -52 Q 46 -36 38 -22" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/></g>
  <g class="head">
    <circle cx="-30" cy="-114" r="13" fill="${c}" ${SW}/><circle cx="30" cy="-114" r="13" fill="${c}" ${SW}/>
    <circle cx="-30" cy="-114" r="6" fill="${w}"/><circle cx="30" cy="-114" r="6" fill="${w}"/>
    <ellipse cx="0" cy="-90" rx="38" ry="32" fill="${c}" ${SW}/>
    ${eyes(15, -94)}
    ${blush(27, -80)}
    <ellipse cx="0" cy="-77" rx="15" ry="11" fill="${w}" ${SW}/>
    <ellipse cx="0" cy="-81" rx="6" ry="4.5" fill="${L}"/>
    <path d="M 0 -77 L 0 -72 M -5 -70 Q 0 -66 5 -70" fill="none" stroke="${L}" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  ${hearts(-140)}`;
}

function owl() {
  const c = '#B98B5E', face = '#F6E2C4', wing = '#93683F';
  let feathers = '';
  for (let r = 0; r < 3; r++) for (let i = -1; i <= 1; i++) feathers += `<path d="M ${i * 11 - 5 + (r % 2) * 5} ${-46 + r * 12} q 5 6 10 0" fill="none" stroke="#C9A27A" stroke-width="2.5" stroke-linecap="round"/>`;
  return `
  <g class="breath">
    <path d="M -38 -8 Q -46 -70 0 -74 Q 46 -70 38 -8 Q 30 4 0 4 Q -30 4 -38 -8 Z" fill="${c}" ${SW}/>
    <ellipse cx="0" cy="-32" rx="22" ry="26" fill="${face}"/>
    ${feathers}
    <path class="wing wing-l" d="M -36 -54 Q -54 -30 -38 -8 Q -30 -26 -30 -50 Z" fill="${wing}" ${SW}/>
    <path class="wing wing-r" d="M 36 -54 Q 54 -30 38 -8 Q 30 -26 30 -50 Z" fill="${wing}" ${SW}/>
    <path d="M -14 2 l -6 6 M -14 2 l 0 7 M -14 2 l 6 6 M 14 2 l -6 6 M 14 2 l 0 7 M 14 2 l 6 6" stroke="#E8963A" stroke-width="4" stroke-linecap="round"/>
  </g>
  <g class="head">
    <path d="M -40 -96 L -36 -128 L -14 -114 Z M 40 -96 L 36 -128 L 14 -114 Z" fill="${wing}" ${SW}/>
    <ellipse cx="0" cy="-92" rx="44" ry="34" fill="${c}" ${SW}/>
    <circle cx="-18" cy="-94" r="17" fill="${face}" ${SW}/><circle cx="18" cy="-94" r="17" fill="${face}" ${SW}/>
    <g class="eyes"><circle cx="-18" cy="-94" r="8" fill="${L}"/><circle cx="18" cy="-94" r="8" fill="${L}"/><circle cx="-15" cy="-97" r="2.6" fill="#fff"/><circle cx="21" cy="-97" r="2.6" fill="#fff"/></g>
    <path d="M -6 -80 L 6 -80 L 0 -68 Z" fill="#F4A13A" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>
    ${blush(32, -74, 6)}
  </g>
  ${hearts(-142)}`;
}

function penguin() {
  const c = '#2E3B5C', w = '#FFFFFF';
  return `
  <g class="breath">
    <path d="M -36 -6 Q -46 -80 0 -128 Q 46 -80 36 -6 Q 28 4 0 4 Q -28 4 -36 -6 Z" fill="${c}" ${SW}/>
    <path d="M -24 -10 Q -32 -64 0 -76 Q 32 -64 24 -10 Q 14 -2 0 -2 Q -14 -2 -24 -10 Z" fill="${w}"/>
    <path class="flip flip-l" d="M -34 -64 Q -56 -44 -50 -20 Q -38 -30 -32 -46 Z" fill="${c}" ${SW}/>
    <path class="flip flip-r" d="M 34 -64 Q 56 -44 50 -20 Q 38 -30 32 -46 Z" fill="${c}" ${SW}/>
    <ellipse cx="-14" cy="3" rx="11" ry="5" fill="#F49B3A" ${SW}/><ellipse cx="14" cy="3" rx="11" ry="5" fill="#F49B3A" ${SW}/>
  </g>
  <g class="head">
    <ellipse cx="-12" cy="-94" rx="13" ry="14" fill="${w}"/><ellipse cx="12" cy="-94" rx="13" ry="14" fill="${w}"/>
    ${eyes(12, -95, 4, 5.4)}
    ${blush(24, -84, 6)}
    <path d="M -7 -86 L 7 -86 L 0 -77 Z" fill="#F49B3A" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M -30 -110 Q 0 -150 30 -110 Q 0 -100 -30 -110 Z" fill="#D94B4B" ${SW}/>
    <path d="M -32 -112 Q 0 -100 32 -112" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
    <circle cx="4" cy="-140" r="8" fill="#fff" ${SW}/>
    <path d="M -28 -70 Q 0 -60 28 -70 L 26 -62 Q 0 -52 -26 -62 Z" fill="#F4C542" ${SW}/>
  </g>
  ${hearts(-160)}`;
}

const DRAW = { cat, dog, deer, bear, owl, penguin };

export function petSVG(kind) {
  const draw = DRAW[kind] || cat;
  return `<g class="pet pet-${kind}" data-part="pet"><ellipse cx="0" cy="4" rx="42" ry="7" fill="#000" opacity=".12"/>${draw()}</g>`;
}

export const PETS_CSS = `
.pet{transform-box:fill-box;transform-origin:50% 100%}
.pet .breath{transform-box:fill-box;transform-origin:50% 100%;animation:pet-breath 3.2s ease-in-out infinite}
@keyframes pet-breath{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,.975)}}
.pet .head{transform-box:fill-box;transform-origin:50% 90%;animation:pet-head 4.5s ease-in-out infinite}
@keyframes pet-head{0%,100%{transform:rotate(0)}50%{transform:rotate(-3deg)}}
.pet .eyes{transform-box:fill-box;transform-origin:center;animation:blink 4.8s infinite}
.pet-cat .eyes{animation-delay:.8s}.pet-owl .eyes{animation-delay:2s}.pet-bear .eyes{animation-delay:1.4s}
.pet .tail{transform-box:fill-box;transform-origin:0% 100%;animation:pet-tail 1.6s ease-in-out infinite}
@keyframes pet-tail{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(10deg)}}
.pet-dog .tail{animation-duration:.8s}
.pet .ear{transform-box:fill-box;transform-origin:50% 0%}
.pet .flip-l{transform-box:fill-box;transform-origin:100% 0%}
.pet .flip-r{transform-box:fill-box;transform-origin:0% 0%}
.pet .arm-r{transform-box:fill-box;transform-origin:20% 10%}
.pet-hearts{opacity:0;transform-box:fill-box;transform-origin:50% 100%}
.pop .pet{animation:pet-hop .65s cubic-bezier(.3,1.6,.5,1)}
@keyframes pet-hop{0%{transform:translateY(0) scale(1,1)}25%{transform:translateY(0) scale(1.08,.9)}55%{transform:translateY(-22px) scale(.95,1.06)}100%{transform:translateY(0) scale(1,1)}}
.pop .pet-hearts{animation:hearts 1.3s ease-out}
@keyframes hearts{0%{opacity:0;transform:translateY(10px) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translateY(-26px) scale(1.1)}}
.pop .pet .tail{animation:pet-tail .18s ease-in-out 7}
.pop .pet-dog .ear-l{animation:ear-flop-l .25s ease-in-out 4}
.pop .pet-dog .ear-r{animation:ear-flop-r .25s ease-in-out 4}
@keyframes ear-flop-l{50%{transform:rotate(18deg)}}
@keyframes ear-flop-r{50%{transform:rotate(-18deg)}}
.pop .pet-owl .head{animation:owl-turn 1.1s ease-in-out}
@keyframes owl-turn{0%,100%{transform:rotate(0)}35%{transform:rotate(-24deg)}70%{transform:rotate(18deg)}}
.pop .pet-deer .head{animation:deer-nod .35s ease-in-out 3}
@keyframes deer-nod{50%{transform:rotate(8deg)}}
.pop .pet-bear .arm-r{animation:bear-wave .35s ease-in-out 4}
@keyframes bear-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-130deg)}}
.pop .pet-penguin .flip-l{animation:flap-l .18s ease-in-out 7}
.pop .pet-penguin .flip-r{animation:flap-r .18s ease-in-out 7}
@keyframes flap-l{50%{transform:rotate(30deg)}}
@keyframes flap-r{50%{transform:rotate(-30deg)}}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@media (prefers-reduced-motion:reduce){.pet .breath,.pet .head,.pet .eyes,.pet .tail{animation:none}}
`;

// ---------- bản màu nước: viền mảnh màu nâu nhạt, mảng màu có độ loang sáng-tối ----------
function mix(hex, t, to) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const d = to === 'w' ? 255 : 0;
  return '#' + c.map((v) => Math.round(v + (d - v) * t).toString(16).padStart(2, '0')).join('');
}
export function petSVGSoft(kind) {
  let s = petSVG(kind);
  // viền: mảnh hơn, nâu nhạt, hơi trong
  s = s.replace(/stroke="#3A2E2A" stroke-width="([\d.]+)"/g, (m, w) => {
    const nw = +w >= 10 ? +w * 0.8 : Math.max(1.6, +w * 0.66);
    return `stroke="#7A655C" stroke-width="${nw.toFixed(1)}" stroke-opacity=".85"`;
  });
  // mảng màu: thay màu phẳng bằng chuyển sắc loang (sáng phía trên trái, đậm dần ra mép)
  const used = new Set();
  s = s.replace(/fill="(#[0-9A-Fa-f]{6})"/g, (m, hex) => {
    const h = hex.toUpperCase();
    if (h === '#3A2E2A' || h === '#000000') return m;
    used.add(h);
    return `fill="url(#wc-${h.slice(1)})"`;
  });
  const defs = [...used].map((h) => `<radialGradient id="wc-${h.slice(1)}" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${mix(h, 0.32, 'w')}"/><stop offset=".55" stop-color="${h}"/><stop offset="1" stop-color="${mix(h, 0.14, 'b')}"/></radialGradient>`).join('');
  return `<defs>${defs}</defs>${s}`;
}
