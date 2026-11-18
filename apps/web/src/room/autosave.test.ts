import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@ctln/shared';
import { ApiError, type PublicRoom } from '../lib/api';
import { createAutosave } from './autosave';
import { defaultRoom } from './model';
import { createEditorStore, type EditorStore } from './store';

type SaveFn = (id: string, roomVersion: number, room: Room) => Promise<{ roomVersion: number }>;

function setup(opts: { version?: number; store?: EditorStore; saveRoom?: SaveFn } = {}) {
  const store = opts.store ?? createEditorStore(defaultRoom());
  const saveRoom = vi.fn<SaveFn>(opts.saveRoom ?? (async () => ({ roomVersion: 4 })));
  const cb = {
    onState: vi.fn(),
    onConflict: vi.fn(),
    onSlotsInUse: vi.fn(),
    onWriteClosed: vi.fn(),
    onUnauthorized: vi.fn(),
    onOffline: vi.fn(),
    onRateLimited: vi.fn(),
    onGone: vi.fn(),
  };
  const a = createAutosave({ treeId: 't1', store, version: opts.version ?? 3, api: { saveRoom }, ...cb });
  return { store, saveRoom, a, ...cb };
}

const serverRoom = (room: Room, roomVersion: number): PublicRoom => ({
  id: 't1', ownerName: 'An', title: null, ...room, slots: [], roomVersion, phase: 'BUILD',
});

let stops: (() => void)[] = [];
const track = <T extends { a: { stop(): void } }>(x: T) => (stops.push(() => x.a.stop()), x);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  stops.forEach((s) => s());
  stops = [];
  vi.useRealTimers();
});

