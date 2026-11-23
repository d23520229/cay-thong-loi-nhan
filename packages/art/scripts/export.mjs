// Xuất toàn bộ đồ hoạ màu nước thành WebP + sinh danh mục dùng chung.
// Chạy từ thư mục gốc repo:  pnpm --filter @ctln/art export   (hoặc: node packages/art/scripts/export.mjs)
//   --only=tree|room|card|catalog   chỉ xuất một phần
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canopySource, trunkSource, PALETTES, SHAPES, TRUNK_SHAPES, WOODS } from '../src/tree.mjs';
import * as R from '../src/room.mjs';
import { fireplace2Source, FIREPLACES2 } from '../src/fireplaces.mjs';
import { PETS } from '../src/animated/pets.mjs';
import { ORNAMENTS } from '../src/animated/ornaments.mjs';
import { SLOT_COUNTS } from '../../shared/src/slots.mjs';
import { splitPhotoCard, measureCard } from '../src/card.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..');
const OUT_TREE = path.join(ROOT, 'apps/web/public/assets/tree');
const OUT_ROOM = path.join(ROOT, 'apps/web/public/assets/room');
const CATALOG = path.join(ROOT, 'packages/shared/src/catalog.json');
const META = path.join(here, '../room-meta.json');
const OUT_CARD = path.join(ROOT, 'apps/web/public/assets/card');
const CARD_SRC = path.join(here, '../src/card');
const CARD_META = path.join(here, '../card-meta.json');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
fs.mkdirSync(OUT_TREE, { recursive: true });
fs.mkdirSync(OUT_ROOM, { recursive: true });

