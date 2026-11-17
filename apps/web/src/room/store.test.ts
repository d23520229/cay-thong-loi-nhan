import { describe, expect, it } from 'vitest';
import { createEditorStore } from './store';
import { defaultRoom } from './model';

const make = () => createEditorStore(defaultRoom());

describe('editor store', () => {
  it('add chọn món mới, đóng khay, tăng revision 1', () => {
    const s = make();
    s.getState().openPanel('add');
    const r0 = s.getState().revision;
    const res = s.getState().add('gift', 'gold');
    expect(res).toBeUndefined();
    const st = s.getState();
    const added = st.room.items.at(-1)!;
    expect(added.type).toBe('gift');
    expect(st.selectedId).toBe(added.clientId);
    expect(st.panel).toBeNull();
    expect(st.revision).toBe(r0 + 1);
  });
  it('vượt giới hạn trả too_many_items', () => {
    const s = make();
    let res;
    for (let i = 0; i < 30; i++) res = s.getState().add('gift', 'gold') ?? res;
    expect(res).toBe('too_many_items');
    expect(s.getState().room.items).toHaveLength(25);
  });
  it('replaceRoom không tăng revision', () => {
    const s = make();
    s.getState().replaceRoom(defaultRoom());
    expect(s.getState().revision).toBe(0);
  });
  it('remove khi chọn cây: phòng không đổi', () => {
    const s = make();
    const tree = s.getState().room.items.find((i) => i.type === 'tree')!;
    s.getState().select(tree.clientId);
    const before = s.getState().room;
    s.getState().remove();
    expect(s.getState().room).toBe(before);
    expect(s.getState().revision).toBe(0);
  });
  it('remove món thường: bỏ chọn, tăng revision', () => {
    const s = make();
    s.getState().add('gift', 'gold');
    const id = s.getState().selectedId!;
    s.getState().remove();
    expect(s.getState().selectedId).toBeNull();
    expect(s.getState().room.items.some((i) => i.clientId === id)).toBe(false);
    expect(s.getState().revision).toBe(2);
  });
  it('cycle khi chưa chọn: không đổi', () => {
    const s = make();
    const before = s.getState().room;
    s.getState().cycle(1);
    expect(s.getState().room).toBe(before);
    expect(s.getState().revision).toBe(0);
  });
  it('move, scale, flip, setVariant, setBackground, setTree tăng revision', () => {
    const s = make();
    const pet = s.getState().room.items.find((i) => i.type === 'pet')!;
    s.getState().select(pet.clientId);
    s.getState().move(pet.clientId, 200, 1000);
    s.getState().scale(1);
    s.getState().flip();
    s.getState().setTree({ shape: 'slim' } as never);
    s.getState().setBackground(s.getState().room.background);
    expect(s.getState().revision).toBe(5);
    const p = s.getState().room.items.find((i) => i.clientId === pet.clientId)!;
    expect(p.x).toBe(200);
    expect(p.flip).toBe(!pet.flip);
  });
  it('openPanel và setTreeTab', () => {
    const s = make();
    s.getState().openPanel('tree');
    s.getState().setTreeTab('wood');
    expect(s.getState().panel).toBe('tree');
    expect(s.getState().treeTab).toBe('wood');
  });
});

describe('select(null) và panel', () => {
  it('đóng dải kiểu/cây, giữ phông nền và khay thêm đồ', () => {
    const s = createEditorStore(defaultRoom());
    const id = s.getState().room.items.find((i) => i.type === 'gift')!.clientId;
    for (const [panel, kept] of [['variant', null], ['tree', null], ['bg', 'bg'], ['add', 'add']] as const) {
      s.getState().select(id);
      s.getState().openPanel(panel);
      s.getState().select(null);
      expect(s.getState().panel).toBe(kept);
    }
  });
});
