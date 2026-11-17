import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Room, RoomItem, TreeConfig } from '@ctln/shared';
import {
  addItem, cycleVariant, flipItem, moveItem, removeItem, scaleItem, setBackground, setTreeConfig, setVariant,
} from './model';

export type Panel = null | 'add' | 'bg' | 'variant' | 'tree';
export type TreeTab = 'shape' | 'palette' | 'trunk' | 'wood' | 'slots';

export interface EditorState {
  room: Room;
  selectedId: string | null;
  panel: Panel;
  treeTab: TreeTab;
  revision: number;
  select: (id: string | null) => void;
  move: (id: string, x: number, y: number) => void;
  scale: (dir: 1 | -1) => void;
  flip: () => void;
  cycle: (dir: 1 | -1) => void;
  setVariant: (v: string) => void;
  setBackground: (bg: string) => void;
  setTree: (patch: Partial<TreeConfig>) => void;
  add: (type: RoomItem['type'], variant: string) => 'too_many_items' | undefined;
  remove: () => void;
  openPanel: (p: Panel) => void;
  setTreeTab: (t: TreeTab) => void;
  replaceRoom: (room: Room) => void;
}

export type EditorStore = StoreApi<EditorState>;

export function createEditorStore(initial: Room): EditorStore {
  return createStore<EditorState>()((set, get) => {
    // Chỉ tăng revision khi model trả về phòng mới (không đổi → cùng tham chiếu).
    const apply = (f: (room: Room) => Room) =>
      set((s) => {
        const room = f(s.room);
        return room === s.room ? s : { room, revision: s.revision + 1 };
      });
    const withSelected = (f: (room: Room, id: string) => Room) => {
      const id = get().selectedId;
      if (id) apply((r) => f(r, id));
    };
    return {
      room: initial,
      selectedId: null,
      panel: null,
      treeTab: 'shape',
      revision: 0,
      select: (id) => set({ selectedId: id }),
      move: (id, x, y) => apply((r) => moveItem(r, id, x, y)),
      scale: (dir) => withSelected((r, id) => scaleItem(r, id, dir)),
      flip: () => withSelected(flipItem),
      cycle: (dir) => withSelected((r, id) => cycleVariant(r, id, dir)),
      setVariant: (v) => withSelected((r, id) => setVariant(r, id, v)),
      setBackground: (bg) => apply((r) => setBackground(r, bg)),
      setTree: (patch) => apply((r) => setTreeConfig(r, patch)),
      add: (type, variant) => {
        const res = addItem(get().room, type, variant);
        if ('error' in res) return res.error;
        set((s) => ({ room: res.room, selectedId: res.clientId, panel: null, revision: s.revision + 1 }));
        return undefined;
      },
      remove: () => {
        const id = get().selectedId;
        if (!id) return;
        const room = removeItem(get().room, id);
        if (room === get().room) return;
        set((s) => ({ room, selectedId: null, revision: s.revision + 1 }));
      },
      openPanel: (panel) => set({ panel }),
      setTreeTab: (treeTab) => set({ treeTab }),
      replaceRoom: (room) => set({ room }),
    };
  });
}

export const useEditor = <T,>(store: EditorStore, selector: (s: EditorState) => T): T =>
  useStore(store, selector);