describe('autosave', () => {
  it('gộp các thay đổi: 1 lần saveRoom sau 1500ms kể từ thay đổi cuối; thành công cập nhật version', async () => {
    const t = track(setup());
    const st = t.store.getState();
    st.setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(500);
    st.setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(500);
    st.setTree({ slotCount: 20 });
    await vi.advanceTimersByTimeAsync(1499);
    expect(t.saveRoom).not.toHaveBeenCalled();
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    expect(t.saveRoom).toHaveBeenCalledWith('t1', 3, t.store.getState().room);
    expect(t.a.version()).toBe(4);
    expect(t.onState.mock.calls.map((c) => c[0]).slice(-2)).toEqual(['saving', 'saved']);
  });

  it('phòng đã tạo không ghi nháp draft:{treeId} (đặc tả 6.5, chốt 19/11), kể cả khi lưu lỗi', async () => {
    const t = track(setup());
    t.saveRoom.mockRejectedValue(new ApiError(0, 'network', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
  });

  it('409 version_conflict → onConflict; keepMine gửi với roomVersion mới; useLatest thay phòng', async () => {
    const other = defaultRoom();
    other.background = 'night';
    const server = serverRoom(other, 7);
    const t = track(
      setup({
        saveRoom: async () => {
          throw new ApiError(409, 'version_conflict', 'x', { room: server });
        },
      }),
    );
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onConflict).toHaveBeenCalledWith(server);
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');

    t.saveRoom.mockResolvedValueOnce({ roomVersion: 8 });
    t.a.keepMine(server);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saveRoom).toHaveBeenLastCalledWith('t1', 7, t.store.getState().room);
    expect(t.store.getState().room.tree.slotCount).toBe(9);
    expect(t.a.version()).toBe(8);

    t.store.getState().setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onConflict).toHaveBeenCalledTimes(2);
    const calls = t.saveRoom.mock.calls.length;
    t.a.useLatest(server);
    expect(t.store.getState().room).toEqual({ background: 'night', tree: other.tree, items: other.items });
    expect(t.a.version()).toBe(7);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
    await vi.advanceTimersByTimeAsync(10000);
    expect(t.saveRoom).toHaveBeenCalledTimes(calls);
  });

  it('409 slots_in_use → trả slotCount về giá trị đã lưu, onSlotsInUse nhận message server', async () => {
    const t = track(
      setup({
        saveRoom: async (_id, _v, room) => {
          if (room.tree.slotCount === 9) throw new ApiError(409, 'slots_in_use', 'Đã có lời nhắn ở điểm 10.');
          return { roomVersion: 4 };
        },
      }),
    );
    expect(t.store.getState().room.tree.slotCount).toBe(12);
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.store.getState().room.tree.slotCount).toBe(12);
    expect(t.onSlotsInUse).toHaveBeenCalledWith('Đã có lời nhắn ở điểm 10.');
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
  });

  it('lỗi mạng → unsaved, onOffline 1 lần, không tự thử lại (kể cả sau 5 giây, 60 giây, sự kiện online)', async () => {
    const t = track(
      setup({
        saveRoom: async () => {
          throw new ApiError(0, 'network', 'mất mạng');
        },
      }),
    );
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
    expect(t.onOffline).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
  });

  it('lỗi 500 cũng không tự thử lại', async () => {
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(500, 'internal', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onOffline).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
  });

  it('mất mạng → thao tác tiếp theo lưu lại cả phòng sau 1,5 giây (gồm thay đổi trước); thông báo chỉ một lần', async () => {
    const t = track(setup());
    t.saveRoom
      .mockRejectedValueOnce(new ApiError(0, 'network', 'x'))
      .mockRejectedValueOnce(new ApiError(0, 'network', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    t.store.getState().setBackground('night');
    await vi.advanceTimersByTimeAsync(1499);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.onOffline).toHaveBeenCalledTimes(1);
    t.store.getState().setTree({ slotCount: 25 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(3);
    const [, version, room] = t.saveRoom.mock.calls[2]!;
    expect(version).toBe(3);
    expect(room.background).toBe('night');
    expect(room.tree.slotCount).toBe(25);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
    expect(t.a.version()).toBe(4);
  });

  it('429 → onRateLimited (không phải onOffline), thử lại sau 60 giây chứ không phải 5 giây', async () => {
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(429, 'rate_limited', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onRateLimited).toHaveBeenCalledTimes(1);
    expect(t.onOffline).not.toHaveBeenCalled();
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
    t.store.getState().setTree({ slotCount: 16 }); // sửa tiếp trong lúc bị giới hạn cũng không gửi sớm
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000 - 5000 - 1);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.saveRoom.mock.calls[1]![2].tree.slotCount).toBe(16);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
  });

  it('429 → đã hẹn thử lại 60 giây → stop() (như "Xong"/rời trang) thì không gửi gì nữa', async () => {
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(429, 'rate_limited', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onRateLimited).toHaveBeenCalledTimes(1);
    t.a.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
  });

  it('đã gửi 540 lần trong một giờ → lần sửa sau chờ 60 giây; quá một giờ thì về 1,5 giây', async () => {
    const t = track(setup());
    for (let k = 0; k < 540; k++) {
      t.store.getState().setTree({ slotCount: k % 2 ? 12 : 9 });
      await vi.advanceTimersByTimeAsync(1500);
    }
    expect(t.saveRoom).toHaveBeenCalledTimes(540);
    t.store.getState().setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(540);
    await vi.advanceTimersByTimeAsync(60000 - 1500 - 1);
    expect(t.saveRoom).toHaveBeenCalledTimes(540);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.saveRoom).toHaveBeenCalledTimes(541);
    expect(t.onRateLimited).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3600000);
    t.store.getState().setTree({ slotCount: 20 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(542);
  });

  it('404 (cây đã bị xoá) → onGone, dừng tự lưu', async () => {
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(404, 'not_found', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onGone).toHaveBeenCalledTimes(1);
    expect(t.onOffline).not.toHaveBeenCalled();
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
    t.store.getState().setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(70000);
    await t.a.flush();
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
  });

  it('403 write_closed → onWriteClosed; 401 → onUnauthorized', async () => {
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(403, 'write_closed', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onWriteClosed).toHaveBeenCalledTimes(1);
    t.saveRoom.mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'x'));
    t.store.getState().setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
    expect(t.onOffline).not.toHaveBeenCalled();
  });

  it('chỉ một lần lưu cùng lúc; thay đổi trong lúc lưu được gửi sau với version mới', async () => {
    let release!: (v: { roomVersion: number }) => void;
    const t = track(setup());
    t.saveRoom.mockImplementationOnce(() => new Promise((r) => (release = r)));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    t.store.getState().setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    release({ roomVersion: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.saveRoom).toHaveBeenLastCalledWith('t1', 4, t.store.getState().room);
    expect(t.store.getState().room.tree.slotCount).toBe(16);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
  });

  it('phòng không qua validateRoom thì không gửi, unsaved', async () => {
    const bad = defaultRoom();
    const t = track(setup({ store: createEditorStore(bad) }));
    const tree = bad.items.find((i) => i.type === 'tree')!;
    t.store.setState((s) => ({ room: { ...s.room, items: [...s.room.items, { ...tree }] }, revision: s.revision + 1 }));
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).not.toHaveBeenCalled();
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
  });

  it('flush gửi ngay; stop huỷ hẹn và bỏ theo dõi thay đổi', async () => {
    const t = track(setup());
    t.store.getState().setTree({ slotCount: 9 });
    await t.a.flush();
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    expect(t.a.version()).toBe(4);

    t.saveRoom.mockRejectedValueOnce(new ApiError(0, 'network', 'x'));
    t.store.getState().setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    t.a.stop();
    t.store.getState().setTree({ slotCount: 20 });
    await vi.advanceTimersByTimeAsync(10000);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
  });
  it('sau stop(), lượt lưu đang chạy xong (thành công hay lỗi) không gọi callback nào', async () => {
    let release!: (v: { roomVersion: number }) => void;
    const t = track(setup());
    t.saveRoom.mockImplementationOnce(() => new Promise((r) => (release = r)));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    t.store.getState().setTree({ slotCount: 16 });
    t.a.stop();
    const before = t.onState.mock.calls.length;
    release({ roomVersion: 4 });
    await vi.advanceTimersByTimeAsync(10000);
    expect(t.onState.mock.calls.length).toBe(before);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);

    let fail!: (e: unknown) => void;
    const t2 = track(setup());
    t2.saveRoom.mockImplementationOnce(() => new Promise((_r, j) => (fail = j)));
    t2.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    t2.a.stop();
    const before2 = t2.onState.mock.calls.length;
    fail(new ApiError(401, 'owner_required', 'x'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(t2.onState.mock.calls.length).toBe(before2);
    expect(t2.onUnauthorized).not.toHaveBeenCalled();
  });

  it('keepMine coi phòng server là bản đã lưu: slots_in_use sau đó trả slotCount về giá trị của server', async () => {
    const other = defaultRoom();
    other.tree = { ...other.tree, slotCount: 16 };
    const server = serverRoom(other, 7);
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(409, 'version_conflict', 'x', { room: server }));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onConflict).toHaveBeenCalledTimes(1);
    t.saveRoom.mockRejectedValueOnce(new ApiError(409, 'slots_in_use', 'Đã có lời nhắn.'));
    t.a.keepMine(server);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.store.getState().room.tree.slotCount).toBe(16);
  });

  it('slots_in_use mà trả slotCount không đổi gì vẫn hẹn lưu lại, không bỏ rơi thay đổi mới hơn', async () => {
    let fail!: (e: unknown) => void;
    const t = track(setup());
    t.saveRoom.mockImplementationOnce(() => new Promise((_r, j) => (fail = j)));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    // Trong lúc gửi: trả về 12 và đổi phông — slotCount đã bằng bản đã lưu.
    t.store.getState().setTree({ slotCount: 12 });
    t.store.getState().setBackground('night');
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    // setTree hiện luôn tạo phòng mới; giả lập trường hợp trả về không đổi gì (không tăng revision).
    t.store.setState({ setTree: () => {} });
    fail(new ApiError(409, 'slots_in_use', 'Đã có lời nhắn.'));
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.saveRoom.mock.calls[1]![2].background).toBe('night');
    expect(t.onState).toHaveBeenLastCalledWith('saved');
  });

  it('xung đột → sửa thêm khi bảng đang mở → keepMine gửi bản mới nhất với roomVersion mới', async () => {
    const server = serverRoom(defaultRoom(), 7);
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(409, 'version_conflict', 'x', { room: server }));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    t.store.getState().setTree({ slotCount: 20 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    t.a.keepMine(server);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.saveRoom).toHaveBeenLastCalledWith('t1', 7, t.store.getState().room);
    expect(t.saveRoom.mock.calls[1]![2].tree.slotCount).toBe(20);
  });

  it('store.replaceRoom không tăng revision nên không hẹn lưu', async () => {
    const t = track(setup());
    const other = defaultRoom();
    other.background = 'night';
    t.store.getState().replaceRoom(other);
    expect(t.store.getState().revision).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.saveRoom).not.toHaveBeenCalled();
  });
  it('401 rồi đăng nhập lại: flush gửi lại thay đổi chưa lưu dù không còn hẹn giờ nào', async () => {
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(401, 'owner_required', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onUnauthorized).toHaveBeenCalledTimes(1);
    await t.a.flush();
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
    await t.a.flush();
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
  });
  it('isSaved / lastSaved: chỉ "đã lưu" khi bản trên máy đúng là bản server đã nhận', async () => {
    const t = track(setup());
    const initial = t.store.getState().room;
    expect(t.a.isSaved()).toBe(true);
    t.saveRoom.mockRejectedValueOnce(new ApiError(0, 'network', 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    expect(t.a.isSaved()).toBe(false);
    await t.a.flush();
    expect(t.a.isSaved()).toBe(false);
    expect(t.a.lastSaved()).toBe(initial);
    await t.a.flush();
    expect(t.a.isSaved()).toBe(true);
    expect(t.a.lastSaved()).toBe(t.store.getState().room);
  });
});
