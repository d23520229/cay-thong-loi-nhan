import { useState } from 'react';
import type { RoomItem } from '@ctln/shared';
import { petSVGSoft } from '@ctln/art/pets';
import { assetUrl, catalog, type ItemVariant } from '../lib/catalog';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { variantLabel } from './model';
import { useEditor, type EditorStore, type TreeTab } from './store';

type P = { store: EditorStore };
/** 'strip': dải ngang ở phòng điện thoại; 'panel': khối trong cột máy tính (lưới, không có nút Xong). */
type M = P & { mode?: 'strip' | 'panel' };

const useSelectedItem = (store: EditorStore) =>
  useEditor(store, (s) => s.room.items.find((i) => i.clientId === s.selectedId) ?? null);

export function VariantArrows({ store }: P) {
  const it = useSelectedItem(store);
  const label = useEditor(store, (s) => (s.selectedId ? variantLabel(s.room, s.selectedId) : ''));
  if (!it) return null;
  const { cycle } = store.getState();
  return (
    <div className="arrows">
      <button type="button" className="tb" aria-label="Kiểu trước" onClick={() => cycle(-1)}>‹</button>
      <span className="tb-name">{label}</span>
      <button type="button" className="tb" aria-label="Kiểu sau" onClick={() => cycle(1)}>›</button>
    </div>
  );
}

export function ItemToolbar({ store, showStyle = true }: P & { showStyle?: boolean }) {
  const it = useSelectedItem(store);
  if (!it) return null;
  const { scale, flip, openPanel, remove } = store.getState();
  const isTree = it.type === 'tree';
  return (
    <div className="toolbar" role="toolbar" aria-label="Chỉnh món đang chọn">
      <button type="button" className="tb" aria-label="Nhỏ hơn" onClick={() => scale(-1)}>−</button>
      <button type="button" className="tb" aria-label="To hơn" onClick={() => scale(1)}>＋</button>
      <button type="button" className="tb wide" aria-label="Lật" onClick={flip}>⇋ Lật</button>
      {showStyle ? (
        <button type="button" className="tb wide" aria-label="Đổi kiểu" onClick={() => openPanel(isTree ? 'tree' : 'variant')}>
          Đổi kiểu
        </button>
      ) : null}
      {isTree ? null : (
        <button type="button" className="tb wide" aria-label="Xoá" onClick={remove}>Xoá</button>
      )}
    </div>
  );
}

// Thú cưng vẽ bằng SVG (chuỗi tĩnh từ @ctln/art, không có dữ liệu người dùng) nên ảnh thu nhỏ cũng dùng SVG,
// giống Scene; các món khác dùng ảnh webp trong catalog.
function Thumb({ type, variant, def }: { type: string; variant: string; def: ItemVariant }) {
  if (catalog.items[type]!.render === 'svg-pet') {
    return (
      <svg viewBox="-70 -180 140 195" aria-hidden="true" dangerouslySetInnerHTML={{ __html: petSVGSoft(variant) }} />
    );
  }
  return <img src={assetUrl(def.asset!)} alt="" draggable={false} />;
}

export function VariantStrip({ store, mode = 'strip' }: M) {
  const it = useSelectedItem(store);
  if (!it || it.type === 'tree') return null;
  const variants = catalog.items[it.type]!.variants;
  return (
    <div className={mode === 'panel' ? 'strip-panel' : 'strip'}>
      <div className="scroll-x">
        {Object.entries(variants).map(([key, v]) => (
          <button
            key={key}
            type="button"
            className="thumb"
            aria-label={v.name}
            aria-pressed={it.variant === key}
            onClick={() => store.getState().setVariant(key)}
          >
            <Thumb type={it.type} variant={key} def={v} />
          </button>
        ))}
      </div>
      {mode === 'strip' ? <Button onClick={() => store.getState().openPanel(null)}>Xong</Button> : null}
    </div>
  );
}

const TREE_TABS: [TreeTab, string][] = [
  ['shape', 'Dáng'], ['palette', 'Màu'], ['trunk', 'Thân'], ['wood', 'Gỗ'], ['slots', 'Điểm nhắn'],
];

