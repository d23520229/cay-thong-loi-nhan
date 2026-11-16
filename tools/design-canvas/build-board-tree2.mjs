import { PALETTES, SHAPES, TRUNK_SHAPES, WOODS, lightsSource, starSource, TREE2_CSS } from '../../packages/art/src/tree.mjs';
import { FONTS } from './design-common.mjs';
import fs from 'fs';
const U = JSON.parse(fs.readFileSync('tools/design-canvas/data/asset-urls.json'));
const OUT = 'tools/design-canvas/boards/';
const page = (title, body, script, css = '') => `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
<style>
body{margin:0}
${TREE2_CSS}
.pill{font:inherit;cursor:pointer;min-height:44px;padding:8px 18px;border-radius:999px;border:2px solid #E9DCCB;background:transparent;color:#F6EBDD;font-size:19px}
.pill:hover{background:rgba(255,255,255,.08)}
.sw{cursor:pointer;width:46px;height:46px;border-radius:50%;border:2px solid rgba(255,255,255,.5);padding:0}
${css}
</style>
</helmet>
${body}
</x-dc>
${script}
</body>
</html>
`;
const layer = 'position: absolute; left: 0; top: 0; width: 400px; height: 600px';
let trunks = '', canopies = '', lights = '', stars = '';
for (const t of Object.keys(TRUNK_SHAPES)) for (const w of Object.keys(WOODS))
  trunks += `<sc-if value="{{tk_${t}_${w}}}" hint-placeholder-val="{{${t === 'straight' && w === 'oak'}}}"><img src="${U[`trunk-${t}-${w}`]}" alt="" style="${layer}"></sc-if>\n`;
for (const s of Object.keys(SHAPES)) {
  for (const p of Object.keys(PALETTES))
    canopies += `<sc-if value="{{cn_${s}_${p}}}" hint-placeholder-val="{{${s === 'cloud3' && p === 'teal'}}}"><img src="${U[`canopy-${s}-${p}`]}" alt="" style="${layer}"></sc-if>\n`;
  lights += `<sc-if value="{{sh_${s}}}" hint-placeholder-val="{{${s === 'cloud3'}}}"><svg viewBox="0 0 400 600" width="400" height="600" style="${layer}; overflow: visible" aria-hidden="true">${lightsSource(s)}${starSource(s)}</svg></sc-if>\n`;
}
const pills = (list, n) => `<div style="display: flex; flex-wrap: wrap; gap: 10px"><sc-for list="{{${list}}}" as="it" hint-placeholder-count="${n}"><button type="button" class="pill" onClick="{{it.pick}}" aria-pressed="{{it.on}}" style="{{it.css}}">{{it.name}}</button></sc-for></div>`;
const sws = (list, n) => `<div style="display: flex; flex-wrap: wrap; gap: 12px"><sc-for list="{{${list}}}" as="it" hint-placeholder-count="${n}"><button type="button" class="sw" onClick="{{it.pick}}" aria-label="{{it.name}}" aria-pressed="{{it.on}}" title="{{it.name}}" style="{{it.css}}"></button></sc-for></div>`;
const h2 = (t) => `<h2 style="margin: 0; font-family: 'Grape Nuts', cursive; font-size: 22px; font-weight: 400; color: #F3D9A4">${t}</h2>`;
const body = `<div style="width: 1120px; height: 760px; box-sizing: border-box; padding: 56px; display: flex; gap: 56px; align-items: flex-start; background: #2C2633; font-family: 'Mynerve', cursive; color: #F6EBDD">
<button type="button" onClick="{{shakeTree}}" aria-label="Chạm vào cây để thử hiệu ứng" class="{{stageCls}}" style="position: relative; flex: none; width: 400px; height: 600px; padding: 0; border: 0; border-radius: 32px; overflow: hidden; cursor: pointer; background: #4A4152">
<div style="position: absolute; left: 0; right: 0; bottom: 0; height: 104px; background: #3A3038"></div>
<div style="position: absolute; left: 70px; top: 512px; width: 260px; height: 56px; border-radius: 50%; background: #9C3B3B; box-shadow: inset 0 0 0 5px #C9A88A"></div>
${trunks}
<div class="sway2" style="${layer}">
${canopies}${lights}
</div>
</button>
<div style="flex: 1; display: flex; flex-direction: column; gap: 22px; min-width: 0">
<div>
<h1 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 72px; line-height: 1; color: #FFD86B">Cây thông màu nước</h1>
<p style="margin: 6px 0 0; font-size: 19px; line-height: 1.45">Tán và thân là ảnh vẽ sẵn (WebP, khoảng 40–70 KB mỗi lớp). Đèn và ngôi sao là lớp nhẹ chạy hiệu ứng riêng. Chạm vào cây để thấy cây rung và đèn loé sáng.</p>
</div>
<div style="display: flex; flex-direction: column; gap: 10px">${h2('Dáng tán')}${pills('shapeList', 4)}</div>
<div style="display: flex; flex-direction: column; gap: 10px">${h2('Màu tán: {{paletteName}}')}${sws('paletteList', 6)}</div>
<div style="display: flex; flex-direction: column; gap: 10px">${h2('Dáng thân')}${pills('trunkList', 3)}</div>
<div style="display: flex; flex-direction: column; gap: 10px">${h2('Màu gỗ: {{woodName}}')}${sws('woodList', 4)}</div>
</div>
</div>`;
const meta = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { name: v.name, c: v.base }]));
const script = `<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1120,"height":760}}'>
var SHAPES = ${JSON.stringify(meta(SHAPES))};
var PALS = ${JSON.stringify(meta(PALETTES))};
var TRUNKS = ${JSON.stringify(meta(TRUNK_SHAPES))};
var WOODS = ${JSON.stringify(meta(WOODS))};
var ON = 'background: #F6EBDD; color: #2C2633; border-color: #F6EBDD';
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { shape: 'cloud3', pal: 'teal', trunk: 'straight', wood: 'oak', shaking: false }; }
  componentWillUnmount() { clearTimeout(this.t); }
  renderVals() {
    var s = this.state, self = this, v = {};
    function pills(obj, key) { return Object.keys(obj).map(function (k) { var on = s[key] === k; return { name: obj[k].name, on: on ? 'true' : 'false', css: on ? ON : '', pick: function () { var o = {}; o[key] = k; self.setState(o); } }; }); }
    function sws(obj, key) { return Object.keys(obj).map(function (k) { var on = s[key] === k; return { name: obj[k].name, on: on ? 'true' : 'false', css: 'background: ' + obj[k].c + (on ? '; box-shadow: 0 0 0 4px #2C2633, 0 0 0 7px #F6EBDD' : ''), pick: function () { var o = {}; o[key] = k; self.setState(o); } }; }); }
    v.shapeList = pills(SHAPES, 'shape'); v.trunkList = pills(TRUNKS, 'trunk');
    v.paletteList = sws(PALS, 'pal'); v.woodList = sws(WOODS, 'wood');
    v.paletteName = PALS[s.pal].name; v.woodName = WOODS[s.wood].name;
    Object.keys(SHAPES).forEach(function (a) { v['sh_' + a] = s.shape === a; Object.keys(PALS).forEach(function (b) { v['cn_' + a + '_' + b] = s.shape === a && s.pal === b; }); });
    Object.keys(TRUNKS).forEach(function (a) { Object.keys(WOODS).forEach(function (b) { v['tk_' + a + '_' + b] = s.trunk === a && s.wood === b; }); });
    v.stageCls = s.shaking ? 'shake' : '';
    v.shakeTree = function () { clearTimeout(self.t); self.setState({ shaking: false }, function () { requestAnimationFrame(function () { self.setState({ shaking: true }); self.t = setTimeout(function () { self.setState({ shaking: false }); }, 1000); }); }); };
    return v;
  }
}
</script>`;
fs.writeFileSync(OUT + 'Main.dc.html', page('Cây thông màu nước – phối thử', body, script));

