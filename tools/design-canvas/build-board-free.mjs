// Bảng "Phòng tự do": chủ cây kéo thả, phóng to, lật, đổi kiểu, thêm/xoá đồ; bạn bè chạm cây để zoom và treo lời nhắn.
import * as R from '../../packages/art/src/room.mjs';
import { PALETTES, SHAPES, TRUNK_SHAPES, WOODS, lightsSource, starSource, TREE2_CSS } from '../../packages/art/src/tree.mjs';
import { layoutSlots, SLOT_COUNTS } from '../../packages/shared/src/slots.mjs';
import { ornamentSVGSoft as ornamentSVG, slotBubbleSVG, ORNAMENTS, ORNAMENTS_CSS } from '../../packages/art/src/animated/ornaments.mjs';
import { FONTS } from './design-common.mjs';
import { FIREPLACES2, fire2Overlay } from '../../packages/art/src/fireplaces.mjs';
import { petSVGSoft as petSVG, PETS, PETS_CSS } from '../../packages/art/src/animated/pets.mjs';
const PET_URL = { bear: '/_blob/2b76c961dea6fc20fa7cdc1249cbb570', cat: '/_blob/55b289b89fa60f0acf7da9487e96ca17', deer: '/_blob/16c793b557570daae09dcdab272c8993', dog: '/_blob/42a3cea91a2cfa53edd281b424020212', owl: '/_blob/5d84601341cce8b305e51ed5f196208a', penguin: '/_blob/a063c7b0bd77b5c49423946d28ab772b' };
const PK = 1.4;
import fs from 'fs';

const TU = JSON.parse(fs.readFileSync('tools/design-canvas/data/asset-urls.json'));
const IU = JSON.parse(fs.readFileSync('tools/design-canvas/data/item-urls.json'));
const M = JSON.parse(fs.readFileSync('tools/design-canvas/data/items-meta.json'));
const OUT = 'tools/design-canvas/boards/';
const VS = 0.6, VW = 432, VH = 648, TS = R.TREE_POS.scale;

const v = (prefix, key, name) => ({ name, src: IU[`${prefix}-${key}`], ...M[`${prefix}-${key}`] });
const CATALOG = {
  tree: { name: 'Cây thông', layer: 'floor', variants: { main: { name: 'Cây thông', w: 480, h: 720, ax: 240, ay: 538 * TS } } },
  fireplace: { name: 'Lò sưởi', layer: 'floor', overlay: 'fire', variants: Object.fromEntries(Object.entries(FIREPLACES2).map(([k, o]) => [k, v('fp2', k, o.name)])) },
  window: { name: 'Cửa sổ', layer: 'wall', overlay: 'snow', variants: Object.fromEntries(Object.entries(R.WINDOWS).map(([k, o]) => [k, v('window', k, o.name)])) },
  rug: { name: 'Thảm', layer: 'rug', variants: { plaid: v('rug', 'plaid', 'Thảm kẻ đỏ'), knit: v('rug', 'knit', 'Thảm len kem') } },
  stack: { name: 'Chồng quà', layer: 'floor', fx: 'hop', variants: { warm: v('stack', 'warm', 'Chồng quà đỏ xanh'), pastel: v('stack', 'pastel', 'Chồng quà pastel') } },
  gift: { name: 'Hộp quà', layer: 'floor', fx: 'hop', variants: Object.fromEntries(Object.entries(R.GIFT_SINGLES).map(([k, o]) => [k, v('gift', k, o.name)])) },
  pet: { name: 'Thú cưng', layer: 'floor', fx: 'pop', variants: Object.fromEntries(Object.entries(PETS).map(([k, o]) => [k, { name: o.name, src: PET_URL[k], w: 140 * PK, h: 195 * PK, ax: 70 * PK, ay: 180 * PK }])) },
};
const tail = M['cat-grey-tail'], catM = M['cat-grey'];
const TAIL = { src: IU['cat-grey-tail'], dx: tail.left - catM.left, dy: tail.top - catM.top, w: tail.w, h: tail.h, ox: 26, oy: tail.h * 0.5 };
const BGS = Object.fromEntries(Object.entries(R.ROOMS).map(([k, o]) => [k, { name: o.name, src: IU['bg-' + k] }]));
const SPR = (k) => M[k];

// ---- lớp phủ động theo từng loại đồ, vẽ trong toạ độ căn phòng gốc của ảnh ----
const ovl = (metaKey, inner) => { const m = SPR(metaKey); return `<svg viewBox="${m.left} ${m.top} ${m.w} ${m.h}" width="100%" height="100%" style="position: absolute; left: 0; top: 0; overflow: visible" preserveAspectRatio="none" aria-hidden="true">${inner}</svg>`; };
const fireOv = Object.keys(FIREPLACES2).map((k) => `<sc-if value="{{it.fire_${k}}}" hint-placeholder-val="{{false}}">${ovl('fp2-' + k, fire2Overlay(k))}</sc-if>`).join('');
const snowOv = Object.keys(R.WINDOWS).map((k) => `<sc-if value="{{it.win_${k}}}" hint-placeholder-val="{{false}}">${ovl('window-' + k, R.windowSnowOverlay())}</sc-if>`).join('');


let treeInner = '';
for (const t of Object.keys(TRUNK_SHAPES)) for (const w of Object.keys(WOODS)) treeInner += `<sc-if value="{{it.tk_${t}_${w}}}" hint-placeholder-val="{{false}}"><img src="${TU[`trunk-${t}-${w}`]}" alt="" draggable="false" class="fill"></sc-if>`;
let canopy = '';
for (const s of Object.keys(SHAPES)) {
  for (const p of Object.keys(PALETTES)) canopy += `<sc-if value="{{it.cn_${s}_${p}}}" hint-placeholder-val="{{false}}"><img src="${TU[`canopy-${s}-${p}`]}" alt="" draggable="false" class="fill"></sc-if>`;
  canopy += `<sc-if value="{{it.sh_${s}}}" hint-placeholder-val="{{false}}"><svg viewBox="0 0 400 600" width="100%" height="100%" class="fill" style="overflow: visible" aria-hidden="true">${lightsSource(s)}${starSource(s)}</svg></sc-if>`;
}
treeInner += `<div class="sway2 fill">${canopy}</div>`;

const itemTpl = `<sc-for list="{{items}}" as="it" hint-placeholder-count="7">
<div class="item {{it.cls}}" onPointerDown="{{it.down}}" aria-label="{{it.label}}" style="left: {{it.left}}px; top: {{it.top}}px; width: {{it.w}}px; height: {{it.h}}px; z-index: {{it.z}}">
<div class="flip {{it.flipCls}}">
<sc-if value="{{it.isTree}}" hint-placeholder-val="{{false}}">${treeInner}</sc-if>
${Object.keys(PETS).map((k) => `<sc-if value="{{it.pet_${k}}}" hint-placeholder-val="{{false}}"><svg viewBox="-70 -180 140 195" class="fill" style="overflow: visible" aria-hidden="true">${petSVG(k)}</svg></sc-if>`).join('')}
<sc-if value="{{it.isPlain}}" hint-placeholder-val="{{true}}"><div class="hop fill"><img src="{{it.src}}" alt="" draggable="false" class="fill"></div></sc-if>
${fireOv}${snowOv}
</div>
<sc-if value="{{it.sel}}" hint-placeholder-val="{{false}}"><div class="sel-ring"></div></sc-if>
<sc-if value="{{it.hasBurst}}" hint-placeholder-val="{{false}}"><div class="burst" style="top: {{it.burstTop}}"><sc-for list="{{it.parts}}" as="pt" hint-placeholder-count="12"><span class="pt {{pt.cls}}" style="--dx: {{pt.dx}}px; --dy: {{pt.dy}}px; --r: {{pt.r}}deg; --d: {{pt.d}}s; --c: {{pt.c}}">
<sc-if value="{{pt.heart}}" hint-placeholder-val="{{false}}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21l-8.5-8.2C1 10.4 1.4 6.2 4.8 5.2 7.2 4.5 9.6 5.6 12 8c2.4-2.4 4.8-3.5 7.2-2.8 3.4 1 3.8 5.2 1.3 7.6z" fill="var(--c)" stroke="#3A2E2A" stroke-width="1.2"/></svg></sc-if>
<sc-if value="{{pt.star}}" hint-placeholder-val="{{false}}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" fill="var(--c)" stroke="#8A6A1A" stroke-width="1"/></svg></sc-if>
<sc-if value="{{pt.spark}}" hint-placeholder-val="{{false}}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill="var(--c)"/></svg></sc-if>
<sc-if value="{{pt.note}}" hint-placeholder-val="{{false}}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18a3 3 0 11-2-2.8V4l12-2v12a3 3 0 11-2-2.8V6.3L9 7.8z" fill="var(--c)"/></svg></sc-if>
</span></sc-for></div></sc-if>
<sc-if value="{{it.hasSay}}" hint-placeholder-val="{{false}}"><div class="say">{{it.say}}</div></sc-if>
</div>
</sc-for>`;

