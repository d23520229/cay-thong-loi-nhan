// Ảnh xem trước OG 1200×630 ghép từ chính căn phòng (đặc tả 6.6.3). Không có chữ trong ảnh.
// Toạ độ, thứ tự vẽ và vị trí điểm nhắn chép theo apps/web/src/room/model.ts (rank/drawOrder) và
// apps/web/src/guest/geometry.ts (slotRects) — server không import code web.
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { catalog, layoutSlots } from '@ctln/shared';
import { lightsSource, starSource } from '@ctln/art/tree';
import { petSVGSoft } from '@ctln/art/pets';
import { ornamentSVGSoft } from '@ctln/art/ornaments';
import { fire2Overlay } from '@ctln/art/fireplaces';
import { windowSnowOverlay } from '@ctln/art/room';

type Item = { clientId: string; type: string; variant: string; x: number; y: number; scale: number; flip: boolean };
export type OgRoom = {
  background: string;
  tree: { shape: string; palette: string; trunkShape: string; wood: string; slotCount: number };
  items: Item[];
  slots: { index: number; occupied: boolean; ornament?: string }[];
};
type Variant = { asset?: string; w: number; h: number; ax: number; ay: number; crop?: { left: number; top: number } };
type ItemDef = { layer: string; render: string; overlay?: string; variants: Record<string, Variant> };

const W = 1200, H = 630;
const RW = catalog.room.w as number, RH = catalog.room.h as number;
const PAD = 420; // khung vẽ rộng hơn phòng: món tràn mép (sharp không ghép được ảnh lấn ra ngoài nền)
const FRAME = catalog.tree.frame as { w: number; h: number; baseY: number; scaleInRoom: number };
const items = catalog.items as Record<string, ItemDef>;

const rank = (it: Item) => {
  const layer = items[it.type]!.layer;
  return (layer === 'wall' ? 0 : layer === 'rug' ? 2000 : 4000) + it.y;
};

const px = (n: number) => Math.max(1, Math.round(n));
const svg = (viewBox: string, w: number, h: number, body: string, preserve = 'xMidYMid meet') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${px(w)}" height="${px(h)}" preserveAspectRatio="${preserve}" overflow="visible">${body}</svg>`);

async function layer(input: Buffer | string, w: number, h: number): Promise<Buffer> {
  return sharp(input).resize(px(w), px(h), { fit: 'fill' }).png().toBuffer();
}