export function TreeStrip({ store, mode = 'strip' }: M) {
  const tab = useEditor(store, (s) => s.treeTab);
  const tree = useEditor(store, (s) => s.room.tree);
  const { setTree, setTreeTab, openPanel } = store.getState();
  const chip = (key: string, text: string, on: boolean, onClick: () => void, swatch?: string) =>
    swatch ? (
      <button key={key} type="button" className="sw2" aria-label={text} aria-pressed={on} style={{ background: swatch }} onClick={onClick} />
    ) : (
      <button key={key} type="button" className="chip" aria-pressed={on} onClick={onClick}>{text}</button>
    );
  return (
    <div className={mode === 'panel' ? 'strip-panel' : 'strip'}>
      <div className="tabs scroll-x" role="tablist">
        {TREE_TABS.map(([k, text]) => (
          <button key={k} type="button" role="tab" className="chip" aria-selected={tab === k} onClick={() => setTreeTab(k)}>
            {text}
          </button>
        ))}
      </div>
      <div className="scroll-x">
        {tab === 'shape' && Object.entries(catalog.tree.shapes).map(([k, v]) =>
          chip(k, v.name, tree.shape === k, () => setTree({ shape: k as typeof tree.shape })))}
        {tab === 'palette' && Object.entries(catalog.tree.palettes).map(([k, v]) =>
          chip(k, v.name, tree.palette === k, () => setTree({ palette: k as typeof tree.palette }), v.swatch))}
        {tab === 'trunk' && Object.entries(catalog.tree.trunkShapes).map(([k, v]) =>
          chip(k, v.name, tree.trunkShape === k, () => setTree({ trunkShape: k as typeof tree.trunkShape })))}
        {tab === 'wood' && Object.entries(catalog.tree.woods).map(([k, v]) =>
          chip(k, v.name, tree.wood === k, () => setTree({ wood: k as typeof tree.wood }), v.swatch))}
        {tab === 'slots' && catalog.tree.slotCounts.map((n) =>
          chip(String(n), String(n), tree.slotCount === n, () => setTree({ slotCount: n })))}
      </div>
      {mode === 'strip' ? <Button onClick={() => openPanel(null)}>Xong</Button> : null}
    </div>
  );
}

export function BackgroundStrip({ store, mode = 'strip' }: M) {
  const bg = useEditor(store, (s) => s.room.background);
  return (
    <div className={mode === 'panel' ? 'strip-panel' : 'strip'}>
      <div className="scroll-x">
        {Object.entries(catalog.backgrounds).map(([key, b]) => (
          <button
            key={key}
            type="button"
            className="thumb"
            aria-label={b.name}
            aria-pressed={bg === key}
            onClick={() => store.getState().setBackground(key)}
          >
            <img src={assetUrl(b.asset)} alt="" draggable={false} />
          </button>
        ))}
      </div>
      {mode === 'strip' ? <Button onClick={() => store.getState().openPanel(null)}>Xong</Button> : null}
    </div>
  );
}

const ADD_GROUPS = ['window', 'fireplace', 'rug', 'stack', 'gift', 'pet'] as const;

export function AddTray({ store, mode = 'strip' }: M) {
  const open = useEditor(store, (s) => s.panel === 'add');
  // Thân khay chỉ được dựng khi mở, nên thông báo "đủ 25 món" tự hết khi đóng khay.
  if (mode === 'panel') return <AddTrayBody store={store} mode="panel" />;
  return open ? <AddTrayBody store={store} /> : null;
}

function AddTrayBody({ store, mode = 'strip' }: M) {
  const [full, setFull] = useState(false);
  const body = (
    <>
      {full ? <div className="notice" role="alert">Phòng đã đủ 25 món</div> : null}
      {ADD_GROUPS.map((type) => {
        const def = catalog.items[type]!;
        return (
          <section key={type}>
            <h3 className="lab">{def.name}</h3>
            <div className="row">
              {Object.entries(def.variants).map(([key, v]) => (
                <button
                  key={key}
                  type="button"
                  className="thumb"
                  aria-label={v.name}
                  onClick={() => setFull(store.getState().add(type as RoomItem['type'], key) === 'too_many_items')}
                >
                  <Thumb type={type} variant={key} def={v} />
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
  return mode === 'panel' ? (
    <div className="panel-list">{body}</div>
  ) : (
    <Sheet title="Thêm đồ vào phòng" onClose={() => store.getState().openPanel(null)}>{body}</Sheet>
  );
}

const SAVE_TEXT = { saved: 'Đã lưu', saving: 'Đang lưu', unsaved: 'Chưa lưu' } as const;

export function EditorTopBar({
  store, onDone, doneLabel, saveState, showTools = true,
}: P & { onDone: () => void; doneLabel: 'Hoàn tất' | 'Xong'; saveState?: keyof typeof SAVE_TEXT; showTools?: boolean }) {
  const { openPanel } = store.getState();
  return (
    <div className="topbar">
      {showTools ? (
        <>
          <button type="button" className="pillbtn" onClick={() => openPanel('add')}>＋ Thêm đồ</button>
          <button type="button" className="pillbtn" onClick={() => openPanel('bg')}>Phông nền</button>
        </>
      ) : null}
      {saveState ? (
        <span className={`save save-${saveState}`}><i aria-hidden="true" />{SAVE_TEXT[saveState]}</span>
      ) : null}
      <Button variant="primary" onClick={onDone}>{doneLabel}</Button>
    </div>
  );
}