const kinds = Object.keys(ORNAMENTS);
const ornIfs = kinds.map((k) => `<sc-if value="{{sl.k_${k}}}" hint-placeholder-val="{{false}}"><svg viewBox="-30 -6 60 60" width="{{sl.w}}" height="{{sl.w}}" aria-hidden="true" style="display: block">${ornamentSVG(k, 'filled', null)}</svg></sc-if>`).join('');
const bubbleIf = `<sc-if value="{{sl.empty}}" hint-placeholder-val="{{true}}"><svg viewBox="-30 -6 60 60" width="{{sl.w}}" height="{{sl.w}}" aria-hidden="true" style="display: block">${slotBubbleSVG(null)}</svg></sc-if>`;
const layouts = {};
for (const s of Object.keys(SHAPES)) for (const n of SLOT_COUNTS) { const L = layoutSlots(s, n); layouts[s + '|' + n] = { s: L.scale, p: L.slots.map((p) => [p.x, p.y]) }; }

const ORN_PICK = kinds.map((k) => `<sc-if value="{{o.k_${k}}}" hint-placeholder-val="{{false}}"><svg viewBox="-30 -6 60 60" width="46" height="46" aria-hidden="true">${ornamentSVG(k, 'filled', null)}</svg></sc-if>`).join('');
const COMPOSE_UI = `<sc-if value="{{composeOpen}}" hint-placeholder-val="{{false}}"><div class="sheet compose" role="dialog" aria-label="{{composeTitle}}">
<div class="sheet-head"><div class="sheet-title">{{composeTitle}}</div><button type="button" class="chip" onClick="{{composeCancel}}">Huỷ</button></div>
<div class="sheet-body">
<div class="lab">Chọn phụ kiện để treo</div>
<div class="row"><sc-for list="{{ornChoices}}" as="o" hint-placeholder-count="8"><button type="button" class="orn-pick" onClick="{{o.pick}}" aria-pressed="{{o.on}}" aria-label="{{o.name}}" title="{{o.name}}" style="{{o.css}}">${ORN_PICK}</button></sc-for></div>
<div class="lab">Người gửi</div>
<div class="row"><sc-for list="{{anonChoices}}" as="o" hint-placeholder-count="2"><button type="button" class="chip" onClick="{{o.pick}}" aria-pressed="{{o.on}}" style="{{o.css}}">{{o.label}}</button></sc-for></div>
<sc-if value="{{showName}}" hint-placeholder-val="{{true}}"><label class="field"><span class="sr">Tên của bạn</span><input type="text" maxlength="30" placeholder="Tên của bạn" value="{{composeName}}" onChange="{{setName}}"></label></sc-if>
<label class="field"><span class="lab">Lời nhắn <span class="count">{{composeCount}}/300</span></span><textarea maxlength="300" rows="4" placeholder="Viết lời chúc Giáng sinh của bạn..." value="{{composeText}}" onChange="{{setText}}"></textarea></label>
<sc-if value="{{composeHint}}" hint-placeholder-val="{{false}}"><div class="note">{{composeHintText}}</div></sc-if>
<div class="row" style="justify-content: flex-end">
<sc-if value="{{composeEditing}}" hint-placeholder-val="{{false}}"><button type="button" class="chip" onClick="{{composeDelete}}">Xoá lời nhắn</button></sc-if>
<button type="button" class="primary" onClick="{{composeSubmit}}" aria-disabled="{{composeDisabled}}" style="{{composeBtnCss}}">{{composeBtn}}</button>
</div>
</div>
</div></sc-if>
<sc-if value="{{hasToast2}}" hint-placeholder-val="{{false}}"><div class="toast2">{{toast2}}</div></sc-if>`;
const chips = (list, n, cls = 'chip') => `<div class="row"><sc-for list="{{${list}}}" as="o" hint-placeholder-count="${n}"><button type="button" class="${cls}" onClick="{{o.pick}}" aria-pressed="{{o.on}}" aria-label="{{o.name}}" title="{{o.name}}" style="{{o.css}}">{{o.label}}</button></sc-for></div>`;
const thumbs = (list, n) => `<div class="row"><sc-for list="{{${list}}}" as="o" hint-placeholder-count="${n}"><button type="button" class="thumb" onClick="{{o.pick}}" aria-label="{{o.name}}" title="{{o.name}}" style="{{o.css}}"><img src="{{o.src}}" alt="" draggable="false"></button></sc-for></div>`;
const lab = (t) => `<div class="lab">${t}</div>`;
const icon = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const optBtn = (list, n) => `<sc-for list="{{${list}}}" as="o" hint-placeholder-count="${n}"><button type="button" class="opt {{o.cls}}" onClick="{{o.pick}}" aria-pressed="{{o.on}}" aria-label="{{o.name}}" title="{{o.name}}" style="{{o.css}}"><sc-if value="{{o.isImg}}" hint-placeholder-val="{{false}}"><img src="{{o.src}}" alt="" draggable="false"></sc-if><sc-if value="{{o.isLabel}}" hint-placeholder-val="{{true}}"><span>{{o.label}}</span></sc-if></button></sc-for>`;
const treePanel = `${lab('Dáng tán')}<div class="grid">${optBtn('pShape', 4)}</div>${lab('Màu tán')}<div class="grid">${optBtn('pPal', 6)}</div>${lab('Dáng thân')}<div class="grid">${optBtn('pTrunk', 3)}</div>${lab('Màu gỗ')}<div class="grid">${optBtn('pWood', 4)}</div>${lab('Số điểm nhắn')}<div class="grid">${optBtn('pCount', 7)}</div>`;
const body = `<div style="width: 1180px; height: 920px; box-sizing: border-box; padding: 32px 40px; display: flex; flex-direction: column; gap: 18px; background: #2C2633; font-family: 'Mynerve', cursive; color: #F6EBDD">
<div style="display: flex; align-items: flex-end; gap: 32px; flex-wrap: wrap">
<div style="flex: 1; min-width: 320px"><h1 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 64px; line-height: 1; color: #FFD86B">Phòng tự do</h1>
<p style="margin: 4px 0 0; font-size: 18px; line-height: 1.4">Bấm Play để thử. Đổi "Xem trên" để so sánh bố cục điện thoại và máy tính.</p></div>
<div style="display: flex; flex-direction: column; gap: 6px">${lab('Vai trò')}${chips('roleList', 2)}</div>
<div style="display: flex; flex-direction: column; gap: 6px">${lab('Xem trên')}${chips('deviceList', 2)}</div>
</div>
<div class="stage {{stageCls}}">
<sc-if value="{{isDesktop}}" hint-placeholder-val="{{false}}"><div class="browserbar"><span></span><span></span><span></span><div class="url">caythongloinhan.vn/c/k7m2xq4a</div></div></sc-if>
<div class="stage-row">
<sc-if value="{{deskOwner}}" hint-placeholder-val="{{false}}"><aside class="panel" aria-label="Đồ trong phòng">
<div class="panel-title">Thêm đồ vào phòng</div>
<sc-for list="{{addGroups}}" as="g" hint-placeholder-count="5"><div class="lab">{{g.name}}</div><div class="grid"><sc-for list="{{g.items}}" as="o" hint-placeholder-count="3"><button type="button" class="opt img" onClick="{{o.pick}}" aria-label="Thêm {{o.name}}" title="{{o.name}}"><img src="{{o.src}}" alt="" draggable="false"></button></sc-for></div></sc-for>
<div class="panel-title" style="margin-top: 10px">Phông nền</div>
<div class="grid">${optBtn('bgOpts', 9)}</div>
</aside></sc-if>
<div class="phone {{phoneCls}}" onPointerMove="{{move}}" onPointerUp="{{up}}" onPointerLeave="{{up}}" onPointerCancel="{{up}}" style="position: relative; width: ${VW}px; height: ${VH}px; overflow: hidden; background: #1A1420; touch-action: none; flex: none">
<div class="world {{worldCls}}" style="position: absolute; left: 0; top: 0; width: 720px; height: 1080px; transform-origin: 0 0; transform: {{worldT}}">
<div class="fill" onPointerDown="{{bgDown}}"><img src="{{bgSrc}}" alt="" draggable="false" class="fill"></div>
${itemTpl}
<sc-if value="{{showArrows}}" hint-placeholder-val="{{false}}">
<button type="button" class="arrow" onPointerDown="{{stop}}" onClick="{{prevVariant}}" aria-label="Kiểu trước" style="left: {{arrL}}px; top: {{arrT}}px; transform: scale({{arrInv}})">${icon('M15 5l-7 7 7 7')}</button>
<button type="button" class="arrow" onPointerDown="{{stop}}" onClick="{{nextVariant}}" aria-label="Kiểu tiếp theo" style="left: {{arrR}}px; top: {{arrT}}px; transform: scale({{arrInv}})">${icon('M9 5l7 7-7 7')}</button>
<div class="vlabel" style="left: {{labX}}px; top: {{labY}}px; transform: translateX(-50%) scale({{arrInv}})">{{vLabel}}</div>
</sc-if>
<sc-if value="{{zoomed}}" hint-placeholder-val="{{false}}"><div class="slots-layer fill">
<sc-for list="{{slots}}" as="sl" hint-placeholder-count="12"><button type="button" class="slot2 {{sl.cls}}" onClick="{{sl.tap}}" aria-label="{{sl.label}}" style="left: {{sl.left}}px; top: {{sl.top}}px; width: {{sl.w}}px; height: {{sl.w}}px">${bubbleIf}${ornIfs}</button></sc-for>
</div></sc-if>
</div>
<sc-if value="{{showHint}}" hint-placeholder-val="{{false}}"><div class="hint"><span>Chạm vào cây thông để treo lời nhắn</span></div></sc-if>
<sc-if value="{{zoomedIdle}}" hint-placeholder-val="{{false}}"><button type="button" class="back" onClick="{{zoomOut}}">${icon('M15 5l-7 7 7 7')}<span>Về căn phòng</span></button><div class="toast">{{toast}}</div></sc-if>
<sc-if value="{{phoneOwner}}" hint-placeholder-val="{{true}}">
<sc-if value="{{showTopbar}}" hint-placeholder-val="{{true}}"><div class="topbar"><button type="button" class="pillbtn" onClick="{{openAdd}}">${icon('M12 5v14M5 12h14')}<span>Thêm đồ</span></button><button type="button" class="pillbtn" onClick="{{openBg}}">${icon('M4 20h16M6 16V6h12v10')}<span>Phông nền</span></button></div></sc-if>
<sc-if value="{{showToolbar}}" hint-placeholder-val="{{false}}"><div class="toolbar" role="toolbar" aria-label="Chỉnh món đang chọn">
<div class="tb-name">{{selName}}</div>
<button type="button" class="tb" onClick="{{smaller}}" aria-label="Nhỏ hơn">${icon('M5 12h14')}</button>
<button type="button" class="tb" onClick="{{bigger}}" aria-label="To hơn">${icon('M12 5v14M5 12h14')}</button>
<button type="button" class="tb" onClick="{{flip}}" aria-label="Lật ngang">${icon('M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5')}</button>
<button type="button" class="tb wide" onClick="{{openStyle}}">Đổi kiểu</button>
<sc-if value="{{canDelete}}" hint-placeholder-val="{{true}}"><button type="button" class="tb" onClick="{{remove}}" aria-label="Xoá">${icon('M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13')}</button></sc-if>
</div></sc-if>
<sc-if value="{{noSelHint}}" hint-placeholder-val="{{true}}"><div class="toast" style="bottom: 18px">Kéo để di chuyển, chạm một món để chỉnh</div></sc-if>
<sc-if value="{{stripOpen}}" hint-placeholder-val="{{false}}"><div class="strip" role="dialog" aria-label="{{stripTitle}}">
<div class="strip-head"><span class="strip-title">{{stripTitle}}</span><button type="button" class="chip sm" onClick="{{closeStrip}}" style="background: #F6EBDD; color: #2C2633">Xong</button></div>
<sc-if value="{{stripTabs}}" hint-placeholder-val="{{false}}"><div class="strip-tabs">${optBtn('tabList', 5)}</div></sc-if>
<div class="strip-row">${optBtn('stripOpts', 6)}</div>
</div></sc-if>
<sc-if value="{{sheetAdd}}" hint-placeholder-val="{{false}}"><div class="sheet" role="dialog" aria-label="Thêm đồ vào phòng">
<div class="sheet-head"><div class="sheet-title">Thêm đồ vào phòng</div><button type="button" class="chip" onClick="{{closeSheet}}" style="background: #F6EBDD; color: #2C2633">Xong</button></div>
<div class="sheet-body"><sc-for list="{{addGroups}}" as="g" hint-placeholder-count="5"><div class="lab">{{g.name}}</div><div class="strip-row wrap"><sc-for list="{{g.items}}" as="o" hint-placeholder-count="3"><button type="button" class="opt img" onClick="{{o.pick}}" aria-label="Thêm {{o.name}}" title="{{o.name}}"><img src="{{o.src}}" alt="" draggable="false"></button></sc-for></div></sc-for></div>
</div></sc-if>
</sc-if>
${COMPOSE_UI}
</div>
<sc-if value="{{deskOwner}}" hint-placeholder-val="{{false}}"><aside class="panel" aria-label="Món đang chọn">
<sc-if value="{{hasSel}}" hint-placeholder-val="{{false}}">
<div class="panel-title">{{selName}}</div>
<div class="row" style="align-items: center"><button type="button" class="tb" onClick="{{smaller}}" aria-label="Nhỏ hơn">${icon('M5 12h14')}</button><span class="sizeval">{{sizePct}}</span><button type="button" class="tb" onClick="{{bigger}}" aria-label="To hơn">${icon('M12 5v14M5 12h14')}</button><button type="button" class="tb" onClick="{{flip}}" aria-label="Lật ngang">${icon('M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5')}</button><sc-if value="{{canDelete}}" hint-placeholder-val="{{true}}"><button type="button" class="tb" onClick="{{remove}}" aria-label="Xoá">${icon('M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13')}</button></sc-if></div>
<sc-if value="{{selIsTree}}" hint-placeholder-val="{{false}}">${treePanel}</sc-if>
<sc-if value="{{selNotTree}}" hint-placeholder-val="{{true}}">${lab('Kiểu dáng')}<div class="grid">${optBtn('pVariants', 6)}</div></sc-if>
</sc-if>
<sc-if value="{{noSel}}" hint-placeholder-val="{{true}}"><div class="panel-title">Món đang chọn</div><p class="panel-note">Chạm một món trong phòng để chỉnh. Kéo để di chuyển, dùng mũi tên hai bên món để đổi kiểu nhanh.</p></sc-if>
</aside></sc-if>
<sc-if value="{{isPhone}}" hint-placeholder-val="{{true}}"><div class="desc">
<p><b>Chủ cây trên điện thoại (phương án C):</b> chạm một món thì hai bên hiện mũi tên ‹ › để đổi kiểu ngay tại chỗ, kèm tên kiểu bên dưới. Bấm "Đổi kiểu" để mở dải chọn mỏng ở đáy: camera tự dời và phóng để món đang sửa nằm giữa phần màn hình còn lại, chạm kiểu nào đổi ngay. Cây thông có thêm tab Dáng · Màu · Thân · Gỗ · Điểm nhắn.</p>
<p><b>Trên máy tính:</b> đổi "Xem trên" sang Máy tính. Bên trái là khay đồ và phông nền, bên phải là bảng chỉnh món đang chọn, không còn khung che phòng.</p>
<p><b>Bạn bè mở link:</b> chạm cây để zoom, chạm bong bóng + để viết lời nhắn và chọn 1 trong 20 phụ kiện treo.</p>
</div></sc-if>
</div>
</div>
</div>`;

