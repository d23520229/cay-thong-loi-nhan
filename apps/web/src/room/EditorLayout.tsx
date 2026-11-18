import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react';
import { catalog } from '../lib/catalog';
import {
  AddTray, BackgroundStrip, EditorTopBar, ItemToolbar, TreeStrip, VariantArrows, VariantStrip,
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

type Props = { store: EditorStore; topBar: Omit<ComponentProps<typeof EditorTopBar>, 'store' | 'showTools'> };

export function EditorLayout({ store, topBar }: Props) {
  const desktop = useIsDesktop();
  const room = useEditor(store, (s) => s.room);
  const selectedId = useEditor(store, (s) => s.selectedId);
  const panel = useEditor(store, (s) => s.panel);
  const selected = room.items.find((i) => i.clientId === selectedId) ?? null;

  const [fit, setFit] = useState<Fit | null>(null);
  const scaleRef = useRef(1);
  scaleRef.current = fit?.scale ?? 1;
  // Đang giữ món thì không dời camera (phòng trượt dưới ngón tay làm món lệch khỏi ngón); thả ra mới dời.
  const [holding, setHolding] = useState(false);
  const { onItemPointerDown, itemRef } = useDrag(store, () => scaleRef.current, setHolding);

  const layoutRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);

  // Phần dưới (dải hoặc mũi tên + thanh công cụ) che món đang chọn thì dời phòng lên (chỉ điện thoại).
  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const dock = dockRef.current;
    if (holding) return;
    if (desktop || !selected || !fit || !layout || !dock) {
      setShift(0);
      return;
    }
    const v = catalog.items[selected.type]!.variants[selected.variant]!;
    const itemBottom = selected.y - v.ay * selected.scale + v.h * selected.scale;
    const obstacleTop = dock.getBoundingClientRect().top - layout.getBoundingClientRect().top;
    setShift(cameraShift(itemBottom, fit.top, fit.scale, obstacleTop));
  }, [desktop, selected, fit, panel, holding]);

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
      <div ref={layoutRef} className="layout layout-desktop">
        <aside className="side-col scroll-y" data-testid="col-left">
          <h2 className="lab">Thêm đồ</h2>
          <AddTray store={store} mode="panel" />
          <h2 className="lab">Phông nền</h2>
          <BackgroundStrip store={store} mode="panel" />
        </aside>
        <div className="col-mid">
          <div className="col-mid-top"><EditorTopBar store={store} showTools={false} {...topBar} /></div>
          <div className="col-mid-stage">{stage(0)}</div>
        </div>
        <aside className="side-col scroll-y" data-testid="col-right">
          {selected ? (
            <>
              <VariantArrows store={store} />
              {selected.type === 'tree'
                ? <TreeStrip store={store} mode="panel" />
                : <VariantStrip store={store} mode="panel" />}
              <ItemToolbar store={store} showStyle={false} />
            </>
          ) : (
            <p className="hint">Chạm một món để chỉnh</p>
          )}
        </aside>
      </div>
    );
  }

  return (
    <div ref={layoutRef} className="layout layout-phone">
      <div
        data-camera=""
        style={{ position: 'absolute', inset: 0, transform: shift ? `translateY(-${shift}px)` : 'translateY(0px)', transition: 'transform 250ms ease' }}
      >
        {stage(TOP_RESERVE)}
      </div>
      <div className="phone-top"><EditorTopBar store={store} {...topBar} /></div>
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
