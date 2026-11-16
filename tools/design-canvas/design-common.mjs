import { TREE_CSS } from './legacy/tree.js';
import { BACKGROUND_CSS } from './legacy/background.js';
import { PETS_CSS } from '../../packages/art/src/animated/pets.mjs';
import { PROPS_CSS } from './legacy/props.js';
import { ORNAMENTS_CSS } from '../../packages/art/src/animated/ornaments.mjs';
export const OUT = 'tools/design-canvas/boards/';
export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Grape+Nuts&family=Mynerve&display=swap" rel="stylesheet">`;
export const BASE_CSS = `
.no-face .tree-face{display:none}
.hide-tree .tree{display:none}
.pill{font:inherit;cursor:pointer;min-height:44px;padding:8px 18px;border-radius:999px;border:2.5px solid #3A2E2A;background:#FFFDF8;color:#3A2E2A;font-size:20px}
.pill:hover{background:#FFEFD2}
.scene{position:relative;padding:0;border:3px solid #3A2E2A;border-radius:32px;overflow:hidden;cursor:pointer;background:#FFF6E5;display:block}
`;
export function page(title, body, script, extraCss = '') {
  return `<!doctype html>
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
a{color:#2F7D5B}a:hover{color:#1F5A40}
${TREE_CSS}
${BACKGROUND_CSS}
${PETS_CSS}
${PROPS_CSS}
${ORNAMENTS_CSS}
${BASE_CSS}
${extraCss}
</style>
</helmet>
${body}
</x-dc>
${script}
</body>
</html>
`;
}
// Bảng gồm nhiều "cảnh" bấm được: mỗi cảnh bấm vào sẽ thêm class hiệu ứng trong ~1.6s.
export function scenesBoard({ title, heading, color = '#2F7D5B', intro, scenes, w, sceneW, sceneH, toggles = [] }) {
  const items = scenes.map((s, i) => `<figure style="margin: 0; display: flex; flex-direction: column; align-items: center; gap: 10px">
<button type="button" class="scene {{cls${i}}}" onClick="{{tap${i}}}" aria-label="${s.label}: chạm để xem hiệu ứng" style="width: ${s.w || sceneW}px; height: ${s.h || sceneH}px">
<svg viewBox="${s.viewBox || '0 0 400 600'}" width="${s.w || sceneW}" height="${s.h || sceneH}" aria-hidden="true">${s.svg}</svg>
</button>
<figcaption style="font-family: 'Grape Nuts', cursive; font-size: 24px; text-align: center; max-width: ${sceneW}px">${s.label}</figcaption>
${s.note ? `<p style="margin: 0; font-size: 17px; line-height: 1.35; text-align: center; max-width: ${sceneW}px; color: #6B5A52">${s.note}</p>` : ''}
</figure>`).join('\n');
  const toggleHtml = toggles.map((t) => `<div style="display: flex; align-items: center; gap: 10px"><span style="font-family: 'Grape Nuts', cursive; font-size: 22px">${t.label}</span>
<sc-for list="{{${t.key}List}}" as="it" hint-placeholder-count="2"><button type="button" class="pill" onClick="{{it.pick}}" aria-pressed="{{it.on}}" style="{{it.css}}">{{it.name}}</button></sc-for></div>`).join('');
  const body = `<div style="width: ${w}px; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 32px; background: #FFF6E5; font-family: 'Mynerve', cursive; color: #3A2E2A">
<header style="display: flex; flex-direction: column; gap: 10px">
<h1 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 80px; line-height: 1; color: ${color}">${heading}</h1>
<p style="margin: 0; font-size: 21px; line-height: 1.4; max-width: 980px">${intro}</p>
<div style="display: flex; gap: 32px; flex-wrap: wrap">${toggleHtml}</div>
</header>
<div style="display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start">
${items}
</div>
</div>`;
  const tg = JSON.stringify(toggles.map((t) => ({ key: t.key, cls: t.cls, options: t.options })));
  const script = `<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":900}}'>
var N = ${scenes.length};
var TOGGLES = ${tg};
var ON = 'background: #3A2E2A; color: #FFF6E5';
class Component extends DCLogic {
  constructor(p) { super(p); var st = { fx: {} }; TOGGLES.forEach(function (t) { st[t.key] = t.options[0][0]; }); this.state = st; this.timers = {}; }
  componentWillUnmount() { var t = this.timers; Object.keys(t).forEach(function (k) { clearTimeout(t[k]); }); }
  tap(i) {
    var self = this;
    clearTimeout(self.timers[i]);
    var off = Object.assign({}, self.state.fx); off[i] = false;
    self.setState({ fx: off }, function () {
      requestAnimationFrame(function () {
        var on = Object.assign({}, self.state.fx); on[i] = true; self.setState({ fx: on });
        self.timers[i] = setTimeout(function () { var o = Object.assign({}, self.state.fx); o[i] = false; self.setState({ fx: o }); }, 1700);
      });
    });
  }
  renderVals() {
    var s = this.state, self = this, v = {}, base = '';
    TOGGLES.forEach(function (t) {
      t.options.forEach(function (o) { if (s[t.key] === o[0] && o[2]) base += o[2] + ' '; });
      v[t.key + 'List'] = t.options.map(function (o) { var on = s[t.key] === o[0]; return { name: o[1], on: on ? 'true' : 'false', css: on ? ON : '', pick: function () { var x = {}; x[t.key] = o[0]; self.setState(x); } }; });
    });
    for (var i = 0; i < N; i++) { (function (i) { v['cls' + i] = base + (s.fx[i] ? 'gust shake pop' : ''); v['tap' + i] = function () { self.tap(i); }; })(i); }
    return v;
  }
}
</script>`;
  return page(title, body, script);
}
