import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@ctln/shared';
import { ApiError, type PublicRoom } from '../lib/api';
import { storage } from '../lib/storage';
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
  };
  const a = createAutosave({ treeId: 't1', store, version: opts.version ?? 3, api: { saveRoom }, storage, ...cb });
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
  it('gộp các thay đổi: 1 lần saveRoom sau 1500ms kể từ thay đổi cuối; thành công cập nhật version, xoá nháp', async () => {
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
    expect(storage.getDraft('t1')).toBeNull();
    expect(t.onState.mock.calls.map((c) => c[0]).slice(-2)).toEqual(['saving', 'saved']);
  });

  it('ghi nháp ngay khi đổi; mở lại cùng bản server thì gửi nháp, khác bản thì báo xung đột', async () => {
    const t = track(setup());
    t.store.getState().setTree({ slotCount: 9 });
    const draft = storage.getDraft('t1')!;
    expect(draft.room).toEqual(t.store.getState().room);
    expect(draft.baseVersion).toBe(3);
    t.a.stop();

    const t2 = track(setup({ version: 3 }));
    expect(t2.a.resume(3)).toBe('sent');
    await vi.advanceTimersByTimeAsync(0);
    expect(t2.saveRoom).toHaveBeenCalledWith('t1', 3, draft.room);
    expect(t2.a.version()).toBe(4);

    storage.setDraft('t1', draft);
    const t3 = track(setup({ version: 4 }));
    expect(t3.a.resume(4)).toBe('conflict');
    expect(t3.store.getState().room).toEqual(draft.room);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t3.saveRoom).not.toHaveBeenCalled();
  });

  it('resume: không có nháp → none; nháp hỏng → xoá, none', () => {
    const t = track(setup());
    expect(t.a.resume(3)).toBe('none');
    localStorage.setItem('draft:t1', JSON.stringify({ room: { foo: 1 }, baseVersion: 3, savedAt: '' }));
    expect(t.a.resume(3)).toBe('none');
    expect(localStorage.getItem('draft:t1')).toBeNull();
    const bad = defaultRoom();
    bad.items = bad.items.filter((i) => i.type !== 'tree');
    storage.setDraft('t1', { room: bad, baseVersion: 3, savedAt: '' });
    expect(t.a.resume(3)).toBe('none');
    expect(storage.getDraft('t1')).toBeNull();
    expect(t.saveRoom).not.toHaveBeenCalled();
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
    expect(storage.getDraft('t1')).toBeNull();

    t.store.getState().setTree({ slotCount: 16 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onConflict).toHaveBeenCalledTimes(2);
    const calls = t.saveRoom.mock.calls.length;
    t.a.useLatest(server);
    expect(t.store.getState().room).toEqual({ background: 'night', tree: other.tree, items: other.items });
    expect(t.a.version()).toBe(7);
    expect(storage.getDraft('t1')).toBeNull();
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

  it('lỗi mạng → unsaved, onOffline 1 lần, thử lại sau 5000ms và ngay khi online', async () => {
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
    await vi.advanceTimersByTimeAsync(4999);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.onOffline).toHaveBeenCalledTimes(1);
    expect(storage.getDraft('t1')).not.toBeNull();

    t.saveRoom.mockResolvedValueOnce({ roomVersion: 5 });
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saveRoom).toHaveBeenCalledTimes(3);
    expect(t.a.version()).toBe(5);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
    await vi.advanceTimersByTimeAsync(10000);
    expect(t.saveRoom).toHaveBeenCalledTimes(3);
  });

  it.each([
    [500, 'internal'],
    [429, 'rate_limited'],
  ])('lỗi %i cũng thử lại sau 5000ms', async (status, code) => {
    const t = track(setup());
    t.saveRoom.mockRejectedValueOnce(new ApiError(status, code, 'x'));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.onOffline).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
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
    expect(storage.getDraft('t1')).not.toBeNull();
    expect(t.onOffline).not.toHaveBeenCalled();
  });

  it('chỉ một lần lưu cùng lúc; thay đổi trong lúc lưu được gửi sau với version mới', async () => {
    let release!: (v: { roomVersion: number }) => void;
    const t = track(setup());
    t.saveRoom.mockImplementationOnce(() => new Promise((r) => (release = r)));
    t.store.getState().setTree({ slotCount: 9 });
    await vi.advanceTimersByTimeAsync(1500);
    t.store.getState().setTree({ slotCount: 16 });
    expect(storage.getDraft('t1')!.baseVersion).toBe(3);
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).toHaveBeenCalledTimes(1);
    release({ roomVersion: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
    expect(t.saveRoom).toHaveBeenLastCalledWith('t1', 4, t.store.getState().room);
    expect(t.store.getState().room.tree.slotCount).toBe(16);
    expect(t.onState).toHaveBeenLastCalledWith('saved');
    expect(storage.getDraft('t1')).toBeNull();
  });

  it('phòng không qua validateRoom thì không gửi, giữ nháp, unsaved', async () => {
    const bad = defaultRoom();
    const t = track(setup({ store: createEditorStore(bad) }));
    const tree = bad.items.find((i) => i.type === 'tree')!;
    t.store.setState((s) => ({ room: { ...s.room, items: [...s.room.items, { ...tree }] }, revision: s.revision + 1 }));
    await vi.advanceTimersByTimeAsync(1500);
    expect(t.saveRoom).not.toHaveBeenCalled();
    expect(storage.getDraft('t1')).not.toBeNull();
    expect(t.onState).toHaveBeenLastCalledWith('unsaved');
  });

  it('flush gửi ngay; stop huỷ hẹn và bỏ lắng nghe online', async () => {
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
    window.dispatchEvent(new Event('online'));
    t.store.getState().setTree({ slotCount: 20 });
    await vi.advanceTimersByTimeAsync(10000);
    expect(t.saveRoom).toHaveBeenCalledTimes(2);
  });
});
