import { validateRoom, type Room } from '@ctln/shared';
import { ApiError, type api as apiModule, type PublicRoom } from '../lib/api';
import { sameRoom } from './model';
import type { EditorStore } from './store';

export type SaveState = 'saved' | 'saving' | 'unsaved';

const DEBOUNCE_MS = 1500;
// Server giới hạn 600 lần lưu/giờ/cây (đặc tả 10): từ lần gửi thứ 540 trong một giờ thì gộp 60 giây.
const HOUR_MS = 3600000;
const SLOW_AFTER = 540;
const SLOW_MS = 60000;

type Opts = {
  treeId: string;
  store: EditorStore;
  version: number;
  api: Pick<typeof apiModule, 'saveRoom'>;
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
  /** 404: cây đã bị xoá ở nơi khác — tự lưu đã dừng. */
  onGone(): void;
};

/** Tự lưu phòng (đặc tả 6.5 "Tự lưu"): gộp 1,5 giây, xử lý từng mã lỗi; không giữ nháp, mất mạng không tự thử lại. */
export function createAutosave(o: Opts) {
  const setTimer = o.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
  const now = o.now ?? (() => Date.now());
  const { store, treeId } = o;

  let version = o.version;
  let lastSaved: Room = store.getState().room; // phòng server đã xác nhận gần nhất
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined; // chỉ dùng cho 429
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
        // Đã stop(): không gọi callback nào.
        if (!stopped) {
          const changed = store.getState().room !== room;
          o.onState(changed ? 'unsaved' : 'saved');
          next = changed && debounce === undefined;
        }
      } catch (e) {
        if (!stopped) {
          o.onState('unsaved');
          handleError(e, room);
        }
      } finally {
        inFlight = null;
      }
      if (next) await send();
    })();
    return inFlight;
  };

  const handleError = (e: unknown, sent: Room) => {
    const err = e instanceof ApiError ? e : new ApiError(0, 'network', String(e));
    if (err.status === 409 && err.code === 'version_conflict') {
      const server = err.extra.room as PublicRoom;
      const current = store.getState().room;
      const shaped = !!server && typeof server === 'object' && Array.isArray(server.items) && !!server.tree && typeof server.tree === 'object' && Number.isInteger(server.roomVersion);
      if (shaped && sameRoom(server, current)) {
        // Xung đột giả: server đã có đúng bản trên máy — chỉ nhận version mới.
        version = server.roomVersion;
        lastSaved = current;
        offline = false;
        rateLimited = false;
        o.onState('saved');
      } else if (shaped && sameRoom(server, sent)) {
        // Server có đúng bản vừa gửi; máy đã sửa tiếp — nhận version rồi lưu phần mới.
        version = server.roomVersion;
        lastSaved = sent;
        schedule();
      } else {
        conflict = true;
        o.onConflict(server);
      }
    } else if (err.status === 409 && err.code === 'slots_in_use') {
      store.getState().setTree({ slotCount: lastSaved.tree.slotCount });
      schedule(); // trả về có thể không đổi gì (không tăng revision) — vẫn lưu các thay đổi mới hơn
      o.onSlotsInUse(err.message);
    } else if (err.status === 403 && err.code === 'write_closed') {
      o.onWriteClosed();
    } else if (err.status === 401) {
      o.onUnauthorized();
    } else if (err.status === 404) {
      stop();
      o.onGone();
    } else if (err.status === 429) {
      if (!rateLimited) {
        rateLimited = true;
        o.onRateLimited();
      }
      if (!stopped) retry = setTimer(() => void send(), SLOW_MS);
    } else if (err.status === 0 || err.status >= 500) {
      // Không tự thử lại (chốt 19/11): thao tác tiếp theo của chủ cây sẽ lưu lại cả phòng.
      if (!offline) {
        offline = true;
        o.onOffline();
      }
    }
  };

  const schedule = () => {
    if (debounce !== undefined) clearTimer(debounce);
    const t = now();
    const recent = attempts.filter((a) => a > t - HOUR_MS).length;
    debounce = setTimer(() => {
      debounce = undefined;
      void send();
    }, rateLimited || recent >= SLOW_AFTER ? SLOW_MS : DEBOUNCE_MS);
  };

  // replaceRoom (useLatest) không tăng revision nên không đi qua đây.
  const unsubscribe = store.subscribe((s, prev) => {
    if (s.revision === prev.revision) return;
    o.onState('unsaved');
    schedule();
  });

  const stop = () => {
    stopped = true;
    clearTimers();
    unsubscribe();
  };

  return {
    keepMine(serverRoom: PublicRoom) {
      conflict = false;
      lastSaved = { background: serverRoom.background, tree: serverRoom.tree, items: serverRoom.items };
      version = serverRoom.roomVersion;
      void send();
    },
    useLatest(serverRoom: PublicRoom) {
      conflict = false;
      clearTimers();
      const room: Room = { background: serverRoom.background, tree: serverRoom.tree, items: serverRoom.items };
      store.getState().replaceRoom(room);
      lastSaved = room;
      version = serverRoom.roomVersion;
      o.onState('saved');
    },
    flush(): Promise<void> {
      // Còn hẹn giờ, hoặc lượt trước lỗi (ví dụ 401) để lại thay đổi chưa lưu → gửi ngay.
      if (debounce !== undefined || retry !== undefined || store.getState().room !== lastSaved) return send();
      return inFlight ?? Promise.resolve();
    },
    stop,
    hasConflict: () => conflict,
    /** pagehide: gửi một lần bằng fetch keepalive, không await; thành công thì nhận version mới (tránh xung đột giả khi quay lại bằng Back); huỷ hẹn giờ đang chờ. */
    flushOnUnload(): void {
      const room = store.getState().room;
      if (stopped || conflict || room === lastSaved || !validateRoom(room).ok) return;
      const used = version;
      clearTimers();
      // Trang có thể quay lại từ bfcache sau pagehide: nhận version mới để lần lưu sau không bị 409 giả.
      void o.api
        .saveRoom(treeId, used, room, { keepalive: true })
        .then((r) => {
          if (stopped || conflict || version !== used) return;
          lastSaved = room;
          version = r.roomVersion;
          if (store.getState().room === room) o.onState('saved');
        })
        .catch(() => {});
    },
    version: () => version,
    /** Phòng server đã xác nhận gần nhất. */
    lastSaved: () => lastSaved,
    /** Bản trên máy đúng là bản server đã nhận, không còn lượt gửi nào. */
    isSaved: () => !inFlight && store.getState().room === lastSaved,
  };
}
