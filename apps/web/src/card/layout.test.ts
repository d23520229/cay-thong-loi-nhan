import { describe, expect, it } from 'vitest';
import { catalog } from '../lib/catalog';
import { cardDate, coverRect, fitCard, layoutCard, signText, type Measure } from './layout';

const W = 2100;
const H = (W * 1500) / 2100;
const c = catalog.card;
const measure: Measure = (s, px) => [...s].length * px * 0.5;
const base = { sign: '— Minh', hasPhoto: false, W, measure };
const fontPx = (c.text.fontSize / 100) * W;

describe('layoutCard', () => {
  it('dòng chữ đầu nằm trên dòng kẻ 2', () => {
    const l = layoutCard({ ...base, text: 'Chào' });
    expect(l.lines[0]!.baseline).toBeCloseTo((c.lines[1]! / 100) * H - 0.15 * fontPx, 5);
    expect(l.fontPx).toBeCloseTo(fontPx, 5);
  });

  it('ký tên ở dòng ngay dưới dòng chữ cuối', () => {
    const l = layoutCard({ ...base, text: 'a\nb' });
    expect(l.sign.baseline).toBeCloseTo((c.lines[c.text.firstLine + 2]! / 100) * H - 0.15 * fontPx, 5);
    expect(l.sign.x).toBeCloseTo(((c.text.left + c.text.width) / 100) * W, 5);
    expect(l.sign.text).toBe('— Minh');
  });

  it('mẫu có ảnh: dòng 1–3 sát lề, dòng 4 lùi', () => {
    const l = layoutCard({ ...base, hasPhoto: true, text: 'a\nb\nc\nd\ne' });
    const left = (c.text.left / 100) * W;
    for (const i of [0, 1, 2]) expect(l.lines[i]!.x).toBeCloseTo(left, 5);
    expect(l.lines[3]!.x).toBeGreaterThan(left);
    const e = c.frameEdge;
    const yb = c.lines[c.text.firstLine + 3]!;
    const edge = e.x1 + ((yb - e.y1) / (e.y2 - e.y1)) * (e.x2 - e.x1);
    expect(l.lines[3]!.x).toBeCloseTo(((edge + e.gap) / 100) * W, 5);
  });

  it('quá 9 dòng → fits false', () => {
    const l = layoutCard({ ...base, text: Array.from({ length: 10 }, () => 'x').join('\n') });
    expect(l.lines).toHaveLength(10);
    expect(l.fits).toBe(false);
    expect(layoutCard({ ...base, text: 'x\n'.repeat(8) + 'x' }).fits).toBe(true);
  });

  it('dòng trống giữ chỗ', () => {
    const l = layoutCard({ ...base, text: 'a\n\nb' });
    expect(l.lines.map((x) => x.text)).toEqual(['a', '', 'b']);
  });

  it('từ dài bị bẻ', () => {
    const l = layoutCard({ ...base, text: 'x'.repeat(300) });
    expect(l.lines.length).toBeGreaterThan(1);
    const maxW = (c.text.width / 100) * W;
    for (const ln of l.lines) expect(measure(ln.text, l.fontPx)).toBeLessThanOrEqual(maxW);
    expect(l.lines.map((x) => x.text).join('')).toBe('x'.repeat(300));
  });

  it('ngắt theo từ', () => {
    const l = layoutCard({ ...base, text: Array(30).fill('abcd').join(' ') });
    expect(l.lines.length).toBeGreaterThan(1);
    for (const ln of l.lines) expect(ln.text.startsWith(' ') || ln.text.endsWith(' ')).toBe(false);
  });
});

describe('fitCard', () => {
  it('thu chữ khi chữ rộng', () => {
    const wide: Measure = (s, px) => measure(s, px) * 1.2;
    const text = Array.from({ length: 9 }, () => 'abcd '.repeat(8).trim()).join('\n');
    expect(layoutCard({ ...base, measure: wide, text }).fits).toBe(false);
    const l = fitCard({ ...base, measure: wide, text });
    expect(l.fits).toBe(true);
    expect(l.fontPx).toBeLessThan(fontPx);
  });
});

describe('signText / cardDate', () => {
  it('signText', () => {
    expect(signText(false, 'Minh')).toBe('— Minh');
    expect(signText(true, 'Minh')).toBe('— Một người bạn');
    expect(signText(false, null)).toBe('— Một người bạn');
  });
  it('cardDate theo giờ Việt Nam', () => {
    expect(cardDate('2026-12-24T13:05:00Z')).toBe('24/12 · 20:05');
    expect(cardDate('2026-12-24T18:30:00Z')).toBe('25/12 · 01:30');
  });
});

describe('coverRect', () => {
  it('cắt giữa, không méo', () => {
    expect(coverRect(4000, 500, 100, 100)).toEqual({ sx: 1750, sy: 0, sw: 500, sh: 500 });
    expect(coverRect(500, 4000, 100, 100)).toEqual({ sx: 0, sy: 1750, sw: 500, sh: 500 });
  });
});
