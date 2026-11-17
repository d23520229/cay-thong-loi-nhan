import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { catalog } from '../lib/catalog';
import {
  AddTray, BackgroundStrip, ItemToolbar, TreeStrip, VariantArrows, VariantStrip,
} from './Editor';
import { useDrag } from './drag';
import { cameraShift, type Fit } from './fit';
import { RoomStage } from './RoomStage';
import { useEditor, type EditorStore } from './store';

const DESKTOP_QUERY = '(min-width: 900px)';
const TOP_RESERVE = 56;

export function useIsDesktop(): boolean {
  const [on, setOn] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return on;
}

type Props = { store: EditorStore; topBar: ReactNode };

export function EditorLayout({ store, topBar }: Props) {
  const desktop = useIsDesktop();
  const room = useEditor(store, (s) => s.room);
  const selectedId = useEditor(store, (s) => s.selectedId);
  const panel = useEditor(store, (s) => s.panel);
  const selected = room.items.find((i) => i.clientId === selectedId) ?? null;

  const [fit, setFit] = useState<Fit | null>(null);
  const scaleRef = useRef(1);
  scaleRef.current = fit?.scale ?? 1;
  const { onItemPointerDown, itemRef } = useDrag(store, () => scaleRef.current);

  const layoutRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);

  // Dải đang mở che món đang chọn thì dời phòng lên (chỉ điện thoại).
  const stripOpen = panel === 'variant' || panel === 'tree' || panel === 'bg';
  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const dock = dockRef.current;
    if (desktop || !stripOpen || !selected || !fit || !layout || !dock) {
      setShift(0);
      return;
    }
    const v = catalog.items[selected.type]!.variants[selected.variant]!;
    const itemBottom = selected.y - v.ay * selected.scale + v.h * selected.scale;
    const obstacleTop = dock.getBoundingClientRect().top - layout.getBoundingClientRect().top;
    setShift(cameraShift(itemBottom, fit.top, fit.scale, obstacleTop));
  }, [desktop, stripOpen, selected, fit, panel]);

  const stage = (reserveTop: number) => (
    <RoomStage
      room={room}
      selectedId={selectedId}
      reserveTop={reserveTop}
      onFit={setFit}
      onItemPointerDown={onItemPointerDown}
      onBackgroundPointerDown={() => store.getState().select(null)}
      itemRef={itemRef}
    />
  );

  if (desktop) {
    return (
      <div ref={layoutRef} className="layout desktop">
        <aside className="col col-left scroll-y" data-testid="col-left">
          <h2 className="lab">Thêm đồ</h2>
          <AddTray store={store} mode="panel" />
          <h2 className="lab">Phông nền</h2>
          <BackgroundStrip store={store} mode="panel" />
        </aside>
        <div className="col-mid">
          <div className="col-mid-top">{topBar}</div>
          <div className="col-mid-stage">{stage(0)}</div>
        </div>
        <aside className="col col-right scroll-y" data-testid="col-right">
          {selected ? (
            <>
              <VariantArrows store={store} />
              {selected.type === 'tree'
                ? <TreeStrip store={store} mode="panel" />
                : <VariantStrip store={store} mode="panel" />}
              <ItemToolbar store={store} />
            </>
          ) : (
            <p className="hint">Chạm một món để chỉnh</p>
          )}
        </aside>
      </div>
    );
  }

  return (
    <div ref={layoutRef} className="layout phone">
      <div
        data-camera=""
        style={{ position: 'absolute', inset: 0, transform: shift ? `translateY(-${shift}px)` : 'translateY(0px)', transition: 'transform 250ms ease' }}
      >
        {stage(TOP_RESERVE)}
      </div>
      <div className="phone-top">{topBar}</div>
      <div ref={dockRef} data-dock="" className="dock">
        {panel === 'variant' ? <VariantStrip store={store} />
          : panel === 'tree' ? <TreeStrip store={store} />
          : panel === 'bg' ? <BackgroundStrip store={store} />
          : (
            <>
              <VariantArrows store={store} />
              <ItemToolbar store={store} />
            </>
          )}
      </div>
      <AddTray store={store} />
    </div>
  );
}
