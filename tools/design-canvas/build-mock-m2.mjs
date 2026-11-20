// Vẽ mẫu các màn M2 đã duyệt 18/11 (chỉ để xem thiết kế, không dùng khi chạy).
// Chạy từ gốc repo: node tools/design-canvas/build-mock-m2.mjs . <thư-mục-ra>/m2.html  (ảnh PNG ghi cạnh file html)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createRequire } from 'node:module';

const [root, out] = process.argv.slice(2).map((p) => resolve(p));
const sharp = createRequire(join(root, 'packages/art/package.json'))('sharp');
const cat = JSON.parse(readFileSync(join(root, 'packages/shared/src/catalog.json'), 'utf8'));
const conv = new Map();
const A = (p) => {
  const name = basename(p, '.webp') + '.png';
  if (!conv.has(name)) conv.set(name, sharp(join(root, 'apps/web/public/assets', p)).png().toFile(join(dirname(out), name)));
  return '/files/' + name;
};

const art = (p) => import('file:///' + join(root, 'packages/art/src', p).replace(/\\/g, '/'));
const { lightsSource, starSource, TREE2_CSS } = await art('tree.mjs');
const { fire2Overlay } = await art('fireplaces.mjs');
const { windowSnowOverlay } = await art('room.mjs');
const animCSS = readFileSync(join(root, 'apps/web/src/styles/room-animations.css'), 'utf8') + TREE2_CSS;
// Lớp SVG động phủ lên ảnh món: toạ độ theo bản vẽ gốc (crop) như bản thiết kế canvas
const ovl = (v, inner) => `<svg viewBox="${v.crop.left} ${v.crop.top} ${v.w} ${v.h}" class="fill" style="overflow:visible" preserveAspectRatio="none">${inner}</svg>`;
const room = cat.defaultRoom;
const rank = (it) => { const l = cat.items[it.type].layer; return (l === 'wall' ? 0 : l === 'rug' ? 2000 : 4000) + it.y; };
const bg = A(cat.backgrounds[room.background].asset);
const t = room.tree;
const canopy = A(cat.tree.assets.canopy.replace('{shape}', t.shape).replace('{palette}', t.palette));
const trunk = A(cat.tree.assets.trunk.replace('{trunkShape}', t.trunkShape).replace('{wood}', t.wood));

function roomInner(selType) {
  return `<img src="${bg}" style="position:absolute;inset:0;width:720px;height:1080px">` +
    [...room.items].sort((a, b) => rank(a) - rank(b)).map((it) => {
      const v = cat.items[it.type].variants[it.variant], s = it.scale;
      const st = `position:absolute;left:${it.x - v.ax * s}px;top:${it.y - v.ay * s}px;width:${v.w * s}px;height:${v.h * s}px;` +
        (it.type === selType ? 'outline:4px dashed #FFD86B;outline-offset:8px;border-radius:14px;' : '');
      if (it.type === 'tree') return `<div style="${st}"><div class="fill sway2"><img src="${trunk}" class="fill"><img src="${canopy}" class="fill">
        <svg viewBox="0 0 400 600" class="fill" style="overflow:visible">${lightsSource(t.shape)}${starSource(t.shape)}</svg></div></div>`;
      const extra = it.type === 'fireplace' ? ovl(v, fire2Overlay(it.variant)) : it.type === 'window' ? ovl(v, windowSnowOverlay()) : '';
      return extra ? `<div style="${st}"><img src="${A(v.asset)}" class="fill">${extra}</div>` : `<img src="${A(v.asset)}" style="${st}">`;
    }).join('');
}

// Một máy cỡ w×h (px CSS thật), vẽ thu nhỏ k lần. Phòng co theo chiều rộng: s = w/720, cao 1,5w.
// Phần dư chiều cao: thanh trên (≤ 56px) ở trên phòng, còn lại ở dưới cho thanh công cụ / dải chọn.
const K = 0.62;
function device({ w, h, label }, { top = '', bottom = '', over = '', sel = null, blur = false, dim = false }) {
  const s = Math.min(w / 720, h / 1080);
  const rw = 720 * s, rh = 1080 * s;
  const spare = h - rh;
  const roomTop = spare >= 110 ? 56 : Math.max(0, spare * 0.48);
  const bottomH = h - roomTop - rh;
  const f = blur ? 'filter:blur(3px) brightness(.7);' : dim ? 'filter:brightness(.55);' : '';
  return `<div class="dev" style="width:${w * K}px;height:${h * K}px">
    <div class="screen" style="width:${w}px;height:${h}px;transform:scale(${K})">
      <div class="backdrop" style="background-image:url(${bg})"></div>
      <div class="roombox" style="left:${(w - rw) / 2}px;top:${roomTop}px;width:${rw}px;height:${rh}px;${f}">
        <div class="room" style="transform:scale(${s})">${roomInner(sel)}</div></div>
      ${top ? `<div class="zone topz" style="height:${roomTop >= 44 ? roomTop : 52}px;${roomTop >= 44 ? '' : 'background:none'}">${top}</div>` : ''}
      ${bottom ? `<div class="zone botz" style="height:${Math.max(bottomH, 60)}px;${bottomH >= 60 ? '' : 'background:none'}">${bottom}</div>` : ''}
      ${over}
    </div></div><div class="devlab">${label} · phòng ${Math.round(rw)}×${Math.round(rh)}</div>`;
}