// Bảng tổng: mọi dáng tán × màu, mọi thân × màu gỗ
const cell = (src, label, w, h, crop) => `<figure style="margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px"><div style="width: ${w}px; height: ${h}px; border-radius: 22px; background: #4A4152; overflow: hidden; position: relative">${src}</div><figcaption style="font-family: 'Grape Nuts', cursive; font-size: 19px">${label}</figcaption></figure>`;
let grid = '';
for (const s of Object.keys(SHAPES)) {
  let row = '';
  for (const p of Object.keys(PALETTES)) row += cell(`<img src="${U[`trunk-straight-oak`]}" alt="" style="position: absolute; left: 0; top: 0; width: 200px; height: 300px"><img src="${U[`canopy-${s}-${p}`]}" alt="" style="position: absolute; left: 0; top: 0; width: 200px; height: 300px"><svg viewBox="0 0 400 600" width="200" height="300" style="position: absolute; left: 0; top: 0" aria-hidden="true">${lightsSource(s)}${starSource(s)}</svg>`, PALETTES[p].name, 200, 300);
  grid += `<section style="display: flex; flex-direction: column; gap: 12px"><h2 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 44px; line-height: 1; color: #FFD86B">${SHAPES[s].name}</h2><div style="display: flex; gap: 24px; flex-wrap: wrap">${row}</div></section>`;
}
let trow = '';
for (const t of Object.keys(TRUNK_SHAPES)) for (const w of Object.keys(WOODS))
  trow += cell(`<img src="${U[`trunk-${t}-${w}`]}" alt="" style="position: absolute; left: -60px; top: -310px; width: 280px; height: 420px">`, `${TRUNK_SHAPES[t].name} · ${WOODS[w].name}`, 160, 100);
const body2 = `<div style="width: 1480px; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 40px; background: #2C2633; font-family: 'Mynerve', cursive; color: #F6EBDD">
<header><h1 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 84px; line-height: 1; color: #FFD86B">Bộ cây thông màu nước</h1><p style="margin: 8px 0 0; font-size: 21px">4 dáng tán × 6 màu, 3 dáng thân × 4 màu gỗ. Mọi tổ hợp đều ghép được với nhau.</p></header>
${grid}
<section style="display: flex; flex-direction: column; gap: 12px"><h2 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 44px; line-height: 1; color: #FFD86B">Thân cây</h2><div style="display: flex; gap: 20px; flex-wrap: wrap">${trow}</div></section>
</div>`;
const script2 = `<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1480,"height":1900}}'>
class Component extends DCLogic { renderVals() { return {}; } }
</script>`;
fs.writeFileSync(OUT + 'Bo-cay-thong.dc.html', page('Bộ cây thông màu nước', body2, script2));
// canvas.json do người dùng sắp xếp trên canvas: không sửa tự động ở đây.
console.log('ok');
