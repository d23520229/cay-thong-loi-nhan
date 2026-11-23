import { catalog } from '../lib/catalog';

// Bộ xếp chữ thiệp: thuần tính toán, không đụng DOM/canvas (đo chữ do bên gọi truyền vào).
export type Measure = (text: string, fontPx: number) => number; // bề rộng px
export type CardLine = { text: string; x: number; baseline: number }; // px trong khung W×H
export type CardLayout = { lines: CardLine[]; sign: CardLine; fontPx: number; fits: boolean };

type LayoutInput = { text: string; sign: string; hasPhoto: boolean; W: number; measure: Measure; fontScale?: number };

const ANON = '— Một người bạn';

export function signText(anonymous: boolean, authorName: string | null): string {
  return anonymous || !authorName ? ANON : `— ${authorName}`;
}

// Giờ Việt Nam là UTC+7, không có giờ mùa hè: cộng 7 giờ rồi đọc theo UTC để không phụ thuộc múi giờ máy.
export function cardDate(iso: string): string {
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} · ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function layoutCard(o: LayoutInput): CardLayout {
  const { text: t, lines: rule, frameEdge: e } = catalog.card;
  const { W, measure } = o;
  const H = (W * catalog.card.h) / catalog.card.w;
  const fontPx = (t.fontSize / 100) * W * (o.fontScale ?? 1);
  const ruleAt = (k: number) => rule[Math.min(k, rule.length - 1)]!;
  const baselineAt = (i: number) => (ruleAt(t.firstLine + i) / 100) * H - 0.15 * fontPx;

  // Lề lùi (%W) của dòng chữ thứ i: tránh mép khung ảnh nghiêng ở bên trái.
  const indentAt = (i: number) => {
    if (!o.hasPhoto) return 0;
    const yb = ruleAt(t.firstLine + i);
    const edge = e.x1 + ((yb - e.y1) / (e.y2 - e.y1)) * (e.x2 - e.x1);
    return Math.max(0, edge + e.gap - t.left);
  };
  const maxWidthAt = (i: number) => ((t.width - indentAt(i)) / 100) * W;

  const out: string[] = [];
  for (const para of o.text.split('\n')) {
    let cur = '';
    const flush = () => {
      out.push(cur);
      cur = '';
    };
    for (const word of para.split(' ')) {
      const cand = cur === '' ? word : `${cur} ${word}`;
      if (measure(cand, fontPx) <= maxWidthAt(out.length)) {
        cur = cand;
        continue;
      }
      if (cur !== '') flush();
      // Từ dài hơn cả dòng: bẻ theo ký tự, mỗi dòng giữ ít nhất một ký tự.
      cur = '';
      for (const ch of [...word]) {
        if (cur !== '' && measure(cur + ch, fontPx) > maxWidthAt(out.length)) flush();
        cur += ch;
      }
    }
    flush();
  }

  const lines = out.map((text, i) => ({ text, x: ((t.left + indentAt(i)) / 100) * W, baseline: baselineAt(i) }));
  const sign = { text: o.sign, x: ((t.left + t.width) / 100) * W, baseline: baselineAt(out.length) };
  return { lines, sign, fontPx, fits: out.length <= t.maxLines };
}

// Thử thu chữ dần cho đến khi vừa; nếu vẫn không vừa, trả bản nhỏ nhất.
export function fitCard(o: Omit<LayoutInput, 'fontScale'>): CardLayout {
  let l = layoutCard(o);
  for (const fontScale of [0.95, 0.9, 0.85, 0.8]) {
    if (l.fits) break;
    l = layoutCard({ ...o, fontScale });
  }
  return l;
}

// Cắt giữa ảnh nguồn cho vừa khung đích mà không méo (kiểu object-fit: cover).
export function coverRect(srcW: number, srcH: number, boxW: number, boxH: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(boxW / srcW, boxH / srcH);
  const sw = boxW / scale;
  const sh = boxH / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}
