import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Room } from '@ctln/shared';
import { catalog } from '../lib/catalog';
import { defaultRoom } from '../room/model';
import { bubblePlacement } from './geometry';
import { TreeBubble } from './TreeBubble';

const withTree = (over: Partial<{ x: number; y: number; scale: number; flip: boolean }>): Room => {
  const r = defaultRoom();
  return { ...r, items: r.items.map((i) => (i.type === 'tree' ? { ...i, ...over } : i)) };
};
const V = catalog.items.tree!.variants.main!;
const px = (s: string) => parseFloat(s);

describe('TreeBubble đung đưa theo cây', () => {
  it('khung bọc trùng khung cây và dùng cùng hiệu ứng đung đưa (sway2)', () => {
    const room = withTree({ x: 300, y: 950, scale: 0.8 });
    render(<TreeBubble room={room} text="Xin chào" />);
    const wrap = screen.getByText('Xin chào').parentElement!;
    expect(wrap).toHaveClass('sway2');
    expect(px(wrap.style.left)).toBeCloseTo(300 - V.ax * 0.8);
    expect(px(wrap.style.top)).toBeCloseTo(950 - V.ay * 0.8);
    expect(px(wrap.style.width)).toBeCloseTo(V.w * 0.8);
    expect(px(wrap.style.height)).toBeCloseTo(V.h * 0.8);
    expect(wrap.style.animationDelay).toBe('');
  });

  it('bong bóng vẫn ở đúng chỗ trong phòng (cách cây như cũ)', () => {
    const room = withTree({ x: 300, y: 950, scale: 0.8 });
    const p = bubblePlacement(room);
    render(<TreeBubble room={room} text="Xin chào" />);
    const bubble = screen.getByText('Xin chào');
    const wrap = bubble.parentElement!;
    expect(px(wrap.style.left) + px(bubble.style.left)).toBeCloseTo(p.x);
    expect(px(wrap.style.top) + px(bubble.style.top)).toBeCloseTo(p.y);
  });

  it('cây nửa phải: bong bóng bên trái, mép phải bong bóng tại điểm đuôi', () => {
    const room = withTree({ x: 520, y: 950, scale: 1 });
    const p = bubblePlacement(room);
    render(<TreeBubble room={room} text="Xin chào" />);
    const bubble = screen.getByText('Xin chào');
    const wrap = bubble.parentElement!;
    expect(px(wrap.style.left) + px(wrap.style.width) - px(bubble.style.right)).toBeCloseTo(p.x);
  });

  it('cây lật: lệch nửa chu kỳ để cùng nhịp với cây (xoay đảo chiều khi lật)', () => {
    render(<TreeBubble room={withTree({ flip: true })} text="Xin chào" />);
    expect(screen.getByText('Xin chào').parentElement!.style.animationDelay).toBe('-3s');
  });

  it('ẩn (không gỡ) để giữ nhịp với cây', () => {
    render(<TreeBubble room={defaultRoom()} text="Xin chào" hidden />);
    expect(screen.getByText('Xin chào')).not.toBeVisible();
  });
});
