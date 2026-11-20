import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Scene } from './Scene';
import { defaultRoom, drawOrder } from './model';
import appCss from '../styles/app.css?raw';
import animCss from '../styles/room-animations.css?raw';

describe('Scene', () => {
  const room = defaultRoom();
  const find = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-client-id="${id}"]`)!;
  const byType = (t: string) => room.items.find((i) => i.type === t)!;

  it('dựng 7 món theo thứ tự drawOrder', () => {
    const { container } = render(<Scene room={room} />);
    const items = [...container.querySelectorAll('.item')];
    expect(items).toHaveLength(7);
    expect(items.map((e) => e.getAttribute('data-client-id'))).toEqual(
      drawOrder(room.items).map((i) => i.clientId),
    );
  });

  it('cây có thân, tán, đèn và sao', () => {
    const { container } = render(<Scene room={room} />);
    const tree = find(container, byType('tree').clientId);
    const imgs = [...tree.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(imgs).toHaveLength(2);
    expect(imgs.some((s) => s!.includes('trunk-straight-oak.webp'))).toBe(true);
    expect(imgs.some((s) => s!.includes('canopy-cloud3-teal.webp'))).toBe(true);
    expect(tree.querySelector('svg .top-star2')).not.toBeNull();
    expect(tree.querySelector('.sway2')).not.toBeNull();
  });

  it('lò sưởi có lửa, cửa sổ có tuyết, mèo là svg', () => {
    const { container } = render(<Scene room={room} />);
    expect(find(container, byType('fireplace').clientId).querySelector('svg .fire2, svg.fire2, .fire2')).not.toBeNull();
    expect(find(container, byType('window').clientId).querySelector('.win-snow')).not.toBeNull();
    const pet = find(container, byType('pet').clientId);
    expect(pet.querySelector('svg .pet')).not.toBeNull();
    expect(pet.querySelector('img')).toBeNull();
  });

  it('món đang chọn có class selected', () => {
    const id = byType('fireplace').clientId;
    const { container } = render(<Scene room={room} selectedId={id} />);
    expect(find(container, id)).toHaveClass('selected');
    expect(container.querySelectorAll('.selected')).toHaveLength(1);
  });

  it('class selected có viền nét đứt vàng như mẫu đã duyệt (không trùng room-animations.css)', () => {
    const rule = /\.item\.selected\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(/outline:\s*4px dashed #FFD86B/i);
    expect(rule).toMatch(/outline-offset:\s*8px/);
    expect(rule).toMatch(/border-radius:\s*14px/);
    expect(animCss).not.toMatch(/\.selected|\.item/);
  });

  it('món lật có scaleX(-1)', () => {
    const flipped = { ...room, items: room.items.map((i, k) => (k === 0 ? { ...i, flip: true } : i)) };
    const { container } = render(<Scene room={flipped} />);
    expect(find(container, flipped.items[0]!.clientId).style.transform).toContain('scaleX(-1)');
  });
});

describe('Scene hiệu ứng chạm', () => {
  const room = defaultRoom();
  const gift = room.items.find((i) => i.type === 'gift')!;
  const pet = room.items.find((i) => i.type === 'pet')!;
  const el = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-client-id="${id}"]`)!;

  it('fx gắn class lên món và vẽ .burst với đúng số .pt', () => {
    const { container } = render(<Scene room={room} fx={{ clientId: gift.clientId, fx: { cls: 'g-hop', burst: 'confetti' }, seed: 1 }} />);
    const g = el(container, gift.clientId);
    expect(g.classList.contains('g-hop')).toBe(true);
    expect(g.querySelector('.hop img')).not.toBeNull();
    expect(g.querySelectorAll('.burst .pt')).toHaveLength(16);
  });

  it('say hiện chữ', () => {
    const { container } = render(<Scene room={room} fx={{ clientId: pet.clientId, fx: { cls: 'p-talk', say: 'Meo~' }, seed: 1 }} />);
    expect(el(container, pet.clientId).querySelector('.say')?.textContent).toBe('Meo~');
  });

  it('onItemTap nhận clientId khi nhấn-thả (click), không phải khi vừa chạm xuống', () => {
    const taps: string[] = [];
    const { container } = render(<Scene room={room} onItemTap={(id) => taps.push(id)} />);
    fireEvent.pointerDown(el(container, gift.clientId));
    expect(taps).toEqual([]);
    fireEvent.click(el(container, gift.clientId));
    expect(taps).toEqual([gift.clientId]);
  });
});
