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
  const ev = (type: string, x: number, y: number, pointerId = 1) => {
    const e = new Event(type) as Event & { clientX: number; clientY: number; pointerId: number };
    Object.assign(e, { clientX: x, clientY: y, pointerId });
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
    down(100, 100);
    ev('pointermove', 140, 100);
    expect(el.style.translate).toBe('80px 0px');
    expect(store.getState().revision).toBe(0);
    ev('pointermove', 150, 100);
    expect(store.getState().revision).toBe(0);
    ev('pointerup', 150, 100);
    expect(el.style.translate).toBe('');
    const now = store.getState().room.items.find((i) => i.clientId === item.clientId)!;
    expect(now.x).toBe(Math.min(710, item.x + 100));
    expect(store.getState().revision).toBe(1);
  });
  it('con trỏ thứ hai bị bỏ qua, move đúng một lần', () => {
    const { store, item, el, down, ev } = setup();
    down(100, 100);
    down(500, 500);
    ev('pointermove', 140, 100);
    ev('pointermove', 900, 900, 2);
    expect(el.style.translate).toBe('80px 0px');
    ev('pointerup', 900, 900, 2);
    expect(store.getState().revision).toBe(0);
    ev('pointerup', 140, 100);
    expect(store.getState().revision).toBe(1);
    expect(store.getState().room.items.find((i) => i.clientId === item.clientId)!.x).toBe(item.x + 80);
  });
  it('kẹp ngay khi kéo (thú cưng kéo lên dừng ở y 810)', () => {
    const { el, item, down, ev } = setup();
    down(100, 500);
    ev('pointermove', 100, 0);
    expect(el.style.translate).toBe(`0px ${810 - item.y}px`);
  });
  it('pointercancel xoá translate, không move', () => {
    const { store, el, down, ev } = setup();
    down(100, 100);
    ev('pointermove', 140, 100);
    ev('pointercancel', 140, 100);
    expect(el.style.translate).toBe('');
    expect(store.getState().revision).toBe(0);
  });
  it('sau khi thả, pointermove không đặt translate', () => {
    const { el, down, ev } = setup();
    down(100, 100);
    ev('pointermove', 140, 100);
    ev('pointerup', 140, 100);
    ev('pointermove', 200, 100);
    expect(el.style.translate).toBe('');
  });
  it('mất bắt con trỏ giữa lúc kéo: dọn trạng thái và cho kéo lại', () => {
    const { store, el, down, ev } = setup();
    down(100, 100);
    ev('pointermove', 140, 100);
    ev('lostpointercapture', 140, 100);
    expect(el.style.translate).toBe('');
    expect(store.getState().revision).toBe(0);
    down(100, 100);
    ev('pointermove', 140, 100);
    expect(el.style.translate).toBe('80px 0px');
  });
});
