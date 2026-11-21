import { describe, expect, it } from 'vitest';
import { validateRoom } from '@ctln/shared';
import type { Room } from '@ctln/shared';
import {
  addItem, clampPosition, cycleVariant, defaultRoom, drawOrder, flipItem, layerOf, makeClientId,
  moveItem, rank, removeItem, sameRoom, scaleItem, setBackground, setTreeConfig, setVariant, variantLabel,
} from './model';

const find = (room: Room, type: string) => room.items.find((i) => i.type === type)!;

describe('defaultRoom', () => {
  it('hợp lệ, 7 món, clientId khác nhau', () => {
    const room = defaultRoom();
    expect(validateRoom(room)).toEqual({ ok: true });
    expect(room.items).toHaveLength(7);
    expect(new Set(room.items.map((i) => i.clientId)).size).toBe(7);
    for (const i of room.items) expect(i.clientId).toMatch(/^[a-z0-9]{12}$/);
  });
  it('makeClientId 12 ký tự a-z0-9', () => {
    expect(makeClientId()).toMatch(/^[a-z0-9]{12}$/);
  });
});

describe('thứ tự vẽ', () => {
  it('layerOf và rank', () => {
    expect(layerOf('window')).toBe('wall');
    expect(layerOf('rug')).toBe('rug');
    expect(layerOf('pet')).toBe('floor');
    expect(rank({ ...find(defaultRoom(), 'rug'), y: 100 })).toBe(2100);
  });
  it('drawOrder theo rank', () => {
    expect(drawOrder(defaultRoom().items).map((i) => i.type)).toEqual(
      ['window', 'rug', 'fireplace', 'tree', 'pet', 'gift', 'stack'],
    );
  });
  it('drawOrder ổn định khi bằng nhau', () => {
    const r = defaultRoom();
    const a = { ...find(r, 'pet'), clientId: 'aaaaaaaaaaaa', y: 900 };
    const b = { ...find(r, 'gift'), clientId: 'bbbbbbbbbbbb', y: 900 };
    expect(drawOrder([a, b]).map((i) => i.clientId)).toEqual(['aaaaaaaaaaaa', 'bbbbbbbbbbbb']);
    expect(drawOrder([b, a]).map((i) => i.clientId)).toEqual(['bbbbbbbbbbbb', 'aaaaaaaaaaaa']);
  });
});

describe('clampPosition / moveItem', () => {
  it('kẹp trong giới hạn', () => {
    expect(clampPosition('window', 5, 900)).toEqual({ x: 10, y: 750 });
    expect(clampPosition('window', 300, 100)).toEqual({ x: 300, y: 200 });
    expect(clampPosition('pet', 800, 100)).toEqual({ x: 710, y: 810 });
    expect(clampPosition('rug', 300, 1200)).toEqual({ x: 300, y: 1075 });
  });
  it('moveItem kẹp', () => {
    const r = defaultRoom();
    const next = moveItem(r, find(r, 'pet').clientId, 9999, 0);
    expect(find(next, 'pet')).toMatchObject({ x: 710, y: 810 });
  });
});

describe('scale / flip', () => {
  it('scale không vượt 1,6 và 0,5, không sai số', () => {
    const base = defaultRoom();
    const id = find(base, 'pet').clientId;
    let r = base;
    for (let i = 0; i < 7; i++) r = scaleItem(r, id, 1);
    expect(find(r, 'pet').scale).toBe(1.6);
    r = base;
    for (let i = 0; i < 6; i++) r = scaleItem(r, id, -1);
    expect(find(r, 'pet').scale).toBe(0.5);
    r = base;
    for (let i = 0; i < 3; i++) r = scaleItem(r, id, -1);
    expect(find(r, 'pet').scale).toBe(0.7);
  });
  it('flipItem đảo', () => {
    const r = defaultRoom();
    const it = find(r, 'pet');
    expect(find(flipItem(r, it.clientId), 'pet').flip).toBe(!it.flip);
  });
});

