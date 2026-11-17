import { describe, expect, it, vi } from 'vitest';
import { dragPosition, createDragController } from './drag';
import { createEditorStore } from './store';
import { defaultRoom } from './model';

describe('dragPosition', () => {
  it('chia theo tỉ lệ và kẹp vào vùng cho phép', () => {
    expect(dragPosition({ x: 300, y: 900 }, { x: 100, y: 100 }, { x: 150, y: 50 }, 0.5, 'pet')).toEqual({ x: 400, y: 810 });
  });
  it('kẹp x trong 10..710', () => {
    expect(dragPosition({ x: 300, y: 1000 }, { x: 0, y: 0 }, { x: 2000, y: 0 }, 1, 'pet').x).toBe(710);
  });
});

// jsdom không điền clientX cho PointerEvent, nên thử qua bộ điều khiển với sự kiện giả.
function setup() {
  const store = createEditorStore(defaultRoom());
  const item = store.getState().room.items.find((i) => i.type === 'pet')!;
  const el = document.createElement('div');
  el.setPointerCapture = vi.fn();
  const drag = createDragController(store, () => 0.5);
  drag.itemRef(item.clientId, el);
  const down = (x: number, y: number) =>
    drag.onItemPointerDown(item.clientId, { pointerId: 1, clientX: x, clientY: y, currentTarget: el } as never);
  const ev = (type: string, x: number, y: number) => {
    const e = new Event(type) as Event & { clientX: number; clientY: number; pointerId: number };
    Object.assign(e, { clientX: x, clientY: y, pointerId: 1 });
    el.dispatchEvent(e);
  };
  return { store, item, el, down, ev };
}

describe('createDragController', () => {
  it('chạm: chọn món và bắt con trỏ', () => {
    const { store, item, el, down, ev } = setup();
    down(100, 100);
    expect(store.getState().selectedId).toBe(item.clientId);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    ev('pointerup', 102, 101);
    expect(store.getState().revision).toBe(0);
    expect(store.getState().room.items.find((i) => i.clientId === item.clientId)).toEqual(item);
  });
  it('kéo: chỉ đặt translate, thả mới gọi move một lần', () => {
    const { store, item, el, down, ev } = setup();
    const move = vi.spyOn(store.getState(), 'move');
    down(100, 100);
    ev('pointermove', 140, 100);
    expect(el.style.translate).toBe('80px 0px');
    expect(store.getState().revision).toBe(0);
    ev('pointermove', 150, 100);
    expect(move).not.toHaveBeenCalled();
    ev('pointerup', 150, 100);
    expect(el.style.translate).toBe('');
    expect(move).toHaveBeenCalledTimes(1);
    const now = store.getState().room.items.find((i) => i.clientId === item.clientId)!;
    expect(now.x).toBe(Math.min(710, item.x + 100));
    expect(store.getState().revision).toBe(1);
  });
});
