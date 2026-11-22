import { assetUrl, catalog } from '../lib/catalog';
import { cardDate, coverRect, fitCard, type CardLayout } from './layout';

export type CardData = {
  content: string;
  sign: string;
  sentAt: string;
  photo?: (CanvasImageSource & { width: number; height: number }) | null;
};
export type CardAssets = { plain: HTMLImageElement; photoBg: HTMLImageElement; photoFrame: HTMLImageElement };

// Đợi phông chữ thiệp tải xong (kèm ký tự tiếng Việt) trước khi vẽ, nếu không canvas sẽ vẽ bằng phông dự phòng.
export async function ensureCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([document.fonts.load('16px Mynerve', 'Ểữ'), document.fonts.load('16px "Grape Nuts"', 'Ểữ')]);
}

const loadImage = (path: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Không tải được ${path}`));
    im.src = assetUrl(path);
  });

export async function loadCardAssets(): Promise<CardAssets> {
  const a = catalog.card.assets;
  const [plain, photoBg, photoFrame] = await Promise.all([loadImage(a.plain!), loadImage(a.photoBg!), loadImage(a.photoFrame!)]);
  return { plain, photoBg, photoFrame };
}

export function drawCard(ctx: CanvasRenderingContext2D, W: number, d: CardData, a: CardAssets): CardLayout {
  const c = catalog.card;
  const H = (W * c.h) / c.w;
  const hasPhoto = !!d.photo;

  if (d.photo) {
    const p = c.photo;
    const bw = (p.width / 100) * W;
    const bh = (p.height / 100) * H;
    ctx.drawImage(a.photoBg, 0, 0, W, H);
    ctx.save();
    ctx.translate((p.left / 100) * W, (p.top / 100) * H);
    ctx.rotate((p.angle * Math.PI) / 180);
    ctx.beginPath();
    ctx.rect(0, 0, bw, bh);
    ctx.clip();
    const r = coverRect(d.photo.width, d.photo.height, bw, bh);
    ctx.drawImage(d.photo, r.sx, r.sy, r.sw, r.sh, 0, 0, bw, bh);
    ctx.restore();
    ctx.drawImage(a.photoFrame, 0, 0, W, H);
  } else {
    ctx.drawImage(a.plain, 0, 0, W, H);
  }

  // Giờ gửi, căn giữa ô date.
  const dt = c.date;
  ctx.fillStyle = dt.color;
  ctx.font = `${(dt.fontSize / 100) * W}px "Grape Nuts"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cardDate(d.sentAt), ((dt.left + dt.width / 2) / 100) * W, ((dt.top + dt.height / 2) / 100) * H);

  const measure = (s: string, px: number) => {
    ctx.font = `${px}px Mynerve`;
    return ctx.measureText(s).width;
  };
  const layout = fitCard({ text: d.content, sign: d.sign, hasPhoto, W, measure });
  ctx.fillStyle = c.text.color;
  ctx.font = `${layout.fontPx}px Mynerve`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  for (const l of layout.lines) ctx.fillText(l.text, l.x, l.baseline);
  ctx.textAlign = 'right'; // x của dòng ký tên là mép phải
  ctx.fillText(layout.sign.text, layout.sign.x, layout.sign.baseline);
  return layout;
}

export async function renderCardBlob(d: CardData): Promise<Blob> {
  const W = catalog.card.w;
  const H = catalog.card.h;
  const [, assets] = await Promise.all([ensureCardFonts(), loadCardAssets()]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas');
  drawCard(ctx, W, d, assets);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), 'image/png'));
}