describe('biến thể', () => {
  it('cycleVariant lò sưởi', () => {
    const r = defaultRoom();
    const f = find(r, 'fireplace');
    expect(f.variant).toBe('classic');
    expect(find(cycleVariant(r, f.clientId, 1), 'fireplace').variant).toBe('stove');
    expect(find(cycleVariant(r, f.clientId, -1), 'fireplace').variant).toBe('tiled');
  });
  it('cây đổi palette', () => {
    const r = defaultRoom();
    const t = find(r, 'tree');
    expect(r.tree.palette).toBe('teal');
    const next = cycleVariant(r, t.clientId, 1);
    expect(next.tree.palette).toBe('green');
    expect(variantLabel(next, t.clientId)).toBe('Màu: Xanh lá · 2/6');
    expect(variantLabel(r, t.clientId)).toBe('Màu: Xanh ngọc · 1/6');
  });
  it('variantLabel thường', () => {
    const r = defaultRoom();
    expect(variantLabel(r, find(r, 'fireplace').clientId)).toMatch(/ · 1\/\d+$/);
  });
  it('setVariant, setBackground, setTreeConfig', () => {
    const r = defaultRoom();
    expect(find(setVariant(r, find(r, 'fireplace').clientId, 'stove'), 'fireplace').variant).toBe('stove');
    expect(setBackground(r, 'wood').background).toBe('wood');
    expect(setTreeConfig(r, { shape: 'puffy' }).tree).toEqual({ ...r.tree, shape: 'puffy' });
  });
  it('setTreeConfig với giá trị đang có trả nguyên tham chiếu phòng', () => {
    const r = defaultRoom();
    expect(setTreeConfig(r, { shape: r.tree.shape })).toBe(r);
    expect(setTreeConfig(r, { shape: r.tree.shape, slotCount: r.tree.slotCount })).toBe(r);
  });
  it('setTreeConfig đổi thật vẫn ra object mới', () => {
    const r = defaultRoom();
    const next = setTreeConfig(r, { slotCount: r.tree.slotCount + 1 });
    expect(next).not.toBe(r);
    expect(next.tree.slotCount).toBe(r.tree.slotCount + 1);
  });
  it('setBackground với phông đang có trả nguyên tham chiếu', () => {
    const r = defaultRoom();
    expect(setBackground(r, r.background)).toBe(r);
  });
  it('setBackground đổi thật vẫn ra object mới', () => {
    const r = defaultRoom();
    const next = setBackground(r, 'wood');
    expect(next).not.toBe(r);
    expect(next.background).toBe('wood');
  });
});

describe('addItem / removeItem', () => {
  it('đặt đúng chỗ', () => {
    const r = defaultRoom();
    const g = addItem(r, 'gift', 'gold');
    if (!('room' in g)) throw new Error('lỗi');
    expect(g.room.items.find((i) => i.clientId === g.clientId)).toMatchObject({
      type: 'gift', variant: 'gold', x: 360, y: 1000, scale: 1, flip: false,
    });
    const w = addItem(r, 'window', 'white');
    if (!('room' in w)) throw new Error('lỗi');
    expect(w.room.items.find((i) => i.clientId === w.clientId)).toMatchObject({ x: 360, y: 380 });
  });
  it('tối đa 25 món', () => {
    let r = defaultRoom();
    while (r.items.length < 25) {
      const res = addItem(r, 'gift', 'gold');
      if (!('room' in res)) throw new Error('sớm');
      r = res.room;
    }
    expect(addItem(r, 'gift', 'gold')).toEqual({ error: 'too_many_items' });
  });
  it('removeItem: không xoá cây; xoá mèo', () => {
    const r = defaultRoom();
    expect(removeItem(r, find(r, 'tree').clientId)).toBe(r);
    expect(removeItem(r, find(r, 'pet').clientId).items).toHaveLength(6);
  });
  it('clientId không tồn tại trả phòng cũ', () => {
    const r = defaultRoom();
    expect(moveItem(r, 'nope', 1, 1)).toBe(r);
    expect(scaleItem(r, 'nope', 1)).toBe(r);
    expect(flipItem(r, 'nope')).toBe(r);
    expect(cycleVariant(r, 'nope', 1)).toBe(r);
    expect(removeItem(r, 'nope')).toBe(r);
  });
});

describe('bất biến', () => {
  it('không sửa phòng đầu vào', () => {
    const r = defaultRoom();
    const before = structuredClone(r);
    const id = find(r, 'pet').clientId;
    const tid = find(r, 'tree').clientId;
    moveItem(r, id, 1, 1); scaleItem(r, id, 1); flipItem(r, id); cycleVariant(r, id, 1);
    cycleVariant(r, tid, 1); setVariant(r, id, 'x'); setBackground(r, 'wood');
    setTreeConfig(r, { shape: 'puffy' }); addItem(r, 'gift', 'gold'); removeItem(r, id);
    expect(r).toEqual(before);
  });
});

describe('sameRoom', () => {
  it('khác thứ tự món vẫn giống; khác x / variant / slotCount / background → khác', () => {
    const a = defaultRoom();
    const copy = (): Room => structuredClone(a);
    expect(sameRoom(a, copy())).toBe(true);
    const rev = copy();
    rev.items.reverse();
    expect(sameRoom(a, rev)).toBe(true);
    const x = copy();
    x.items[0] = { ...x.items[0]!, x: x.items[0]!.x + 1 };
    expect(sameRoom(a, x)).toBe(false);
    const v = copy();
    v.items[0] = { ...v.items[0]!, variant: v.items[0]!.variant + 'z' };
    expect(sameRoom(a, v)).toBe(false);
    expect(sameRoom(a, { ...a, tree: { ...a.tree, slotCount: 16 } })).toBe(false);
    expect(sameRoom(a, { ...a, background: 'wood' } as Room)).toBe(false);
    expect(sameRoom(a, { ...a, items: a.items.slice(1) })).toBe(false);
  });
});