const K = 1.5; // độ phân giải xuất cho đồ trong phòng (720x1080 -> 1080x1620)
const svgRoom = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1080" width="720" height="1080">${inner}</svg>`;
const svgTree = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="800" height="1200">${inner}</svg>`;

async function exportTree() {
  const jobs = [];
  const out = async (name, svg) => {
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 800 } }).render().asPng();
    await sharp(png).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(OUT_TREE, name + '.webp'));
  };
  for (const s of Object.keys(SHAPES)) for (const p of Object.keys(PALETTES)) jobs.push(out(`canopy-${s}-${p}`, svgTree(canopySource(s, p, 'c'))));
  for (const t of Object.keys(TRUNK_SHAPES)) for (const w of Object.keys(WOODS)) jobs.push(out(`trunk-${t}-${w}`, svgTree(trunkSource(t, w, 't'))));
  await Promise.all(jobs);
  console.log('tree:', jobs.length, 'ảnh');
}

async function exportRoom() {
  const meta = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, 'utf8')) : {};
  const jobs = [];
  const render = (inner) => new Resvg(svgRoom(inner), { fitTo: { mode: 'width', value: 720 * K } }).render().asPng();
  const item = async (name, inner, anchor, full = false) => {
    const png = render(inner);
    const file = path.join(OUT_ROOM, name + '.webp');
    if (full) { await sharp(png).webp({ quality: 78 }).toFile(file); return; }
    const { data, info } = await sharp(png).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const left = -info.trimOffsetLeft / K, top = -info.trimOffsetTop / K;
    await sharp(data).webp({ quality: 82, alphaQuality: 90 }).toFile(file);
    meta[name] = { w: +(info.width / K).toFixed(1), h: +(info.height / K).toFixed(1), ax: +(anchor.x - left).toFixed(1), ay: +(anchor.y - top).toFixed(1), left: +left.toFixed(1), top: +top.toFixed(1) };
  };
  for (const k of Object.keys(R.ROOMS)) jobs.push(item('bg-' + k, R.roomSource(k), null, true));
  for (const k of Object.keys(FIREPLACES2)) jobs.push(item('fp2-' + k, fireplace2Source(k), { x: 200, y: 850 }));
  for (const k of Object.keys(R.WINDOWS)) jobs.push(item('window-' + k, R.windowSource(k), R.WINDOW_ANCHOR));
  for (const k of ['plaid', 'knit']) jobs.push(item('rug-' + k, R.rugSource(k), { x: 492, y: 908 }));
  for (const k of Object.keys(R.GIFT_SINGLES)) jobs.push(item('gift-' + k, R.giftSingleSource(k), { x: R.GIFT_ANCHOR.x, y: R.GIFT_ANCHOR.y + 4 }));
  for (const k of ['warm', 'pastel']) jobs.push(item('stack-' + k, R.giftsSource(k), { x: 590, y: 1014 }));
  await Promise.all(jobs);
  fs.writeFileSync(META, JSON.stringify(meta, null, 1));
  console.log('room:', jobs.length, 'ảnh');
}

// Thiệp lời nhắn (6.7.3): mẫu 1 → card-plain; mẫu 2 tách thành nền + khung (trong suốt). Đo số liệu → card-meta.json
async function exportCard() {
  fs.mkdirSync(OUT_CARD, { recursive: true });
  const svg1 = fs.readFileSync(path.join(CARD_SRC, 'christmas_card.svg'), 'utf8');
  const svg2 = fs.readFileSync(path.join(CARD_SRC, 'christmas_card_2.svg'), 'utf8');
  const { base, frame } = splitPhotoCard(svg2, svg1);
  const render = (svg) => sharp(Buffer.from(svg), { limitInputPixels: false });
  const out = (name) => path.join(OUT_CARD, name + '.webp');
  await render(svg1).resize(2100, 1500).webp({ quality: 85 }).toFile(out('card-plain'));
  await render(base).resize(2100, 1500).webp({ quality: 85 }).toFile(out('card-photo-bg'));
  await render(frame).resize(2100, 1500).webp({ alphaQuality: 90 }).toFile(out('card-photo-frame'));
  // đo dòng kẻ trên chính file card-plain.webp (thu về 1600 rộng); render SVG trực tiếp dính một vệt màu
  // nước ở ~62,6 %H thành cụm thừa, nên kiểm khoảng cách giữa các dòng để không ghi số đo sai
  const plainRaw = await sharp(out('card-plain')).resize(1600).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const meta = await measureCard(plainRaw, frame);
  if (meta.lines.length !== 11 || meta.lines.some((y, i) => i && y - meta.lines[i - 1] < 3)) throw new Error('đo dòng kẻ sai: ' + meta.lines.join(' '));
  fs.writeFileSync(CARD_META, JSON.stringify(meta, null, 1));
  console.log('card: 3 ảnh,', meta.lines.length, 'dòng kẻ');
}

function buildCatalog() {
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const v = (prefix, k, name) => { const m = meta[`${prefix}-${k}`]; return { name, asset: `room/${prefix}-${k}.webp`, w: m.w, h: m.h, ax: m.ax, ay: m.ay, crop: { left: m.left, top: m.top } }; };
  const PK = 1.4;
  const cardMeta = JSON.parse(fs.readFileSync(CARD_META, 'utf8'));
  const catalog = {
    version: 1,
    room: { w: 720, h: 1080, floorY: R.FLOOR },
    limits: { maxItems: 25, scaleMin: 0.5, scaleMax: 1.6, messageMax: 400, nameMax: 30, titleMax: 40, perDeviceMessages: 3, editMinutes: 15 },
    backgrounds: Object.fromEntries(Object.entries(R.ROOMS).map(([k, o]) => [k, { name: o.name, asset: `room/bg-${k}.webp` }])),
    tree: {
      frame: { w: 400, h: 600, baseY: 538, scaleInRoom: R.TREE_POS.scale },
      shapes: Object.fromEntries(Object.entries(SHAPES).map(([k, o]) => [k, { name: o.name }])),
      palettes: Object.fromEntries(Object.entries(PALETTES).map(([k, o]) => [k, { name: o.name, swatch: o.base }])),
      trunkShapes: Object.fromEntries(Object.entries(TRUNK_SHAPES).map(([k, o]) => [k, { name: o.name }])),
      woods: Object.fromEntries(Object.entries(WOODS).map(([k, o]) => [k, { name: o.name, swatch: o.base }])),
      slotCounts: SLOT_COUNTS,
      assets: { canopy: 'tree/canopy-{shape}-{palette}.webp', trunk: 'tree/trunk-{trunkShape}-{wood}.webp' },
    },
    items: {
      tree: { name: 'Cây thông', layer: 'floor', render: 'tree', deletable: false, variants: { main: { name: 'Cây thông', w: 480, h: 720, ax: 240, ay: 538 * R.TREE_POS.scale } } },
      window: { name: 'Cửa sổ', layer: 'wall', render: 'image', overlay: 'snow', variants: Object.fromEntries(Object.entries(R.WINDOWS).map(([k, o]) => [k, v('window', k, o.name)])) },
      fireplace: { name: 'Lò sưởi', layer: 'floor', render: 'image', overlay: 'fire', tapEffects: 'fire', variants: Object.fromEntries(Object.entries(FIREPLACES2).map(([k, o]) => [k, v('fp2', k, o.name)])) },
      rug: { name: 'Thảm', layer: 'rug', render: 'image', variants: { plaid: v('rug', 'plaid', 'Thảm kẻ đỏ'), knit: v('rug', 'knit', 'Thảm len kem') } },
      stack: { name: 'Chồng quà', layer: 'floor', render: 'image', tapEffects: 'gift', variants: { warm: v('stack', 'warm', 'Chồng quà đỏ xanh'), pastel: v('stack', 'pastel', 'Chồng quà pastel') } },
      gift: { name: 'Hộp quà', layer: 'floor', render: 'image', tapEffects: 'gift', variants: Object.fromEntries(Object.entries(R.GIFT_SINGLES).map(([k, o]) => [k, v('gift', k, o.name)])) },
      pet: { name: 'Thú cưng', layer: 'floor', render: 'svg-pet', tapEffects: 'pet', variants: Object.fromEntries(Object.entries(PETS).map(([k, o]) => [k, { name: o.name, asset: `room/pet-${k}.webp`, w: 140 * PK, h: 195 * PK, ax: 70 * PK, ay: 180 * PK }])) },
    },
    card: {
      w: 2100, h: 1500,
      assets: { plain: 'card/card-plain.webp', photoBg: 'card/card-photo-bg.webp', photoFrame: 'card/card-photo-frame.webp' },
      lines: cardMeta.lines,
      text: { left: 29.8, width: 52, fontSize: 2.3, color: '#7a1f2a', firstLine: 1, maxLines: 9 },
      date: { left: 79.3, top: 20.1, width: 8.8, height: 5, fontSize: 1.45, color: '#fff6e5' },
      photo: cardMeta.photo,
      frameEdge: cardMeta.frameEdge,
    },
    ornaments: Object.fromEntries(Object.entries(ORNAMENTS).map(([k, o]) => [k, { name: o.name }])),
    defaultRoom: {
      background: 'night',
      tree: { shape: 'cloud3', palette: 'teal', trunkShape: 'straight', wood: 'oak', slotCount: 12 },
      items: [
        { type: 'window', variant: 'wood', x: 522, y: 388, scale: 1, flip: false },
        { type: 'fireplace', variant: 'classic', x: 172, y: 850, scale: 1, flip: false },
        { type: 'rug', variant: 'plaid', x: 492, y: 908, scale: 1, flip: false },
        { type: 'tree', variant: 'main', x: 492, y: 912, scale: 1, flip: false },
        { type: 'stack', variant: 'warm', x: 590, y: 1014, scale: 1, flip: false },
        { type: 'gift', variant: 'blue', x: 356, y: 990, scale: 0.85, flip: false },
        { type: 'pet', variant: 'cat', x: 236, y: 966, scale: 1, flip: false },
      ],
    },
  };
  fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));
  console.log('catalog.json đã cập nhật');
}

if (!only || only === 'tree') await exportTree();
if (!only || only === 'room') await exportRoom();
if (!only || only === 'card') await exportCard();
if (!only || only === 'room' || only === 'card' || only === 'catalog') buildCatalog();
