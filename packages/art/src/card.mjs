// Mẫu thiệp lời nhắn (đặc tả 6.7.3): tách mẫu có ảnh thành nền + khung, đo dòng kẻ / ô ảnh / mép khung.
// Nguồn: src/card/christmas_card.svg (không ảnh), src/card/christmas_card_2.svg (có khung polaroid) — xuất từ công cụ thiết kế,
// ảnh nhúng base64, id sinh ngẫu nhiên mỗi lần xuất nên không dựa vào id.
import sharp from 'sharp';

const TAG = /<\/?[a-zA-Z][^>]*>/g;

// Các phần tử con cấp cao nhất của <svg>: [{ start, end }] theo chỉ số trong chuỗi
function topLevelChildren(svg) {
  const rootEnd = svg.indexOf('>', svg.indexOf('<svg')) + 1;
  const kids = [];
  let depth = 0, start = -1;
  TAG.lastIndex = rootEnd;
  for (let m; (m = TAG.exec(svg));) {
    const t = m[0];
    if (t.startsWith('</')) {
      if (depth === 0) break; // </svg>
      if (--depth === 0) kids.push({ start, end: TAG.lastIndex });
    } else {
      if (depth === 0) start = m.index;
      if (t.endsWith('/>')) { if (depth === 0) kids.push({ start, end: TAG.lastIndex }); } else depth++;
    }
  }
  return { rootEnd, kids };
}

const stripMetadata = (svg) => svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '');
const base64s = (s) => s.match(/base64,[A-Za-z0-9+/=]+/g) || [];

// Tách mẫu 2 thành { base, frame }. Nhóm khung = nhóm con cấp cao nhất của <svg> có <image>
// mà dữ liệu base64 không xuất hiện trong mẫu 1.
export function splitPhotoCard(svg2, svg1) {
  const svg = stripMetadata(svg2);
  const { rootEnd, kids } = topLevelChildren(svg);
  const frames = kids.filter(({ start, end }) => {
    const el = svg.slice(start, end);
    return el.startsWith('<g') && el.includes('<image') && base64s(el).some((b) => !svg1.includes(b));
  });
  if (frames.length !== 1) throw new Error(`cần đúng 1 nhóm khung trong mẫu 2, thấy ${frames.length}`);
  const g = frames[0];
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
  const group = svg.slice(g.start, g.end);
  return {
    base: svg.slice(0, g.start) + svg.slice(g.end),
    frame: svg.slice(0, rootEnd) + defs + group + '</svg>',
  };
}

// (a) Dòng kẻ: quét cột x = 0,6W của ảnh mẫu 1 đã render (raw RGB/RGBA), trả về tâm 11 dòng (%H)
export function measureLines({ data, info }) {
  const { width, height, channels } = info;
  const x = Math.round(width * 0.6);
  const rows = [];
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * channels;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r - g > 45 && r > 170 && b < 175) rows.push(y);
  }
  const clusters = [];
  for (const y of rows) {
    const c = clusters.at(-1);
    if (c && y - c.at(-1) <= 3) c.push(y); else clusters.push([y]);
  }
  return clusters
    .map((c) => (c.reduce((s, y) => s + y, 0) / c.length / height) * 100)
    .filter((p) => p >= 25 && p <= 80)
    .slice(0, 11)
    .map((p) => +p.toFixed(2));
}

// (b) Ô ảnh + (c) mép phải khung, đo từ ảnh mặt nạ của nhóm khung. Đơn vị: x/rộng %W, y/cao %H, góc độ.
export async function measurePhoto(frameSvg) {
  const [, vw, vh] = frameSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const body = frameSvg.replace(/<defs>[\s\S]*?<\/defs>/, '');
  const maskId = body.match(/mask="url\(#([^)]+)\)"/)[1];
  const [a, b, c, d, e, f] = body.match(/transform="matrix\(([^)]+)\)"/)[1].split(',').map(Number);
  const img = body.match(/<image\b[^>]*>/)[0];
  const iw = +img.match(/width="([\d.]+)"/)[1], ih = +img.match(/height="([\d.]+)"/)[1];

  const mask = frameSvg.match(new RegExp(`<mask[^>]*id="${maskId}"[^>]*>([\\s\\S]*?)</mask>`))[1];
  const png = Buffer.from(mask.match(/base64,([A-Za-z0-9+/=]+)/)[1], 'base64');
  const { data, info } = await sharp(png).flatten({ background: '#000' }).resize(iw, ih, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const lum = (x, y) => data[(y * info.width + x) * info.channels];

  // tối = ô trong suốt, sáng = khung; dừng ở điểm sáng đầu tiên gặp được
  const cy = Math.round(ih * 0.45), cx = Math.round(iw / 2);
  let l = cx, r = cx;
  while (l > 0 && lum(l, cy) < 128) l--;
  while (r < iw - 1 && lum(r, cy) < 128) r++;
  const col = l + 150;
  let t = cy, btm = cy;
  while (t > 0 && lum(col, t) < 128) t--;
  while (btm < ih - 1 && lum(col, btm) < 128) btm++;

  const P = (x, y) => [a * x + c * y + e, b * x + d * y + f]; // toạ độ ảnh → viewBox
  const pct = (v, total) => +((v / total) * 100).toFixed(2);
  const tl = P(l, t), tr = P(r, t), bl = P(l, btm);
  const e1 = P(iw, 0), e2 = P(iw, ih);
  return {
    photo: {
      left: pct(tl[0], vw),
      top: pct(tl[1], vh),
      width: pct(Math.hypot(tr[0] - tl[0], tr[1] - tl[1]), vw),
      height: pct(Math.hypot(bl[0] - tl[0], bl[1] - tl[1]), vh),
      angle: +((Math.atan2(b, a) * 180) / Math.PI).toFixed(2),
    },
    frameEdge: { x1: pct(e1[0], vw), y1: pct(e1[1], vh), x2: pct(e2[0], vw), y2: pct(e2[1], vh), gap: 0.4 },
  };
}

// Đo toàn bộ: plainRaw = ảnh card-plain thu về 1600 rộng, dạng raw ({ data, info })
export async function measureCard(plainRaw, frameSvg) {
  const { photo, frameEdge } = await measurePhoto(frameSvg);
  return { lines: measureLines(plainRaw), photo, frameEdge };
}
