import { useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { RoomItem } from '@ctln/shared';
import { clampPosition } from './model';
import type { EditorStore } from './store';

type Pt = { x: number; y: number };

export const dragPosition = (
  start: Pt,
  pointerStart: Pt,
  pointerNow: Pt,
  scale: number,
  type: RoomItem['type'],
): Pt =>
  clampPosition(
    type,
    start.x + (pointerNow.x - pointerStart.x) / scale,
    start.y + (pointerNow.y - pointerStart.y) / scale,
  );

const TAP_PX = 4;

export function createDragController(store: EditorStore, getScale: () => number) {
  const els = new Map<string, HTMLDivElement>();
  let activePointer: number | null = null;

  function onItemPointerDown(clientId: string, e: Pick<ReactPointerEvent<HTMLDivElement>, 'pointerId' | 'clientX' | 'clientY' | 'currentTarget'>) {
    if (activePointer !== null) return;
    const el = els.get(clientId) ?? e.currentTarget;
    store.getState().select(clientId);
    const item = store.getState().room.items.find((i) => i.clientId === clientId);
    if (!item) return;
    el.setPointerCapture?.(e.pointerId);
    activePointer = e.pointerId;
    const ps = { x: e.clientX, y: e.clientY };
    const start = { x: item.x, y: item.y };
    const scale = getScale();
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = ev.clientX - ps.x;
      const dy = ev.clientY - ps.y;
      if (!moved && Math.hypot(dx, dy) < TAP_PX) return;
      moved = true;
      const p = dragPosition(start, ps, { x: ev.clientX, y: ev.clientY }, scale, item.type);
      el.style.translate = `${p.x - start.x}px ${p.y - start.y}px`;
    };
    const finish = (ev: PointerEvent, commit: boolean) => {
      if (ev.pointerId !== e.pointerId) return;
      activePointer = null;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.style.translate = '';
      if (commit && moved) {
        const p = dragPosition(start, ps, { x: ev.clientX, y: ev.clientY }, scale, item.type);
        store.getState().move(clientId, p.x, p.y);
      }
    };
    const onUp = (ev: PointerEvent) => finish(ev, true);
    const onCancel = (ev: PointerEvent) => finish(ev, false);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
  }

  function itemRef(clientId: string, el: HTMLDivElement | null) {
    if (el) els.set(clientId, el);
    else els.delete(clientId);
  }

  return { onItemPointerDown, itemRef };
}

export function useDrag(store: EditorStore, getScale: () => number) {
  const latest = useRef(getScale);
  latest.current = getScale;
  return useMemo(() => createDragController(store, () => latest.current()), [store]);
}
