import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/index.mjs';
import {
  RoomSchema,
  CreateTreeBodySchema,
  MessageBodySchema,
  MessageEditSchema,
  validateRoom,
} from '../src/schemas.mjs';

const defaultRoom = () => ({
  ...structuredClone(catalog.defaultRoom),
  items: catalog.defaultRoom.items.map((it, i) => ({ ...it, clientId: `i${i}` })),
});
const item = (over) => ({
  clientId: 'x', type: 'gift', variant: 'red', x: 300, y: 900, scale: 1, flip: false, ...over,
});

test('defaultRoom hợp lệ qua RoomSchema và validateRoom', () => {
  const room = RoomSchema.parse(defaultRoom());
  assert.deepEqual(validateRoom(room), { ok: true });
});

test('validateRoom: quá 25 món', () => {
  const room = defaultRoom();
  room.items = [room.items.find((i) => i.type === 'tree')];
  for (let i = 0; i < 25; i++) room.items.push(item({ clientId: `g${i}` }));
  const r = validateRoom(room);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'too_many_items');
  assert.ok(r.message);
});

test('validateRoom: số cây phải đúng 1', () => {
  const room = defaultRoom();
  const noTree = { ...room, items: room.items.filter((i) => i.type !== 'tree') };
  assert.equal(validateRoom(noTree).code, 'tree_count');
  const tree = room.items.find((i) => i.type === 'tree');
  const two = { ...room, items: [...room.items, { ...tree, clientId: 't2' }] };
  assert.equal(validateRoom(two).code, 'tree_count');
});

test('validateRoom: lớp tường/sàn', () => {
  const room = defaultRoom();
  const wall = { ...room, items: [...room.items, item({ clientId: 'w', type: 'window', variant: 'wood', y: 800 })] };
  assert.equal(validateRoom(wall).code, 'wall_only');
  const floor = { ...room, items: [...room.items, item({ clientId: 'p', type: 'pet', variant: 'cat', y: 700 })] };
  assert.equal(validateRoom(floor).code, 'floor_only');
});

test('validateRoom: variant lạ và clientId trùng', () => {
  const room = defaultRoom();
  const v = { ...room, items: [...room.items, item({ clientId: 'v', variant: 'purple' })] };
  assert.equal(validateRoom(v).code, 'unknown_variant');
  const d = { ...room, items: [...room.items, item({ clientId: 'i0' })] };
  assert.equal(validateRoom(d).code, 'duplicate_client_id');
});

test('RoomItemSchema: biên toạ độ và scale', () => {
  const base = defaultRoom();
  for (const bad of [{ x: 721 }, { y: 1081 }, { scale: 0.4 }, { scale: 1.7 }]) {
    const room = { ...base, items: [{ ...base.items[0], ...bad }] };
    assert.equal(RoomSchema.safeParse(room).success, false);
  }
});

const msg = (over) => ({ slotIndex: 0, ornament: 'star', anonymous: true, content: 'Chúc mừng', ...over });

test('MessageBodySchema: độ dài tính theo ký tự Unicode', () => {
  assert.equal(MessageBodySchema.safeParse(msg({ content: '🎄'.repeat(300) })).success, true);
  assert.equal(MessageBodySchema.safeParse(msg({ content: '🎄'.repeat(301) })).success, false);
  assert.equal(MessageBodySchema.safeParse(msg({ content: '   ' })).success, false);
});

test('MessageBodySchema: tên theo anonymous, ornament hợp lệ', () => {
  assert.equal(MessageBodySchema.safeParse(msg({ anonymous: false })).success, false);
  assert.equal(MessageBodySchema.safeParse(msg({ anonymous: false, authorName: 'An' })).success, true);
  assert.equal(MessageBodySchema.safeParse(msg({ anonymous: true, authorName: 'An' })).success, false);
  assert.equal(MessageBodySchema.safeParse(msg({ ornament: 'dragon' })).success, false);
});

test('MessageEditSchema: không có slotIndex/website, vẫn refine', () => {
  const ok = MessageEditSchema.safeParse({ ornament: 'star', anonymous: true, content: 'Hi' });
  assert.equal(ok.success, true);
  assert.equal('slotIndex' in ok.data, false);
  assert.equal(MessageEditSchema.safeParse({ ornament: 'star', anonymous: false, content: 'Hi' }).success, false);
});

test('CreateTreeBodySchema: PIN 6 số', () => {
  const body = (pin) => ({ ownerName: 'Lan', recovery: { type: 'pin', pin }, room: defaultRoom() });
  assert.equal(CreateTreeBodySchema.safeParse(body('12345')).success, false);
  assert.equal(CreateTreeBodySchema.safeParse(body('123456')).success, true);
});

test('validateRoom: variant/type kế thừa từ prototype bị từ chối', () => {
  const room = defaultRoom();
  for (const variant of ['constructor', 'toString', '__proto__']) {
    const r = validateRoom({ ...room, items: [...room.items, item({ clientId: 'v', variant })] });
    assert.equal(r.code, 'unknown_variant', variant);
  }
  const t = validateRoom({ ...room, items: [...room.items, item({ clientId: 'v', type: 'constructor' })] });
  assert.equal(t.ok, false);
});
