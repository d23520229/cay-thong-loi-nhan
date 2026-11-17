import { RoomSchema, validateRoom, type Room } from '@ctln/shared';
import { ApiError, type api as apiModule, type PublicRoom } from '../lib/api';
import type { storage as storageModule } from '../lib/storage';
import type { EditorStore } from './store';

export type SaveState = 'saved' | 'saving' | 'unsaved';

const DEBOUNCE_MS = 1500;
const RETRY_MS = 5000;
// Server giới hạn 120 lần lưu/giờ/cây (đặc tả 10): từ lần gửi thứ 100 trong một giờ thì gộp 60 giây.
const HOUR_MS = 3600000;
const SLOW_AFTER = 100;
const SLOW_MS = 60000;

type Opts = {
  treeId: string;
  store: EditorStore;
  version: number;
  api: Pick<typeof apiModule, 'saveRoom'>;
  storage: Pick<typeof storageModule, 'getDraft' | 'setDraft' | 'clearDraft'>;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
  now?: () => number;
  onState(s: SaveState): void;
  onConflict(serverRoom: PublicRoom): void;
  onSlotsInUse(message: string): void;
  onWriteClosed(): void;
  onUnauthorized(): void;
  onOffline(): void;
  onRateLimited(): void;
};

/** Tự lưu phòng (đặc tả 6.5 "Tự lưu"): gộp 1,5 giây, nháp `draft:{treeId}`, xử lý từng mã lỗi. */
export function createAutosave(o: Opts) {
  const setTimer = o.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
  const now = o.now ?? (() => Date.now());
  const { store, storage, treeId } = o;

  let version = o.version;
  let lastSaved: Room = store.getState().room; // phòng server đã xác nhận gần nhất
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let offline = false;
  let rateLimited = false;
  let attempts: number[] = []; // thời điểm các lần gửi trong một giờ gần nhất
  let conflict = false; // chờ chủ cây chọn trong bảng xung đột, không gửi
  let stopped = false;

  const clearTimers = () => {
    if (debounce !== undefined) clearTimer(debounce);
    if (retry !== undefined) clearTimer(retry);
    debounce = retry = undefined;
  };
  const writeDraft = () =>
    storage.setDraft(treeId, { room: store.getState().room, baseVersion: version, savedAt: new Date().toISOString() });

  const send = (): Promise<void> => {
    clearTimers();
    if (inFlight) return inFlight; // xong lượt đang gửi sẽ tự gửi tiếp bản mới nhất
    if (stopped || conflict) return Promise.resolve();
    const room = store.getState().room;
    if (!validateRoom(room).ok) {
      o.onState('unsaved');
      return Promise.resolve();
    }
    o.onState('saving');
    const t = now();
    attempts = attempts.filter((a) => a > t - HOUR_MS);
    attempts.push(t);
    inFlight = (async () => {
      let next = false;
      try {
        const res = await o.api.saveRoom(treeId, version, room);
        version = res.roomVersion;
        lastSaved = room;
        offline = false;
        rateLimited = false;
        // Đã stop(): vẫn cập nhật nháp cho đúng bản server, nhưng không gọi callback nào.
        if (store.getState().room === room) {
          storage.clearDraft(treeId);
          if (!stopped) o.onState('saved');
        } else {
          writeDraft(); // nháp sửa tiếp từ bản vừa lưu
          if (!stopped) {
            o.onState('unsaved');
            next = debounce === undefined;
          }
        }
      } catch (e) {
        if (!stopped) {
          o.onState('unsaved');
          handleError(e);
        }
      } finally {
        inFlight = null;
      }
      if (next) await send();
    })();
    return inFlight;
  };

  const handleError = (e: unknown) => {
    const err = e instanceof ApiError ? e : new ApiError(0, 'network', String(e));
    if (err.status === 409 && err.code === 'version_conflict') {
      conflict = true;
      o.onConflict(err.extra.room as PublicRoom);
    } else if (err.status === 409 && err.code === 'slots_in_use') {
      store.getState().setTree({ slotCount: lastSaved.tree.slotCount });
      schedule(); // trả về có thể không đổi gì (không tăng revision) — vẫn lưu các thay đổi mới hơn
      o.onSlotsInUse(err.message);
    } else if (err.status === 403 && err.code === 'write_closed') {
      o.onWriteClosed();
    } else if (err.status === 401) {
      o.onUnauthorized();
    } else if (err.status === 429) {
      if (!rateLimited) {
        rateLimited = true;
        o.onRateLimited();
      }
      if (!stopped) retry = setTimer(() => void send(), SLOW_MS);
    } else if (err.status === 0 || err.status >= 500) {
      if (!offline) {
        offline = true;
        o.onOffline();
      }
      if (!stopped) retry = setTimer(() => void send(), RETRY_MS);
    }
  };

  const onOnline = () => {
    if (offline) void send();
  };
  window.addEventListener('online', onOnline);

  const schedule = () => {
    if (debounce !== undefined) clearTimer(debounce);
    const t = now();
    const recent = attempts.filter((a) => a > t - HOUR_MS).length;
    debounce = setTimer(() => {
      debounce = undefined;
      void send();
    }, rateLimited || recent >= SLOW_AFTER ? SLOW_MS : DEBOUNCE_MS);
  };

  // replaceRoom (resume, useLatest) không tăng revision nên không đi qua đây.
  const unsubscribe = store.subscribe((s, prev) => {
    if (s.revision === prev.revision) return;
    writeDraft();
    o.onState('unsaved');
    schedule();
  });

  return {
    resume(serverVersion: number): 'none' | 'sent' | 'conflict' {
      const draft = storage.getDraft(treeId);
      if (!draft) return 'none';
      const parsed = RoomSchema.safeParse(draft.room);
      if (!parsed.success || !validateRoom(parsed.data).ok) {
        storage.clearDraft(treeId);
        return 'none';
      }
      store.getState().replaceRoom(parsed.data);
      if (draft.baseVersion === serverVersion) {
        version = serverVersion;
        void send();
        return 'sent';
      }
      conflict = true;
      return 'conflict';
    },
    keepMine(serverRoom: PublicRoom) {
      conflict = false;
      lastSaved = { background: serverRoom.background, tree: serverRoom.tree, items: serverRoom.items };
      version = serverRoom.roomVersion;
      writeDraft();
      void send();
    },
    useLatest(serverRoom: PublicRoom) {
      conflict = false;
      clearTimers();
      const room: Room = { background: serverRoom.background, tree: serverRoom.tree, items: serverRoom.items };
      store.getState().replaceRoom(room);
      lastSaved = room;
      version = serverRoom.roomVersion;
      storage.clearDraft(treeId);
      o.onState('saved');
    },
    flush(): Promise<void> {
      // Còn hẹn giờ, hoặc lượt trước lỗi (ví dụ 401) để lại thay đổi chưa lưu → gửi ngay.
      if (debounce !== undefined || retry !== undefined || store.getState().room !== lastSaved) return send();
      return inFlight ?? Promise.resolve();
    },
    stop() {
      stopped = true;
      clearTimers();
      window.removeEventListener('online', onOnline);
      unsubscribe();
    },
    version: () => version,
    /** Phòng server đã xác nhận gần nhất. */
    lastSaved: () => lastSaved,
    /** Bản trên máy đúng là bản server đã nhận, không còn lượt gửi nào. */
    isSaved: () => !inFlight && store.getState().room === lastSaved,
  };
}
