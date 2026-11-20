import type { Room, RoomItem, TreeConfig } from '@ctln/shared';
import { catalog } from '../lib/catalog';

type Layer = 'wall' | 'floor' | 'rug';

export const layerOf = (type: RoomItem['type']): Layer => catalog.items[type]!.layer;

export const rank = (it: RoomItem): number => {
  const layer = layerOf(it.type);
  return (layer === 'wall' ? 0 : layer === 'rug' ? 2000 : 4000) + it.y;
};

export const drawOrder = (items: RoomItem[]): RoomItem[] =>
  items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => rank(a.it) - rank(b.it) || a.i - b.i)
    .map((e) => e.it);

export function clampPosition(type: RoomItem['type'], x: number, y: number): { x: number; y: number } {
  const floorY = catalog.room.floorY;
  const [lo, hi] = layerOf(type) === 'wall' ? [200, floorY - 20] : [floorY + 40, 1075];
  return { x: Math.max(10, Math.min(710, x)), y: Math.max(lo, Math.min(hi, y)) };
}

const updateItem = (room: Room, clientId: string, f: (it: RoomItem) => RoomItem): Room => {
  if (!room.items.some((i) => i.clientId === clientId)) return room;
  return { ...room, items: room.items.map((i) => (i.clientId === clientId ? f(i) : i)) };
};

export const moveItem = (room: Room, clientId: string, x: number, y: number): Room =>
  updateItem(room, clientId, (it) => ({ ...it, ...clampPosition(it.type, x, y) }));

export const scaleItem = (room: Room, clientId: string, dir: 1 | -1): Room =>
  updateItem(room, clientId, (it) => {
    const s = Math.round((it.scale + dir * 0.1) * 100) / 100;
    return { ...it, scale: Math.max(catalog.limits.scaleMin, Math.min(catalog.limits.scaleMax, s)) };
  });

export const flipItem = (room: Room, clientId: string): Room =>
  updateItem(room, clientId, (it) => ({ ...it, flip: !it.flip }));

const step = (keys: string[], cur: string, dir: 1 | -1): string => {
  const i = keys.indexOf(cur);
  return keys[(i + dir + keys.length) % keys.length]!;
};

export const setVariant = (room: Room, clientId: string, variant: string): Room =>
  updateItem(room, clientId, (it) => ({ ...it, variant }));

export const setBackground = (room: Room, background: string): Room => ({ ...room, background } as Room);

export const setTreeConfig = (room: Room, patch: Partial<TreeConfig>): Room => ({
  ...room,
  tree: { ...room.tree, ...patch },
});

export function cycleVariant(room: Room, clientId: string, dir: 1 | -1): Room {
  const it = room.items.find((i) => i.clientId === clientId);
  if (!it) return room;
  if (it.type === 'tree') {
    return setTreeConfig(room, {
      palette: step(Object.keys(catalog.tree.palettes), room.tree.palette, dir) as TreeConfig['palette'],
    });
  }
  return setVariant(room, clientId, step(Object.keys(catalog.items[it.type]!.variants), it.variant, dir));
}

export function variantLabel(room: Room, clientId: string): string {
  const it = room.items.find((i) => i.clientId === clientId);
  if (!it) return '';
  if (it.type === 'tree') {
    const keys = Object.keys(catalog.tree.palettes);
    return `Màu: ${catalog.tree.palettes[room.tree.palette]!.name} · ${keys.indexOf(room.tree.palette) + 1}/${keys.length}`;
  }
  const variants = catalog.items[it.type]!.variants;
  const keys = Object.keys(variants);
  return `${variants[it.variant]?.name ?? it.variant} · ${keys.indexOf(it.variant) + 1}/${keys.length}`;
}

export function makeClientId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % 36]).join('');
}

export function addItem(
  room: Room,
  type: RoomItem['type'],
  variant: string,
): { room: Room; clientId: string } | { error: 'too_many_items' } {
  if (room.items.length >= catalog.limits.maxItems) return { error: 'too_many_items' };
  const clientId = makeClientId();
  const item: RoomItem = {
    clientId,
    type,
    variant,
    x: 360,
    y: layerOf(type) === 'wall' ? 380 : 1000,
    scale: 1,
    flip: false,
  };
  return { room: { ...room, items: [...room.items, item] }, clientId };
}

export function removeItem(room: Room, clientId: string): Room {
  const it = room.items.find((i) => i.clientId === clientId);
  if (!it || it.type === 'tree') return room;
  return { ...room, items: room.items.filter((i) => i.clientId !== clientId) };
}

export const defaultRoom = (): Room => {
  const d = catalog.defaultRoom;
  return {
    background: d.background,
    tree: { ...d.tree },
    items: d.items.map((i) => ({ ...i, clientId: makeClientId() })),
  } as Room;
};