const SIZES = [
  { w: 360, h: 640, label: 'Máy nhỏ 360×640' },
  { w: 390, h: 844, label: 'iPhone 390×844' },
  { w: 412, h: 915, label: 'Android lớn 412×915' },
];
const MID = SIZES[1];

const card = (title, devHTML, note) => `<figure class="shot"><div>${devHTML}</div><figcaption><b>${title}</b>${note ? `<span>${note}</span>` : ''}</figcaption></figure>`;
const sheet = (body, cls) => `<div class="sheet ${cls}">${body}</div>`;

const editTop = `<button class="chip">＋ Thêm đồ</button><button class="chip">Phông nền</button><span class="grow"></span><span class="save"><i class="dot ok"></i>Đã lưu</span><button class="chip gold">Xong</button>`;
const editBottom = `<div class="arrows"><button class="arr">‹</button><span class="tag">Lò cổ điển vòm gạch</span><button class="arr">›</button></div>
  <div class="toolbar"><button>－</button><button>＋</button><button>⇋</button><button>Đổi kiểu</button><button>🗑</button></div>`;
const stripBottom = `<div class="strip"><div class="sh"><span>Đổi kiểu lò sưởi</span><button class="chip sm">Xong</button></div>
  <div class="opts">${['classic', 'stove', 'rustic', 'victorian', 'modern', 'dome', 'cabinet', 'tiled'].map((k, i) => `<img src="${A(cat.items.fireplace.variants[k].asset)}" class="${i === 0 ? 'on' : ''}">`).join('')}</div></div>`;

const INTRO = `<h1>Cây Thông Lời Nhắn</h1>
  <ul class="feat"><li><span>🎄</span>Trang trí căn phòng Noel của riêng bạn</li><li><span>✉️</span>Gửi link — bạn bè treo lời nhắn lên cây</li><li><span>🎁</span>0h 24/12 mới được mở quà đọc thư</li></ul>
  <p class="wish">Chúc bạn một mùa Noel thật ấm áp ✨</p><button class="btn gold">Bắt đầu tạo cây</button>
  <button class="btn link">Bạn đã có cây?</button>`;

const REOPEN = `<h2>Mở lại cây của bạn</h2>
  <label>Mã cây hoặc link cây<input value="k7m2xq4a"></label>
  <div class="lab">Mã PIN</div><div class="pin"><b>•</b><b>•</b><b>•</b><b>•</b><b></b><b></b></div>
  <button class="btn gold">Mở cây</button><p class="muted" style="text-align:center">— hoặc —</p>
  <button class="btn ghost">Đăng nhập bằng Google</button>`;

const g1 = [
  card('1a. Trang chủ (mọi máy)', device(MID, { blur: true, over: sheet(INTRO, 'center') }),
    'Cũng là màn hiện ra khi khách bấm "Tạo cây của bạn" trong phòng bạn bè. Lời mời được ghi nhận ngầm để đo lan truyền.'),
  card('1b. Bấm "Bạn đã có cây?"', device(MID, { blur: true, over: sheet(REOPEN, 'bottom') }),
    'Mã cây điền sẵn nếu máy từng mở cây; còn phiên thì mở thẳng không hỏi PIN. Dán link riêng cũng vào được.'),
];

const g2 = SIZES.map((sz, i) => card(i === 0 ? 'Sửa phòng trên 3 cỡ máy' : '&nbsp;', device(sz, { sel: 'fireplace', top: editTop, bottom: editBottom }),
  i === 0 ? 'Máy nhỏ: phòng chiếm gần hết, thanh công cụ vừa khít phần dư.' : i === 1 ? 'Máy dài: thừa ~260px bên dưới — chỗ cho mũi tên ‹ › và thanh công cụ, không che phòng.' : 'Phần thừa phủ bằng chính phông nền làm mờ, không để viền đen.'));

