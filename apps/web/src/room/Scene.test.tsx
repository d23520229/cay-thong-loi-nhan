import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Scene } from './Scene';
import { defaultRoom, drawOrder } from './model';

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

  it('món lật có scaleX(-1)', () => {
    const flipped = { ...room, items: room.items.map((i, k) => (k === 0 ? { ...i, flip: true } : i)) };
    const { container } = render(<Scene room={flipped} />);
    expect(find(container, flipped.items[0]!.clientId).style.transform).toContain('scaleX(-1)');
  });
});
