import { describe, it, expect } from 'vitest';
import { drawCard, type CardData } from './draw';
import { catalog } from '../lib/catalog';

type Call = { fn: string; args: unknown[] };

// ctx giả: ghi lại lệnh gọi; ảnh được nhận diện qua thuộc tính tag.
function fakeCtx() {
  const calls: Call[] = [];
  const rec = (fn: string) => (...args: unknown[]) => { calls.push({ fn, args }); };
  const ctx: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * 5 }),
    font: '', fillStyle: '', textAlign: '', textBaseline: '',
  };
  for (const f of ['save', 'restore', 'translate', 'rotate', 'beginPath', 'rect', 'clip', 'drawImage', 'fillText', 'clearRect']) ctx[f] = rec(f);
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
const img = (tag: string) => ({ tag, width: 100, height: 100 }) as unknown as HTMLImageElement;
const assets = { plain: img('plain'), photoBg: img('photoBg'), photoFrame: img('photoFrame') };
const tagsDrawn = (calls: Call[]) => calls.filter((c) => c.fn === 'drawImage').map((c) => (c.args[0] as { tag: string }).tag);
const base: CardData = { content: 'Chúc mừng giáng sinh', sign: '— Một người bạn', sentAt: '2026-12-24T13:05:00Z' };

describe('drawCard', () => {
  it('không ảnh: vẽ plain, không vẽ frame', () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, 2100, base, assets as never);
    expect(tagsDrawn(calls)).toEqual(['plain']);
  });

  it('có ảnh: thứ tự photoBg → ảnh → photoFrame, có rotate(angle·π/180)', () => {
    const { ctx, calls } = fakeCtx();
    const photo = img('photo');
    drawCard(ctx, 2100, { ...base, photo }, assets as never);
    expect(tagsDrawn(calls)).toEqual(['photoBg', 'photo', 'photoFrame']);
    const rot = calls.find((c) => c.fn === 'rotate')!;
    expect(rot.args[0]).toBeCloseTo((catalog.card.photo.angle * Math.PI) / 180);
  });

  it('vẽ giờ 24/12 · 20:05 và ký tên', () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, 2100, base, assets as never);
    const texts = calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
    expect(texts).toContain('24/12 · 20:05');
    expect(texts).toContain('— Một người bạn');
  });
});