const css = `
${TREE2_CSS}
${R.ROOM_CSS}
${ORNAMENTS_CSS}
${PETS_CSS}
.fill{position:absolute;left:0;top:0;width:100%;height:100%}
img{user-select:none;-webkit-user-drag:none;pointer-events:none}
.item{position:absolute;cursor:grab;touch-action:none;outline:none}
.item:focus-visible .sel-ring,.item .sel-ring{position:absolute;inset:-8px;border:4px dashed #FFE9A8;border-radius:18px;pointer-events:none;box-shadow:0 0 0 3px rgba(23,18,27,.35)}
.dragging{cursor:grabbing}
.flip{position:absolute;inset:0}
.flip.flipped{transform:scaleX(-1)}
.cat-tail2{position:absolute;animation:catt 2.6s ease-in-out infinite}
.cat-breath2{transform-origin:50% 85%;animation:catb 3.4s ease-in-out infinite}
.fx-cat .cat-breath2{animation:cathop .6s cubic-bezier(.3,1.6,.5,1)}
.fx-cat .cat-tail2{animation:catt .2s ease-in-out 6}
.hop{transform-origin:50% 100%}
.fx-hop .hop{animation:gb .7s cubic-bezier(.3,1.6,.5,1)}
.world.dragmode{transition:none}
.hint{position:absolute;left:50%;top:18px;transform:translateX(-50%);padding:10px 16px;border-radius:999px;background:rgba(255,246,229,.94);color:#3A2E2A;font-size:17px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.3)}
.back{position:absolute;left:14px;top:14px;display:flex;align-items:center;gap:4px;min-height:44px;padding:6px 14px 6px 8px;border:0;border-radius:999px;background:#FFF6E5;color:#3A2E2A;font:inherit;font-size:17px;cursor:pointer}
.toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:rgba(23,18,27,.78);color:#FFF6E5;font-size:15px;white-space:nowrap;pointer-events:none}
.topbar{position:absolute;left:12px;right:12px;top:12px;display:flex;gap:8px;justify-content:flex-end}
.pillbtn{display:flex;align-items:center;gap:6px;min-height:44px;padding:6px 14px;border:0;border-radius:999px;background:rgba(255,246,229,.95);color:#3A2E2A;font:inherit;font-size:16px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3)}
.toolbar{position:absolute;left:10px;right:10px;bottom:12px;display:flex;align-items:center;gap:6px;padding:8px;border-radius:22px;background:rgba(36,29,42,.95);box-shadow:0 8px 24px rgba(0,0,0,.4)}
.tb-name{flex:1;min-width:0;font-family:'Grape Nuts',cursive;font-size:17px;color:#FFD86B;padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb{min-width:44px;height:44px;border:0;border-radius:14px;background:#3E3448;color:#F6EBDD;font:inherit;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.tb.wide{padding:0 10px}
.sheet{position:absolute;left:0;right:0;bottom:0;max-height:62%;display:flex;flex-direction:column;border-radius:26px 26px 0 0;background:rgba(36,29,42,.97);box-shadow:0 -10px 30px rgba(0,0,0,.4);animation:sheetin .35s cubic-bezier(.2,.9,.3,1)}
@keyframes sheetin{from{transform:translateY(100%)}to{transform:translateY(0)}}
.sheet-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 6px}
.sheet-title{font-family:'Amatic SC',cursive;font-size:34px;color:#FFD86B;line-height:1}
.sheet-body{overflow-y:auto;padding:4px 16px 18px;display:flex;flex-direction:column;gap:8px}
.lab{font-family:'Grape Nuts',cursive;font-size:17px;color:#F3D9A4}
.row{display:flex;flex-wrap:wrap;gap:8px}
.chip{font:inherit;cursor:pointer;min-height:44px;padding:6px 14px;border-radius:999px;border:2px solid #6A5C74;background:transparent;color:#F6EBDD;font-size:16px}
.sw2{cursor:pointer;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.45);padding:0;font-size:0}
.thumb{width:76px;height:76px;padding:6px;border-radius:16px;border:2px solid #4E4258;background:#3A3044;cursor:pointer;display:flex;align-items:center;justify-content:center}
.thumb img{max-width:100%;max-height:100%;object-fit:contain}
.burst{position:absolute;left:50%;width:0;height:0;pointer-events:none;z-index:5}
.pt{position:absolute;left:-14px;top:-14px;width:28px;height:28px;opacity:0;animation:pt 1.3s cubic-bezier(.15,.7,.3,1) forwards;animation-delay:var(--d)}
.pt svg{width:100%;height:100%;display:block}
.pt.confetti{width:12px;height:20px;border-radius:3px;background:var(--c)}
.pt.snow{width:14px;height:14px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px rgba(88,121,138,.3)}
.pt.spark{width:30px;height:30px}
@keyframes pt{0%{transform:translate(0,0) scale(.2) rotate(0);opacity:0}12%{opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(var(--r));opacity:0}}
.say{position:absolute;left:50%;bottom:100%;margin-bottom:6px;padding:10px 20px;border-radius:24px;background:#FFF6E5;color:#3A2E2A;font-size:32px;white-space:nowrap;box-shadow:0 6px 14px rgba(0,0,0,.3);z-index:6;pointer-events:none;animation:say 1.7s ease-out forwards}
.say::after{content:'';position:absolute;left:50%;top:100%;margin-left:-10px;border:10px solid transparent;border-top-color:#FFF6E5}
@keyframes say{0%{opacity:0;transform:translate(-50%,12px) scale(.6)}14%{opacity:1;transform:translate(-50%,0) scale(1.06)}24%{transform:translate(-50%,0) scale(1)}80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-14px)}}
.g-hop .hop{animation:ghop .8s cubic-bezier(.3,1.4,.5,1)}
@keyframes ghop{0%{transform:none}20%{transform:scale(1.08,.9)}50%{transform:translateY(-40px) scale(.95,1.06)}80%{transform:translateY(0) scale(1.05,.95)}100%{transform:none}}
.g-shake .hop{animation:gshake 1s ease-in-out}
@keyframes gshake{0%,100%{transform:rotate(0)}10%,50%,90%{transform:rotate(-7deg)}30%,70%{transform:rotate(7deg)}}
.g-spin .hop{animation:gspin 1s ease-in-out}
@keyframes gspin{0%{transform:none}45%{transform:translateY(-60px) rotate(180deg)}85%{transform:translateY(0) rotate(360deg) scale(1.06,.94)}100%{transform:rotate(360deg)}}
.g-squash .hop{animation:gsq .7s ease-in-out}
@keyframes gsq{0%,100%{transform:none}30%{transform:scale(1.25,.7)}60%{transform:scale(.88,1.18)}}
.g-pop .hop{animation:gpop .6s cubic-bezier(.3,1.6,.5,1)}
@keyframes gpop{0%{transform:none}35%{transform:scale(1.25)}65%{transform:scale(.92)}100%{transform:none}}
.g-wobble .hop{animation:gwob .9s ease-in-out}
@keyframes gwob{0%,100%{transform:skewX(0)}20%{transform:skewX(-14deg) scaleY(.95)}40%{transform:skewX(11deg)}60%{transform:skewX(-6deg)}80%{transform:skewX(3deg)}}
.p-spin .pet{transform-origin:50% 60%;animation:pspin .95s ease-in-out}
@keyframes pspin{0%{transform:none}50%{transform:translateY(-30px) rotate(180deg)}100%{transform:rotate(360deg)}}
.p-dance .pet{animation:pdance 1.3s ease-in-out}
@keyframes pdance{0%,100%{transform:rotate(0)}12%{transform:rotate(-12deg) translateY(-8px)}25%{transform:rotate(12deg)}37%{transform:rotate(-12deg) translateY(-8px)}50%{transform:rotate(12deg)}62%{transform:rotate(-8deg) translateY(-6px)}75%{transform:rotate(6deg)}}
.p-talk .pet .head{animation:ptalk .24s ease-in-out 6}
@keyframes ptalk{50%{transform:rotate(-7deg) translateY(-4px)}}
.p-sleep .pet .eyes{animation:none;transform:scaleY(.12)}
.p-sleep .pet{animation:psleep 1.7s ease-in-out}
@keyframes psleep{0%,100%{transform:none}50%{transform:scale(1.05,.93)}}
.p-jump .pet{animation:pjump .85s cubic-bezier(.3,1.5,.5,1)}
@keyframes pjump{0%{transform:none}25%{transform:scale(1.12,.84)}55%{transform:translateY(-70px) scale(.92,1.1)}85%{transform:translateY(0) scale(1.06,.94)}100%{transform:none}}
.compose{max-height:86%}
.stage{flex:1;min-height:0;display:flex;flex-direction:column;align-items:flex-start}
.stage-row{display:flex;gap:32px;align-items:flex-start}
.stage.phone-mode .phone{border-radius:36px;box-shadow:0 0 0 10px #17121B,0 20px 50px rgba(0,0,0,.45);margin:10px}
.stage.desk-mode{align-items:stretch;background:#1E1923;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.45);overflow:hidden}
.stage.desk-mode .stage-row{gap:0;justify-content:center;background:#241D2A;height:${VH}px}
.stage.desk-mode .phone{border-radius:0}
.browserbar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#17121B}
.browserbar span{width:12px;height:12px;border-radius:50%;background:#4E4258}
.browserbar .url{margin-left:12px;flex:1;max-width:420px;padding:5px 12px;border-radius:8px;background:#2C2633;color:#B9AEC2;font-family:system-ui,sans-serif;font-size:13px}
.panel{width:280px;height:${VH}px;box-sizing:border-box;padding:16px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;background:#2C2633;border-left:1px solid #3A3044;border-right:1px solid #3A3044}
.panel-title{font-family:'Amatic SC',cursive;font-size:32px;line-height:1;color:#FFD86B}
.panel-note{margin:0;font-size:16px;line-height:1.45;color:#B9AEC2}
.sizeval{min-width:52px;text-align:center;font-size:16px;color:#E9DCCB}
.grid{display:flex;flex-wrap:wrap;gap:8px}
.desc{width:560px;font-size:17px;line-height:1.5;color:#E9DCCB}
.desc p{margin:0 0 12px}.desc b{color:#FFD86B}
.opt{flex:none;min-height:44px;min-width:44px;padding:6px 12px;border-radius:14px;border:2px solid #4E4258;background:#3A3044;color:#F6EBDD;font:inherit;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.opt.img{width:72px;height:72px;padding:5px}
.opt.img img{max-width:100%;max-height:100%;object-fit:contain}
.opt.sw{width:44px;height:44px;padding:0;border-radius:50%}
.opt.tab{min-height:36px;padding:4px 12px;border-radius:999px;font-size:14px}
.opt[aria-pressed="true"]{border-color:#FFD86B;box-shadow:0 0 0 2px rgba(255,216,107,.35)}
.arrow{position:absolute;width:76px;height:76px;border-radius:50%;border:0;background:rgba(255,246,229,.95);color:#3A2E2A;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.35);z-index:900;transform-origin:center}
.arrow svg{width:40px;height:40px}
.vlabel{position:absolute;padding:8px 16px;border-radius:999px;background:rgba(23,18,27,.82);color:#FFF6E5;font-size:26px;white-space:nowrap;z-index:900;pointer-events:none;transform-origin:top center}
.strip{position:absolute;left:0;right:0;bottom:0;padding:10px 0 12px;border-radius:22px 22px 0 0;background:rgba(36,29,42,.97);box-shadow:0 -8px 24px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:8px;animation:sheetin .3s cubic-bezier(.2,.9,.3,1)}
.strip-head{display:flex;justify-content:space-between;align-items:center;padding:0 14px}
.strip-title{font-family:'Grape Nuts',cursive;font-size:18px;color:#FFD86B}
.chip.sm{min-height:36px;padding:4px 14px;font-size:15px}
.strip-tabs,.strip-row{display:flex;gap:8px;overflow-x:auto;padding:2px 14px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent);mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent)}
.strip-tabs::-webkit-scrollbar,.strip-row::-webkit-scrollbar{display:none}
.strip-row.wrap{flex-wrap:wrap;overflow:visible;-webkit-mask-image:none;mask-image:none;padding:0}
.sheet-body,.panel{scrollbar-width:thin;scrollbar-color:#6A5C74 transparent}
.sheet-body::-webkit-scrollbar,.panel::-webkit-scrollbar{width:8px}
.sheet-body::-webkit-scrollbar-track,.panel::-webkit-scrollbar-track{background:transparent}
.sheet-body::-webkit-scrollbar-thumb,.panel::-webkit-scrollbar-thumb{background:#6A5C74;border-radius:8px;border:2px solid transparent;background-clip:padding-box}
.sheet-body::-webkit-scrollbar-thumb:hover,.panel::-webkit-scrollbar-thumb:hover{background:#8C7CA0;background-clip:padding-box}
.world{transition:transform .8s cubic-bezier(.65,0,.35,1)}
.orn-pick{width:58px;height:58px;padding:4px;border-radius:16px;border:2px solid #4E4258;background:#3A3044;cursor:pointer;display:flex;align-items:center;justify-content:center}
.field{display:flex;flex-direction:column;gap:6px}
.field input,.field textarea{font:inherit;font-family:'Mynerve',cursive;font-size:18px;color:#3A2E2A;background:#FFF6E5;border:2px solid #E9DCCB;border-radius:14px;padding:10px 12px;resize:none;outline:none}
.field input:focus,.field textarea:focus{border-color:#FFD86B}
.count{font-family:'Mynerve',cursive;font-size:14px;color:#B9AEC2;margin-left:6px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.note{font-size:15px;line-height:1.4;color:#E9DCCB;background:rgba(255,216,107,.12);border-radius:12px;padding:8px 10px}
.primary{font:inherit;cursor:pointer;min-height:46px;padding:8px 20px;border-radius:999px;border:0;background:#FFD86B;color:#2C2633;font-size:18px}
.toast2{position:absolute;left:50%;top:70px;transform:translateX(-50%);max-width:88%;padding:10px 16px;border-radius:16px;background:#FFF6E5;color:#3A2E2A;font-size:16px;line-height:1.35;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.35);animation:say 3.2s ease-out forwards;z-index:30}
.slots-layer{z-index:1000;animation:slotsin .6s ease-out .55s both}
@keyframes slotsin{from{opacity:0}to{opacity:1}}
.slot2{position:absolute;padding:0;border:0;background:none;cursor:pointer;border-radius:50%}
.slot2.drop-in .ornament{animation:orn-drop .9s cubic-bezier(.3,1.5,.5,1)}
.slot2.ring .ornament{animation:orn-ring .9s ease-in-out}
`;