/** Ảnh một món đồ, đúng cỡ trong phòng, đã lật nếu cần. */
async function itemImage(it: Item, room: OgRoom, assetDir: string, w: number, h: number): Promise<Buffer> {
  const def = items[it.type]!;
  const v = def.variants[it.variant]!;
  const parts: Buffer[] = [];
  if (def.render === 'tree') {
    const t = room.tree;
    parts.push(await layer(join(assetDir, 'assets', catalog.tree.assets.trunk.replace('{trunkShape}', t.trunkShape).replace('{wood}', t.wood)), w, h));
    parts.push(await layer(join(assetDir, 'assets', catalog.tree.assets.canopy.replace('{shape}', t.shape).replace('{palette}', t.palette)), w, h));
    parts.push(await layer(svg('0 0 400 600', w, h, lightsSource(t.shape) + starSource(t.shape)), w, h));
  } else if (v.asset) {
    parts.push(await layer(join(assetDir, 'assets', v.asset), w, h));
    if (def.overlay && v.crop) {
      const body = def.overlay === 'fire' ? fire2Overlay(it.variant) : windowSnowOverlay();
      parts.push(await layer(svg(`${v.crop.left} ${v.crop.top} ${v.w} ${v.h}`, w, h, body, 'none'), w, h));
    }
  } else if (def.render === 'svg-pet') {
    parts.push(await layer(svg('-70 -180 140 195', w, h, petSVGSoft(it.variant)), w, h));
  }
  let img = sharp({ create: { width: px(w), height: px(h), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts.map((input) => ({ input, left: 0, top: 0 })));
  let buf = await img.png().toBuffer();
  if (it.flip) buf = await sharp(buf).flop().png().toBuffer();
  return buf;
}

/** Phụ kiện đã treo trên cây (vị trí như slotRects ở web). */
function ornaments(room: OgRoom, tree: Item, sc: number): OverlayOptions[] {
  const L = layoutSlots(room.tree.shape, room.tree.slotCount) as { scale: number; slots: { x: number; y: number }[] };
  const k = FRAME.scaleInRoom * tree.scale;
  const tl = tree.x - (FRAME.w / 2) * k;
  const tt = tree.y - FRAME.baseY * k;
  const size = 60 * L.scale * k * sc;
  const byIndex = new Map(room.slots.map((s) => [s.index, s]));
  const out: OverlayOptions[] = [];
  L.slots.forEach((p, index) => {
    const s = byIndex.get(index);
    if (!s?.occupied || !s.ornament || !(s.ornament in catalog.ornaments)) return;
    const x = tree.flip ? FRAME.w - p.x : p.x;
    out.push({
      input: svg('-30 -6 60 60', size, size, ornamentSVGSoft(s.ornament, 'filled', null)),
      left: Math.round(sc * (PAD + tl + x * k) - size / 2),
      top: Math.round(sc * (PAD + tt + p.y * k - 6 * L.scale * k)),
    });
  });
  return out;
}

/**
 * Ghép căn phòng thành PNG (720·scale × 1080·scale), không chữ. Dùng chung cho ảnh OG (scale 1) và ảnh tải về (scale 1.5).
 * Mọi toạ độ và cỡ nhân với `scale` ngay lúc ghép; ảnh WebP được xuất sẵn ở 1,5× nên 1,5 là cỡ gốc, không phóng to mờ.
 */
export async function renderRoomLayer(room: OgRoom, assetDir: string, scale: number): Promise<Buffer> {
  const bgPath = join(assetDir, 'assets', catalog.backgrounds[room.background]!.asset);
  // Món không có trong danh mục (dữ liệu cũ/lạ) bị bỏ qua, không làm hỏng cả ảnh.
  const known = room.items.filter((it) => items[it.type]?.variants[it.variant]);
  const order = known.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || a.i - b.i).map((x) => x.it);
  const pad = Math.round(PAD * scale), outW = Math.round(RW * scale), outH = Math.round(RH * scale);

  const overlays: OverlayOptions[] = [{ input: await layer(bgPath, outW, outH), left: pad, top: pad }];
  for (const it of order) {
    const v = items[it.type]!.variants[it.variant]!;
    const w = v.w * it.scale * scale, h = v.h * it.scale * scale;
    overlays.push({ input: await itemImage(it, room, assetDir, w, h), left: Math.round(scale * (PAD + it.x - v.ax * it.scale)), top: Math.round(scale * (PAD + it.y - v.ay * it.scale)) });
    if (it.type === 'tree') overlays.push(...ornaments(room, it, scale));
  }
  // Ghép ra buffer trước rồi mới cắt (sharp: extract sau composite trong cùng chuỗi sẽ lỗi).
  const canvas = await sharp({ create: { width: outW + 2 * pad, height: outH + 2 * pad, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(overlays)
    .png()
    .toBuffer();
  return sharp(canvas).extract({ left: pad, top: pad, width: outW, height: outH }).png().toBuffer();
}

/** Ảnh phòng tải về: 1080×1620, không chữ (đặc tả 6.7.4). */
export const renderRoomImage = (room: OgRoom, assetDir: string): Promise<Buffer> => renderRoomLayer(room, assetDir, 1.5);

export async function renderOg(room: OgRoom, assetDir: string): Promise<Buffer> {
  const bgPath = join(assetDir, 'assets', catalog.backgrounds[room.background]!.asset);
  const roomH = H;
  const roomW = Math.round((RW * H) / RH); // 420
  const roomImg = await sharp(await renderRoomLayer(room, assetDir, 1))
    .resize(roomW, roomH)
    .png()
    .toBuffer();
  const backdrop = await sharp(bgPath).resize(W, H, { fit: 'cover' }).blur(18).modulate({ brightness: 0.55 }).png().toBuffer();
  return sharp(backdrop)
    .composite([{ input: roomImg, left: Math.round((W - roomW) / 2), top: 0 }])
    .png({ palette: true, quality: 90, effort: 7 }) // ảnh bảng màu: nhẹ hơn nhiều lần, đủ đẹp cho ảnh xem trước
    .toBuffer();
}