const g3 = [
  card('Dải "Đổi kiểu" mở ra', device(MID, { sel: 'fireplace', top: editTop, bottom: stripBottom }),
    'Dải chọn nằm trong phần thừa bên dưới phòng → không cần lia camera. Máy nhỏ (360×640) không đủ chỗ: dải đè lên đáy phòng và phòng tự đẩy lên một chút để món đang chọn không bị che.'),
  card('5a. Chủ cây — chế độ Xem', device(MID, { top: `<span class="title">Phòng của Lan</span><span class="grow"></span><button class="chip gold">✏️ Sửa phòng</button>`, bottom: `<div class="ph">Đếm ngược · số lời nhắn · chia sẻ<br><i>(M3)</i></div>` }), 'Phòng hiện trọn như khách thấy.'),
  card('3. Hoàn tất', device(MID, { dim: true, over: sheet(`<h2>Sắp xong rồi!</h2><label>Tên của bạn<input value="Lan"></label><label>Tên cây <i>(không bắt buộc)</i><input placeholder="Ví dụ: Cây nhà Lan"></label><div class="lab">Giữ cây khi đổi máy — chọn 1 cách</div><div class="seg"><button class="on">Mã PIN 6 số</button><button>Google</button></div><div class="pin"><b>•</b><b>•</b><b>•</b><b>•</b><b></b><b></b></div><p class="warn">⚠️ Nhớ PIN nhé. Quên PIN và mất link riêng thì không lấy lại được cây.</p><button class="btn gold">Tạo cây</button>`, 'bottom') }), 'Không đổi so với bản 1.'),
];

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Mẫu màn M2 — bản 2</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Grape+Nuts&family=Mynerve&display=swap" rel="stylesheet">
<style>
:root{--bg:#2c2633;--panel:#241d2a;--chip:#3a3044;--text:#f6ebdd;--muted:#b9aec2;--gold:#ffd86b;--cream:#fff6e5;--ink:#3a2e2a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:'Mynerve',cursive;padding:24px 16px 60px}
header,section.group{max-width:1240px;margin:0 auto 16px}h1.t{font-family:'Amatic SC',cursive;color:var(--gold);font-size:52px;margin:0}
header p,section.group p{color:var(--muted);margin:4px 0 0;font-size:16px}section.group{margin-top:30px}section.group h2{font-family:'Amatic SC',cursive;color:var(--gold);font-size:38px;margin:0}
.grid{display:flex;flex-wrap:wrap;gap:30px;justify-content:center;align-items:flex-start;max-width:1240px;margin:0 auto}
.shot{margin:0;display:flex;flex-direction:column;gap:8px;max-width:290px}.shot figcaption{font-size:14.5px;line-height:1.35;color:var(--muted)}.shot figcaption b{display:block;color:var(--text);font-family:'Grape Nuts',cursive;font-size:18px}
.dev{position:relative;border:5px solid #15111a;border-radius:24px;overflow:hidden;box-sizing:content-box;box-shadow:0 10px 30px #0008}
.devlab{font-size:12.5px;color:var(--muted);margin-top:4px}
.screen{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden}
.backdrop{position:absolute;inset:-20px;background-size:cover;background-position:center;filter:blur(14px) brightness(.45)}
.roombox{position:absolute;overflow:hidden}.room{position:absolute;left:0;top:0;width:720px;height:1080px;transform-origin:0 0}.fill{position:absolute;inset:0;width:100%;height:100%}
.zone{position:absolute;left:0;right:0;display:flex;align-items:center;gap:6px;padding:0 8px}.topz{top:0;background:#0003}.botz{bottom:0;flex-direction:column;justify-content:flex-end;padding:8px;gap:8px;background:#0003}
.grow{flex:1}.title{font-family:'Amatic SC',cursive;font-size:30px;color:var(--gold)}
.chip{font:inherit;font-size:13.5px;border:0;border-radius:999px;padding:6px 11px;background:var(--chip);color:var(--text)}.chip.gold{background:var(--gold);color:#3a2e2a}.chip.sm{font-size:12px;padding:4px 9px}
.save{font-size:12px;background:#000a;border-radius:999px;padding:4px 8px;display:flex;align-items:center;gap:5px}.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.dot.ok{background:#7ddc8a}
.arrows{display:flex;justify-content:center;align-items:center;gap:8px}.arr{width:40px;height:40px;border-radius:50%;border:0;background:#fff6e5;color:#3a2e2a;font-size:24px}.tag{font-family:'Grape Nuts',cursive;background:#000b;border-radius:999px;padding:4px 10px;font-size:14px}
.toolbar{width:100%;display:flex;justify-content:space-between;background:var(--panel);border-radius:18px;padding:6px}.toolbar button{font:inherit;font-size:14px;min-width:44px;height:44px;border:0;background:none;color:var(--text)}
.strip{width:100%;background:var(--panel);border-radius:18px;padding:8px}.strip .sh{display:flex;justify-content:space-between;align-items:center;font-family:'Grape Nuts',cursive;margin-bottom:6px}
.opts{display:flex;gap:8px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14px,#000 calc(100% - 14px),transparent)}.opts img{width:64px;height:76px;object-fit:contain;background:#3a3044;border-radius:12px;padding:4px;flex:none}.opts img.on{outline:3px solid var(--gold)}
.ph{width:100%;border:2px dashed #fff8;border-radius:16px;padding:12px;text-align:center;font-size:14px;background:#0005}
.sheet{position:absolute;left:12px;right:12px;background:var(--cream);color:var(--ink);border-radius:22px;padding:18px 16px;box-shadow:0 8px 30px #0009;display:flex;flex-direction:column;gap:9px;z-index:5}
.sheet.center{top:50%;transform:translateY(-50%);text-align:center}.sheet.bottom{bottom:0;left:0;right:0;border-radius:22px 22px 0 0;padding-bottom:22px}
.sheet h1{font-family:'Amatic SC',cursive;font-size:44px;line-height:1;margin:0;color:#b8442c}.sheet h2{font-family:'Amatic SC',cursive;font-size:34px;line-height:1;margin:0;color:#b8442c}
.feat{list-style:none;padding:0;margin:4px 0;text-align:left;display:flex;flex-direction:column;gap:6px;font-size:15px}.feat li{display:flex;gap:8px}.feat span{width:22px;flex:none}
.wish{font-family:'Grape Nuts',cursive;font-size:17px;margin:2px 0}.big{font-size:20px;margin:4px 0}.muted{color:#7a6a63;font-size:13.5px;margin:0}
.btn{font:inherit;font-size:17px;border:0;border-radius:999px;padding:11px 14px}.btn.gold{background:#c8452d;color:#fff6e5}.btn.link{background:none;color:#7a4b3a;font-size:15px;text-decoration:underline;padding:2px}.btn.ghost{background:transparent;border:2px solid #d9c8b8;color:var(--ink);font-size:15px;padding:8px}
label{display:flex;flex-direction:column;gap:3px;font-size:13.5px;color:#7a6a63}input{font:inherit;font-size:16px;border:2px solid #e3d3c3;border-radius:12px;padding:7px 10px;background:#fff;color:var(--ink)}
.lab{font-family:'Grape Nuts',cursive;font-size:15px}.seg{display:flex;background:#efe2d2;border-radius:999px;padding:3px}.seg button{flex:1;font:inherit;font-size:14px;border:0;background:none;border-radius:999px;padding:6px;color:var(--ink)}.seg .on{background:#fff}
.pin{display:flex;gap:6px;justify-content:center}.pin b{width:32px;height:40px;border:2px solid #e3d3c3;border-radius:10px;background:#fff;display:grid;place-items:center;font-size:22px}
.warn{font-size:12.5px;background:#fff0d6;border-radius:10px;padding:6px 8px;margin:0;color:#8a4b12}
${animCSS}
</style></head><body>
<header><h1 class="t">Mẫu M2 — bản 3</h1><p>Phòng luôn hiện trọn, co theo chiều rộng máy (khung 720×1080 thu nhỏ đúng tỉ lệ). Phần chiều cao dư dùng cho thanh trên và thanh công cụ, phủ bằng phông nền làm mờ.</p></header>
<section class="group"><h2>Vào trang</h2><p>Bỏ 1b — khách bấm "Tạo cây của bạn" cũng vào 1a.</p></section>
<div class="grid">${g1.join('')}</div>
<section class="group"><h2>Cùng một màn trên 3 cỡ máy</h2><p>Khung máy vẽ cùng tỉ lệ thu nhỏ, nên chiều cao khác nhau là đúng thật.</p></section>
<div class="grid">${g2.join('')}</div>
<section class="group"><h2>Dải chọn, chế độ Xem, Hoàn tất</h2><p>Trên iPhone 390×844.</p></section>
<div class="grid">${g3.join('')}</div>
</body></html>`;

await Promise.all(conv.values());
writeFileSync(out, html);
console.log('wrote', out, Math.round(html.length / 1024) + ' KB');