const lite = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, { name: x.name, c: x.base }]));
const catalogJS = Object.fromEntries(Object.entries(CATALOG).map(([t, c]) => [t, { name: c.name, layer: c.layer, overlay: c.overlay || null, fx: c.fx || null, variants: Object.fromEntries(Object.entries(c.variants).map(([k, x]) => [k, { name: x.name, src: x.src || '', w: x.w, h: x.h, ax: x.ax, ay: x.ay }])) }]));
const TREE_SRC = {};
for (const s of Object.keys(SHAPES)) for (const p of Object.keys(PALETTES)) TREE_SRC[`${s}|${p}`] = 1;

const script = `<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1180,"height":920}}'>
var CAT = ${JSON.stringify(catalogJS)};
var BGS = ${JSON.stringify(BGS)};
var TAIL = ${JSON.stringify(TAIL)};
var SHAPES = ${JSON.stringify(lite(SHAPES))}, PALS = ${JSON.stringify(lite(PALETTES))}, TRUNKS = ${JSON.stringify(lite(TRUNK_SHAPES))}, WOODS = ${JSON.stringify(lite(WOODS))};
var LAYOUTS = ${JSON.stringify(layouts)};
var COUNTS = ${JSON.stringify(SLOT_COUNTS)};
var KINDS = ${JSON.stringify(kinds)};
var NAMES = ${JSON.stringify(Object.fromEntries(Object.entries(ORNAMENTS).map(([k, x]) => [k, x.name])))};
var VS = ${VS}, VW = ${VW}, VH = ${VH}, TS = ${TS}, FLOOR = ${R.FLOOR};
var ON = 'background: #F6EBDD; color: #2C2633; border-color: #F6EBDD';
var nid = 100;
var EDIT_MS = 15 * 60 * 1000;
function start() {
  return [
    { id: 1, type: 'window', v: 'wood', x: 522, y: 388, s: 1, flip: false },
    { id: 2, type: 'fireplace', v: 'classic', x: 172, y: 850, s: 1, flip: false },
    { id: 3, type: 'rug', v: 'plaid', x: 492, y: 908, s: 1, flip: false },
    { id: 4, type: 'tree', v: 'main', x: 492, y: 912, s: 1, flip: false },
    { id: 5, type: 'stack', v: 'warm', x: 590, y: 1014, s: 1, flip: false },
    { id: 6, type: 'gift', v: 'blue', x: 356, y: 990, s: 0.85, flip: false },
    { id: 7, type: 'pet', v: 'cat', x: 236, y: 966, s: 1, flip: false }
  ];
}
var GIFT_FX = [
  { cls: 'g-hop', burst: 'confetti' },
  { cls: 'g-shake', say: 'Lắc lắc... có gì nhỉ?' },
  { cls: 'g-spin', burst: 'spark' },
  { cls: 'g-squash', burst: 'heart' },
  { cls: 'g-pop', burst: 'snow', say: 'Bất ngờ chưa!' },
  { cls: 'g-wobble', burst: 'star' }
];
var PET_FX = [
  { cls: 'pop' },
  { cls: 'p-talk', say: '@' },
  { cls: 'p-dance', burst: 'note' },
  { cls: 'p-spin', burst: 'spark' },
  { cls: 'p-sleep', say: 'Zzz...' },
  { cls: 'p-jump', burst: 'star', say: 'Yay!' }
];
var SOUND = { cat: 'Meo~', dog: 'Gâu gâu!', deer: 'Hí hí!', bear: 'Ôm cái nào!', owl: 'Hú hú~', penguin: 'Lạch bạch~' };
var PCOL = { confetti: ['#D94B4B', '#F4C542', '#3E9468', '#78B1E0', '#F6A3BA', '#FFFFFF'], spark: ['#FFE48A', '#FFFFFF', '#FFD24A'], heart: ['#FF6B81', '#F6A3BA', '#E94B6A'], snow: ['#FFFFFF', '#E6F3F8'], star: ['#FFD24A', '#FFE48A'], note: ['#FFF6E5', '#FFD86B', '#F6A3BA'] };
function parts(kind, seed) {
  var out = [], n = kind === 'confetti' ? 16 : 10, s0 = seed || 1;
  function r() { s0 = (s0 * 9301 + 49297) % 233280; return s0 / 233280; }
  for (var i = 0; i < n; i++) {
    var a = Math.PI * (0.08 + 0.84 * (i + r() * 0.6) / n), R = 90 + r() * 110;
    var c = PCOL[kind][Math.floor(r() * PCOL[kind].length)];
    out.push({ dx: Math.round(-Math.cos(a) * R), dy: Math.round(-Math.sin(a) * R - 30 + (kind === 'snow' || kind === 'confetti' ? 60 * r() : 0)), r: Math.round((r() - 0.5) * 540), d: (r() * 0.18).toFixed(2), c: c,
      cls: kind, heart: kind === 'heart', star: kind === 'star', spark: kind === 'spark', note: kind === 'note' });
  }
  return out;
}
function filledFor(n) { var m = {}; for (var i = 0; i < n; i++) if ((i * 7) % 10 < 5) m[i] = KINDS[(i * 3) % KINDS.length]; return m; }
function rank(it) { var l = CAT[it.type].layer; return (l === 'wall' ? 0 : l === 'rug' ? 2000 : 4000) + it.y; }
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { role: 'owner', bg: 'night', items: start(), sel: null, drag: null, sheet: null, zoomed: false, shape: 'cloud3', pal: 'teal', trunk: 'straight', wood: 'oak', count: 12, filled: filledFor(12), slotFx: {}, fx: null, compose: null, mine: {}, toast2: null, lastName: '', device: 'phone', strip: null, treeTab: 'shape' }; this.timers = []; }
  componentWillUnmount() { this.timers.forEach(clearTimeout); }
  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
  upd(id, patch) { this.setState({ items: this.state.items.map(function (it) { return it.id === id ? Object.assign({}, it, patch) : it; }) }); }
  sel() { var s = this.state; return s.items.filter(function (i) { return i.id === s.sel; })[0] || null; }
  toast(msg) { var self = this; clearTimeout(this.tT); this.setState({ toast2: null }, function () { self.setState({ toast2: msg }); self.tT = setTimeout(function () { self.setState({ toast2: null }); }, 3200); }); }
  fx(id, e) { var self = this; clearTimeout(this.fxT); this.setState({ fx: null }, function () { requestAnimationFrame(function () { self.setState({ fx: Object.assign({ id: id, n: Math.floor(Math.random() * 1000) }, e) }); self.fxT = setTimeout(function () { self.setState({ fx: null }); }, 1800); }); }); }
  fxNext(it, list, sound) { this.cnt = this.cnt || {}; var i = (this.cnt[it.id] = ((this.cnt[it.id] == null ? -1 : this.cnt[it.id]) + 1) % list.length); var e = Object.assign({}, list[i]); if (e.say === '@') e.say = sound; this.fx(it.id, e); }
  renderVals() {
    var s = this.state, self = this, out = {};
    var owner = s.role === 'owner';
    var tree = s.items.filter(function (i) { return i.type === 'tree'; })[0];
    var sorted = s.items.slice().sort(function (a, b) { return rank(a) - rank(b); });
    var selGeom = null;
    out.items = sorted.map(function (it, idx) {
      var c = CAT[it.type], vv = c.variants[it.v];
      var w = vv.w * it.s, h = vv.h * it.s;
      var o = { left: Math.round(it.x - vv.ax * it.s), top: Math.round(it.y - vv.ay * it.s), w: Math.round(w), h: Math.round(h), z: idx + 1, src: vv.src, label: vv.name,
        isTree: it.type === 'tree', isPlain: it.type !== 'tree' && it.type !== 'pet', isFire: c.overlay === 'fire', isWindow: c.overlay === 'snow',
        sel: owner && s.sel === it.id && !s.zoomed, flipCls: it.flip ? 'flipped' : '' };
      Object.keys(CAT.pet.variants).forEach(function (k) { o['pet_' + k] = it.type === 'pet' && it.v === k; });
      Object.keys(CAT.fireplace.variants).forEach(function (k) { o['fire_' + k] = it.type === 'fireplace' && it.v === k; });
      Object.keys(CAT.window.variants).forEach(function (k) { o['win_' + k] = it.type === 'window' && it.v === k; });
      var cls = [];
      if (s.fx && s.fx.id === it.id) {
        cls.push(s.fx.cls);
        if (s.fx.burst) { o.hasBurst = true; o.parts = parts(s.fx.burst, s.fx.n); o.burstTop = it.type === 'pet' ? '22%' : '10%'; }
        if (s.fx.say) { o.hasSay = true; o.say = s.fx.say; }
      }
      if (s.drag && s.drag.id === it.id) cls.push('dragging');
      o.cls = cls.join(' ');
      if (it.id === s.sel) selGeom = { x: o.left, y: o.top, w: o.w, h: o.h };
      if (false) { o.tailL = Math.round(TAIL.dx * it.s); o.tailT = Math.round(TAIL.dy * it.s); o.tailW = Math.round(TAIL.w * it.s); o.tailH = Math.round(TAIL.h * it.s); o.tailO = Math.round(TAIL.ox * it.s) + 'px ' + Math.round(TAIL.oy * it.s) + 'px'; }
      if (o.isTree) {
        Object.keys(SHAPES).forEach(function (a) { o['sh_' + a] = s.shape === a; Object.keys(PALS).forEach(function (b) { o['cn_' + a + '_' + b] = s.shape === a && s.pal === b; }); });
        Object.keys(TRUNKS).forEach(function (a) { Object.keys(WOODS).forEach(function (b) { o['tk_' + a + '_' + b] = s.trunk === a && s.wood === b; }); });
      }
      o.down = function (e) {
        if (!owner) {
          if (it.type === 'tree') { if (!s.zoomed) self.setState({ zoomed: true }); }
          else if (c.overlay === 'fire') self.fx(it.id, { cls: 'fx-fire', burst: 'spark' });
          else if (c.fx === 'pop') self.fxNext(it, PET_FX, SOUND[it.v]);
          else if (c.fx === 'hop') self.fxNext(it, GIFT_FX);
          return;
        }
        if (e && e.stopPropagation) e.stopPropagation();
        var st = self.state.strip; if (st === 'bg') st = null; else if (st && self.state.sel !== it.id) st = it.type === 'tree' ? 'tree' : 'variant';
        self.setState({ sel: it.id, sheet: null, strip: st, drag: { id: it.id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y } });
      };
      return o;
    });
    out.move = function (e) {
      var d = self.state.drag; if (!d) return;
      var it = self.state.items.filter(function (i) { return i.id === d.id; })[0]; if (!it) return;
      var nx = d.ox + (e.clientX - d.sx) / VS, ny = d.oy + (e.clientY - d.sy) / VS;
      var l = CAT[it.type].layer;
      nx = Math.max(10, Math.min(710, nx));
      ny = l === 'wall' ? Math.max(200, Math.min(FLOOR - 20, ny)) : Math.max(FLOOR + 40, Math.min(1075, ny));
      self.upd(d.id, { x: Math.round(nx), y: Math.round(ny) });
    };
    out.up = function () { if (self.state.drag) self.setState({ drag: null }); };
    out.bgDown = function () { if (owner) self.setState({ sel: null, sheet: null, strip: self.state.strip === 'bg' ? 'bg' : null }); };
    out.bgSrc = BGS[s.bg].src;
    // zoom vào cây
    var zf = 1.6 / Math.max(0.8, tree.s);
    var tcx = tree.x, tcy = tree.y - 300 * TS * tree.s;
    var phone = s.device === 'phone';
    var cur = self.sel();
    var stripH = s.strip === 'tree' ? 170 : 128;
    var zfS = 1;
    if (s.zoomed) {
      out.worldT = 'translate(' + (VW / 2 - tcx * VS * zf).toFixed(1) + 'px, ' + (VH / 2 - tcy * VS * zf).toFixed(1) + 'px) scale(' + (VS * zf).toFixed(3) + ')';
    } else if (phone && owner && s.strip && s.strip !== 'bg' && cur && selGeom) {
      // dời camera để món đang sửa nằm giữa phần màn hình phía trên dải chọn
      var avH = VH - stripH, gw = selGeom.w + 180, gh = selGeom.h + 80;
      zfS = Math.max(1, Math.min(1.8, (avH - 30) / (gh * VS), (VW - 20) / (gw * VS)));
      var k = VS * zfS, ccx = selGeom.x + selGeom.w / 2, ccy = selGeom.y + selGeom.h / 2 + 20;
      out.worldT = 'translate(' + (VW / 2 - ccx * k).toFixed(1) + 'px, ' + (avH / 2 - ccy * k).toFixed(1) + 'px) scale(' + k.toFixed(3) + ')';
    } else out.worldT = 'scale(' + VS + ')';
    out.worldCls = s.drag ? 'dragmode' : '';
    out.zoomed = s.zoomed;
    out.zoomOut = function () { self.setState({ zoomed: false }); };
    out.zoomedIdle = s.zoomed && !s.compose;
    out.showHint = !owner && !s.zoomed;
    out.isPhone = phone; out.isDesktop = !phone;
    out.stageCls = phone ? 'phone-mode' : 'desk-mode';
    out.deskOwner = !phone && owner;
    out.phoneOwner = phone && owner;
    out.showTopbar = !s.strip && s.sheet !== 'add';
    out.showToolbar = !!cur && !s.strip && s.sheet !== 'add';
    out.hasSel = !!cur; out.noSel = !cur; out.noSelHint = !cur && !s.strip && s.sheet !== 'add';
    out.selName = cur ? (cur.type === 'tree' ? 'Cây thông' : CAT[cur.type].variants[cur.v].name) : '';
    out.selIsTree = !!cur && cur.type === 'tree'; out.selNotTree = !!cur && cur.type !== 'tree';
    out.sizePct = cur ? Math.round(cur.s * 100) + '%' : '';
    out.canDelete = !!cur && cur.type !== 'tree';
    out.smaller = function () { var c = self.sel(); if (c) self.upd(c.id, { s: Math.max(0.5, +(c.s - 0.1).toFixed(2)) }); };
    out.bigger = function () { var c = self.sel(); if (c) self.upd(c.id, { s: Math.min(1.6, +(c.s + 0.1).toFixed(2)) }); };
    out.flip = function () { var c = self.sel(); if (c) self.upd(c.id, { flip: !c.flip }); };
    out.remove = function () { var c = self.sel(); if (c && c.type !== 'tree') self.setState({ items: self.state.items.filter(function (i) { return i.id !== c.id; }), sel: null, strip: null }); };
    out.openStyle = function () { var c = self.sel(); if (c) self.setState({ strip: c.type === 'tree' ? 'tree' : 'variant', sheet: null }); };
    out.openAdd = function () { self.setState({ sheet: 'add', strip: null }); };
    out.openBg = function () { self.setState({ strip: 'bg', sheet: null, sel: null }); };
    out.closeSheet = function () { self.setState({ sheet: null }); };
    out.closeStrip = function () { self.setState({ strip: null }); };
    out.sheetAdd = s.sheet === 'add';
    out.stop = function (e) { if (e && e.stopPropagation) e.stopPropagation(); };
    out.addGroups = ['window', 'fireplace', 'rug', 'stack', 'gift', 'pet'].map(function (t) {
      var c = CAT[t];
      return { name: c.name, items: Object.keys(c.variants).map(function (k) { return { name: c.variants[k].name, src: c.variants[k].src, pick: function () {
        if (self.state.items.length >= 25) return;
        var id = ++nid, wall = c.layer === 'wall';
        self.setState({ items: self.state.items.concat([{ id: id, type: t, v: k, x: 360, y: wall ? 380 : 1000, s: 1, flip: false }]), sel: id, sheet: null });
      } }; }) };
    });
    // các danh sách lựa chọn dùng chung cho dải (điện thoại) và bảng bên (máy tính)
    function opt(name, on, pick, extra) { return Object.assign({ name: name, on: on ? 'true' : 'false', pick: pick, cls: '', css: '', isImg: false, isLabel: true, label: name, src: '' }, extra || {}); }
    function setK(key, k, more) { return function () { var x = {}; x[key] = k; if (more) Object.assign(x, more(k)); self.setState(x); }; }
    var pShape = Object.keys(SHAPES).map(function (k) { return opt(SHAPES[k].name, s.shape === k, setK('shape', k)); });
    var pPal = Object.keys(PALS).map(function (k) { return opt(PALS[k].name, s.pal === k, setK('pal', k), { cls: 'sw', isLabel: false, css: 'background: ' + PALS[k].c }); });
    var pTrunk = Object.keys(TRUNKS).map(function (k) { return opt(TRUNKS[k].name, s.trunk === k, setK('trunk', k)); });
    var pWood = Object.keys(WOODS).map(function (k) { return opt(WOODS[k].name, s.wood === k, setK('wood', k), { cls: 'sw', isLabel: false, css: 'background: ' + WOODS[k].c }); });
    var pCount = COUNTS.map(function (n) { return opt(n + ' điểm', s.count === n, function () { self.setState({ count: n, filled: filledFor(n), slotFx: {} }); }); });
    var pVariants = cur && cur.type !== 'tree' ? Object.keys(CAT[cur.type].variants).map(function (k) { var vv = CAT[cur.type].variants[k]; return opt(vv.name, cur.v === k, function () { self.upd(cur.id, { v: k }); }, { cls: 'img', isImg: true, isLabel: false, src: vv.src }); }) : [];
    var bgOpts = Object.keys(BGS).map(function (k) { return opt(BGS[k].name, s.bg === k, function () { self.setState({ bg: k }); }, { cls: 'img', isImg: true, isLabel: false, src: BGS[k].src }); });
    out.pShape = pShape; out.pPal = pPal; out.pTrunk = pTrunk; out.pWood = pWood; out.pCount = pCount; out.pVariants = pVariants; out.bgOpts = bgOpts;
    var TABS = [['shape', 'Dáng', pShape], ['pal', 'Màu', pPal], ['trunk', 'Thân', pTrunk], ['wood', 'Gỗ', pWood], ['count', 'Điểm nhắn', pCount]];
    out.stripOpen = phone && owner && !!s.strip;
    out.stripTabs = s.strip === 'tree';
    out.tabList = TABS.map(function (t) { return opt(t[1], s.treeTab === t[0], function () { self.setState({ treeTab: t[0] }); }, { cls: 'tab' }); });
    out.stripTitle = s.strip === 'bg' ? 'Phông nền' : s.strip === 'tree' ? 'Cây thông' : (cur ? CAT[cur.type].name : '');
    out.stripOpts = s.strip === 'bg' ? bgOpts : s.strip === 'tree' ? TABS.filter(function (t) { return t[0] === s.treeTab; })[0][2] : pVariants;
    // mũi tên đổi kiểu nhanh ngay cạnh món đang chọn
    out.showArrows = owner && !!cur && !!selGeom && !s.zoomed && !s.drag;
    if (out.showArrows) {
      var inv = 1 / zfS;
      var aw = 76;
      out.arrInv = inv.toFixed(3);
      out.arrT = Math.round(Math.min(1080 - aw - 10, Math.max(10, selGeom.y + selGeom.h / 2 - aw / 2)));
      out.arrL = Math.round(Math.max(6, selGeom.x - aw * inv - 10));
      out.arrR = Math.round(Math.min(720 - aw - 6, selGeom.x + selGeom.w + 10));
      out.labX = Math.round(Math.min(640, Math.max(80, selGeom.x + selGeom.w / 2)));
      out.labY = Math.round(Math.min(1080 - 60, selGeom.y + selGeom.h + 12));
      var list, idx, key;
      if (cur.type === 'tree') { list = Object.keys(PALS); idx = list.indexOf(s.pal); out.vLabel = 'Màu: ' + PALS[s.pal].name + ' · ' + (idx + 1) + '/' + list.length; }
      else { list = Object.keys(CAT[cur.type].variants); idx = list.indexOf(cur.v); out.vLabel = CAT[cur.type].variants[cur.v].name + ' · ' + (idx + 1) + '/' + list.length; }
      var step = function (d) { return function () { var c = self.sel(); if (!c) return; var n = list[(idx + d + list.length) % list.length]; if (c.type === 'tree') self.setState({ pal: n }); else self.upd(c.id, { v: n }); }; };
      out.prevVariant = step(-1); out.nextVariant = step(1);
    }
    out.deviceList = [['phone', 'Điện thoại'], ['desktop', 'Máy tính']].map(function (o) { var on = s.device === o[0]; return { name: o[1], label: o[1], on: on ? 'true' : 'false', css: on ? ON : '', pick: function () { self.setState({ device: o[0], strip: null, sheet: null }); } }; });
    out.roleList = [['owner', 'Chủ cây sắp xếp'], ['guest', 'Bạn bè mở link']].map(function (o) { var on = s.role === o[0]; return { name: o[1], label: o[1], on: on ? 'true' : 'false', css: on ? ON : '', pick: function () { self.setState({ role: o[0], sel: null, sheet: null, strip: null, zoomed: false, drag: null, compose: null }); } }; });
    // điểm nhắn theo vị trí và tỉ lệ cây hiện tại
    var L = LAYOUTS[s.shape + '|' + s.count];
    var k = TS * tree.s, tl = tree.x - 200 * k, tt = tree.y - 538 * k;
    var w = Math.round(60 * L.s * k), free = 0;
    out.slots = L.p.map(function (p, i) {
      var kind = s.filled[i]; if (!kind) free++;
      var px = tree.flip ? 400 - p[0] : p[0];
      var it = { left: Math.round(tl + px * k - w / 2), top: Math.round(tt + p[1] * k - 6 * L.s * k), w: w, empty: !kind, cls: s.slotFx[i] || '' };
      KINDS.forEach(function (kk) { it['k_' + kk] = kind === kk; });
      it.label = kind ? NAMES[kind] + ' đã treo' : 'Điểm trống, chạm để treo lời nhắn';
      var mine = self.state.mine[i];
      if (mine) it.label = 'Lời nhắn của bạn: ' + NAMES[kind];
      it.tap = function () {
        if (!kind) { self.setState({ compose: { slot: i, kind: 'ball', anon: false, name: self.state.lastName || '', text: '', edit: false } }); return; }
        var m = self.state.mine[i];
        if (m && Date.now() - m.at < EDIT_MS) { self.setState({ compose: { slot: i, kind: kind, anon: m.anon, name: m.name, text: m.text, edit: true } }); return; }
        var fx = Object.assign({}, self.state.slotFx); fx[i] = 'ring'; self.setState({ slotFx: fx });
        if (m) self.toast('Lời nhắn của bạn đã quá 15 phút nên không sửa được nữa');
        self.later(function () { var x = Object.assign({}, self.state.slotFx); delete x[i]; self.setState({ slotFx: x }); }, 950);
      };
      return it;
    });
    // bảng viết lời nhắn
    var cp = s.compose;
    out.composeOpen = !!cp;
    if (cp) {
      out.composeTitle = cp.edit ? 'Sửa lời nhắn của bạn' : 'Treo lời nhắn';
      out.ornChoices = KINDS.map(function (k) { var o = { name: NAMES[k], on: cp.kind === k ? 'true' : 'false', css: cp.kind === k ? 'border-color: #FFD86B; background: #5A4A2E' : '', pick: function () { self.setState({ compose: Object.assign({}, self.state.compose, { kind: k }) }); } }; KINDS.forEach(function (kk) { o['k_' + kk] = kk === k; }); return o; });
      out.anonChoices = [[false, 'Để tên'], [true, 'Ẩn danh']].map(function (x) { var on = cp.anon === x[0]; return { label: x[1], on: on ? 'true' : 'false', css: on ? ON : '', pick: function () { self.setState({ compose: Object.assign({}, self.state.compose, { anon: x[0] }) }); } }; });
      out.showName = !cp.anon;
      out.composeName = cp.name; out.composeText = cp.text; out.composeCount = cp.text.length;
      out.setName = function (e) { self.setState({ compose: Object.assign({}, self.state.compose, { name: e.target.value.slice(0, 30) }) }); };
      out.setText = function (e) { self.setState({ compose: Object.assign({}, self.state.compose, { text: e.target.value.slice(0, 300) }) }); };
      var ok = cp.text.trim().length > 0 && (cp.anon || cp.name.trim().length > 0);
      out.composeDisabled = ok ? 'false' : 'true';
      out.composeBtnCss = ok ? '' : 'opacity: .45; cursor: not-allowed';
      out.composeBtn = cp.edit ? 'Lưu thay đổi' : 'Treo lên cây';
      out.composeEditing = cp.edit;
      var m = s.mine[cp.slot];
      out.composeHint = true;
      out.composeHintText = cp.edit ? 'Còn ' + Math.max(1, Math.ceil((EDIT_MS - (Date.now() - m.at)) / 60000)) + ' phút để sửa hoặc xoá lời nhắn này.' : 'Chủ cây sẽ đọc được từ đêm 24/12. Sau khi treo, bạn có 15 phút để sửa trên thiết bị này.';
      out.composeCancel = function () { self.setState({ compose: null }); };
      out.composeSubmit = function () {
        if (!ok) return;
        var i = cp.slot, f = Object.assign({}, self.state.filled), mine = Object.assign({}, self.state.mine), fx = Object.assign({}, self.state.slotFx);
        f[i] = cp.kind;
        mine[i] = { anon: cp.anon, name: cp.name.trim(), text: cp.text.trim(), at: cp.edit ? mine[i].at : Date.now() };
        fx[i] = cp.edit ? 'ring' : 'drop-in';
        self.setState({ filled: f, mine: mine, slotFx: fx, compose: null, lastName: cp.anon ? self.state.lastName : cp.name.trim() });
        self.toast(cp.edit ? 'Đã lưu thay đổi' : 'Đã treo ' + NAMES[cp.kind].toLowerCase() + ' lên cây! Chạm vào nó trong 15 phút nếu muốn sửa');
        self.later(function () { var x = Object.assign({}, self.state.slotFx); delete x[i]; self.setState({ slotFx: x }); }, 950);
      };
      out.composeDelete = function () {
        var i = cp.slot, f = Object.assign({}, self.state.filled), mine = Object.assign({}, self.state.mine);
        delete f[i]; delete mine[i];
        self.setState({ filled: f, mine: mine, compose: null });
        self.toast('Đã gỡ lời nhắn, chỗ này trống trở lại');
      };
    } else { out.ornChoices = []; out.anonChoices = []; }
    out.hasToast2 = !!s.toast2; out.toast2 = s.toast2 || '';
    out.toast = free ? 'Còn ' + free + ' chỗ trống. Chạm bong bóng + để viết lời nhắn' : 'Cây đã đầy lời nhắn';
    return out;
  }
}
</script>`;

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Phòng tự do – kéo thả đồ trang trí</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
<style>
body{margin:0}
${css}
</style>
</helmet>
${body}
</x-dc>
${script}
</body>
</html>
`;
fs.writeFileSync(OUT + 'Phong-tu-do.dc.html', html);

// ---- Bảng bộ phụ kiện (tĩnh) ----
const card = (src, name, bg = '#4A4152', box = 150) => `<figure style="margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; width: ${box}px"><div style="width: ${box}px; height: ${box}px; border-radius: 20px; background: ${bg}; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box"><img src="${src}" alt="${name}" style="max-width: 100%; max-height: 100%; object-fit: contain"></div><figcaption style="font-family: 'Grape Nuts', cursive; font-size: 17px; text-align: center">${name}</figcaption></figure>`;
const sec = (t, cards) => `<section style="display: flex; flex-direction: column; gap: 12px"><h2 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 44px; line-height: 1; color: #FFD86B">${t}</h2><div style="display: flex; flex-wrap: wrap; gap: 20px">${cards}</div></section>`;
let gal = '';
gal += sec('Phông nền (tường + sàn)', Object.entries(BGS).map(([k, b]) => card(b.src, b.name, '#4A4152', 150)).join(''));
gal += sec('Phụ kiện treo lời nhắn (20)', Object.entries(ORNAMENTS).map(([k, o]) => `<figure style="margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 110px"><div style="width: 110px; height: 110px; border-radius: 20px; background: #3E8A7E; display: flex; align-items: center; justify-content: center"><svg viewBox="-30 -6 60 60" width="84" height="84" aria-hidden="true">${ornamentSVG(k, 'filled', null)}</svg></div><figcaption style="font-family: 'Grape Nuts', cursive; font-size: 16px; text-align: center">${o.name}</figcaption></figure>`).join(''));
for (const t of ['window', 'fireplace', 'rug', 'stack', 'gift', 'pet']) gal += sec(CATALOG[t].name, Object.values(CATALOG[t].variants).map((x) => card(x.src, x.name, '#4A4152', t === 'fireplace' ? 200 : 150)).join(''));
const htmlG = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Bộ phụ kiện căn phòng</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
<style>body{margin:0}</style>
</helmet>
<div style="width: 1400px; box-sizing: border-box; padding: 56px; display: flex; flex-direction: column; gap: 36px; background: #2C2633; font-family: 'Mynerve', cursive; color: #F6EBDD">
<header><h1 style="margin: 0; font-family: 'Amatic SC', cursive; font-size: 84px; line-height: 1; color: #FFD86B">Bộ phụ kiện căn phòng</h1><p style="margin: 8px 0 0; font-size: 21px">Mỗi món là một ảnh riêng có điểm neo ở chân, đặt được ở bất kỳ đâu trong phòng. Cây thông có bộ riêng ở bảng bên trái.</p></header>
${gal}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1400,"height":3000}}'>
class Component extends DCLogic { renderVals() { return {}; } }
</script>
</body>
</html>
`;
fs.writeFileSync(OUT + 'Bo-phu-kien.dc.html', htmlG);

// canvas.json do người dùng sắp xếp trên canvas: không sửa tự động ở đây.
console.log('ok', html.length, htmlG.length);
