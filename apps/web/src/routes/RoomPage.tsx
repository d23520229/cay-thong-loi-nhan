import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Link, useParams } from 'react-router';
import { RoomSchema, validateRoom, type Room } from '@ctln/shared';
import { ApiError, api, type OwnerRoom, type PublicRoom } from '../lib/api';
import { storage } from '../lib/storage';
import { TREE_CODE } from '../lib/treeRef';
import { createAutosave, type SaveState } from '../room/autosave';
import { ConflictDialog } from '../room/ConflictDialog';
import { GuestTree } from '../guest/GuestTree';
import { OwnerTree } from '../owner/OwnerTree';
import { EditorLayout } from '../room/EditorLayout';
import { createEditorStore } from '../room/store';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { OwnerLogin } from './OwnerLogin';
import { SupportHint } from '../ui/SupportHint';

type Autosave = ReturnType<typeof createAutosave>;
type Loaded<T> = { meta: T; room: Room };
type View =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error' }
  | { kind: 'owner'; data: Loaded<OwnerRoom> }
  | { kind: 'guest'; data: Loaded<PublicRoom> };


/** Phòng nhận từ server phải hợp lệ mới vẽ (không tin dữ liệu ngoài). */
function toRoom(r: PublicRoom): Room | null {
  if (!r || typeof r !== 'object') return null;
  const parsed = RoomSchema.safeParse({ background: r.background, tree: r.tree, items: r.items });
  return parsed.success && validateRoom(parsed.data).ok ? parsed.data : null;
}

/** "Sửa phòng" ẩn từ 0h 26/12 (đặc tả 11). */
const phaseAllowsEdit = (phase: string) => phase === 'BUILD' || phase === 'OPEN';

const roomTitle = (meta: PublicRoom) => meta.title || `Phòng của ${meta.ownerName}`;

function remember(id: string, title: string | null) {
  const known = storage.myTrees().find((t) => t.id === id);
  storage.addMyTree({ id, title: title ?? known?.title ?? null, createdAt: known?.createdAt ?? new Date().toISOString() });
}

export function RoomPage() {
  const { id = '' } = useParams();
  return <TreeRoom key={id} id={id} />;
}

function TreeRoom({ id }: { id: string }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [mode, setMode] = useState<'view' | 'edit' | null>(null);
  const [writeClosed, setWriteClosed] = useState(false);
  const [login, setLogin] = useState<null | 'guest' | 'unauthorized'>(null);
  const autosave = useRef<Autosave | null>(null);
  const link = useRef<Promise<void> | null>(null);
  const visited = useRef(false);
  // Lượt vào trang: một request /owner dùng chung cho cả hai lần effect của StrictMode.
  const firstOwner = useRef<Promise<OwnerRoom> | null>(null);
  const { toast, show } = useToast();

  const load = useCallback(
    async (cancelled: () => boolean = () => false, firstVisit = false) => {
      const fail = (e: unknown) => {
        if (cancelled()) return;
        if (e instanceof ApiError && e.status === 404) {
          storage.removeMyTree(id);
          setView({ kind: 'notFound' });
        } else setView({ kind: 'error' });
      };
      let meta: OwnerRoom;
      try {
        meta = await (firstVisit ? (firstOwner.current ??= api.getOwnerTree(id)) : api.getOwnerTree(id));
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) return fail(e);
        try {
          const pub = await api.getTree(id);
          if (cancelled()) return;
          const room = toRoom(pub);
          setView(room ? { kind: 'guest', data: { meta: pub, room } } : { kind: 'error' });
        } catch (e2) {
          fail(e2);
        }
        return;
      }
      if (cancelled()) return;
      const room = toRoom(meta);
      if (!room) return setView({ kind: 'error' });
      remember(id, meta.title);
      setView({ kind: 'owner', data: { meta, room } });
      setMode((m) => m ?? 'view');
      // Một lần mỗi lần mở phòng (tải lại sau đăng nhập lại không tính); lỗi mạng bỏ qua lặng lẽ.
      if (!visited.current) {
        visited.current = true;
        void api.ownerVisit(id).catch(() => {});
      }
    },
    [id],
  );

  useEffect(() => {
    let cancelled = false;
    // Phòng đã tạo không giữ nháp nữa (chốt 19/11): xoá nháp còn sót từ bản cũ.
    if (TREE_CODE.test(id)) storage.clearDraft(id); // không đụng draft:new của /tao
    // Dùng chung một lượt auth/link (StrictMode chạy effect hai lần).
    link.current ??= (async () => {
      const key = /(?:^#|&)k=([^&]+)/.exec(window.location.hash)?.[1];
      if (!key) return;
      // Xoá khoá khỏi thanh địa chỉ trước, kể cả khi đăng nhập lỗi.
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      try {
        await api.authLink(id, decodeURIComponent(key));
        remember(id, null);
      } catch (e) {
        // Khoá sai/hết hạn: báo rồi vào như khách (lỗi mạng thì vẫn vào lặng lẽ).
        if (e instanceof ApiError && (e.status === 400 || e.status === 401)) show('Link riêng chưa đúng hoặc đã hết hạn.');
      }
    })();
    void link.current.then(() => {
      if (!cancelled) return load(() => cancelled, true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, load, show]);

  const onLoggedIn = async () => {
    const afterUnauthorized = login === 'unauthorized';
    setLogin(null);
    await load();
    if (afterUnauthorized) void autosave.current?.flush();
  };

  const loginSheet = login ? (
    <OwnerLogin treeId={id} onClose={() => setLogin(null)} onSuccess={() => void onLoggedIn()} />
  ) : null;

  if (view.kind === 'loading') return <div className="room-page" aria-busy="true">{toast}</div>;
  if (view.kind === 'notFound' || view.kind === 'error') {
    return (
      <main className="placeholder">
        <h1>{view.kind === 'notFound' ? 'Không tìm thấy cây này.' : 'Không mở được cây này.'}</h1>
        <Link to="/" className="btn btn-primary">Tạo cây của bạn</Link>
        {view.kind === 'error' ? <SupportHint /> : null}
      </main>
    );
  }

  const { meta, room } = view.data;
  const canEdit = view.kind === 'owner' && phaseAllowsEdit(meta.phase) && !writeClosed;

  if (view.kind === 'owner' && mode === 'edit' && canEdit) {
    return (
      <div className="room-page">
        <OwnerEditor
          id={id}
          data={view.data}
          autosaveRef={autosave}
          toast={show}
          onLeave={(r, roomVersion) => {
            setView({ kind: 'owner', data: { meta: { ...view.data.meta, roomVersion }, room: r } });
            setMode('view');
          }}
          onWriteClosed={(r, roomVersion) => {
            // Về Xem với bản server đã nhận; bản bị từ chối bị bỏ.
            setView({ kind: 'owner', data: { meta: { ...view.data.meta, roomVersion }, room: r } });
            setWriteClosed(true);
            setMode('view');
          }}
          onUnauthorized={() => setLogin('unauthorized')}
          onBadRoom={() => setView({ kind: 'error' })}
        />
        {loginSheet}
        {toast}
      </div>
    );
  }

  return (
    <div className="room-page">
      {view.kind === 'guest' ? (
        <GuestTree treeId={id} meta={meta} room={room} toast={show} onOwnerLogin={() => setLogin('guest')} />
      ) : (
        <OwnerTree
          treeId={id}
          meta={view.data.meta}
          room={room}
          toast={show}
          onUnauthorized={() => setLogin('unauthorized')}
          onChange={(patch) =>
            setView((v) => (v.kind === 'owner' ? { kind: 'owner', data: { ...v.data, meta: { ...v.data.meta, ...patch } } } : v))
          }
        />
      )}
      <div className="room-top">
        <h1 className="room-title">{roomTitle(meta)}</h1>
        {canEdit ? (
          <Button variant="primary" onClick={() => setMode('edit')}>
            <span aria-hidden="true">✏️</span> Sửa phòng
          </Button>
        ) : null}
      </div>
      {loginSheet}
      {toast}
    </div>
  );
}

type EditorProps = {
  id: string;
  data: Loaded<OwnerRoom>;
  autosaveRef: MutableRefObject<Autosave | null>;
  toast: (m: string) => void;
  onLeave: (room: Room, roomVersion: number) => void;
  onWriteClosed: (lastSaved: Room, roomVersion: number) => void;
  onUnauthorized: () => void;
  onBadRoom: () => void;
};

/** Chế độ Sửa của chủ cây: khung chỉnh sửa + tự lưu (đặc tả 6.5 "Tự lưu"). */
function OwnerEditor(props: EditorProps) {
  const { id, data, autosaveRef } = props;
  const [store] = useState(() => createEditorStore(data.room));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [conflict, setConflict] = useState<PublicRoom | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const mine = useRef<Autosave | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(stopTimer.current);
    if (!mine.current) {
      const a = createAutosave({
        treeId: id,
        store,
        version: data.meta.roomVersion,
        api,
        onState: setSaveState,
        onConflict: (server) => {
          const room = toRoom(server);
          if (!room) return latest.current.onBadRoom();
          setConflict({ ...server, ...room });
        },
        onSlotsInUse: (m) => latest.current.toast(m),
        onWriteClosed: () => latest.current.onWriteClosed(a.lastSaved(), a.version()),
        onUnauthorized: () => latest.current.onUnauthorized(),
        onOffline: () => latest.current.toast('Mất mạng — thay đổi chưa được lưu'),
        onRateLimited: () => latest.current.toast('Bạn lưu hơi nhiều, sẽ tự lưu lại sau ít phút.'),
        onGone: () => latest.current.toast('Cây này không còn nữa.'),
      });
      mine.current = a;
      autosaveRef.current = a;
    }
    return () => {
      // Hoãn một nhịp: StrictMode gỡ rồi gắn lại effect ngay, không được tạo bộ tự lưu thứ hai.
      stopTimer.current = setTimeout(() => {
        const a = mine.current;
        mine.current = null;
        if (autosaveRef.current === a) autosaveRef.current = null;
        if (a) {
          void a.flush();
          a.stop();
        }
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = () => mine.current?.flushOnUnload();
    window.addEventListener('pagehide', h);
    return () => window.removeEventListener('pagehide', h);
  }, []);

  const done = async () => {
    const a = mine.current;
    if (!a || conflict) return;
    await a.flush();
    if (a.hasConflict()) return; // bảng xung đột đã hiện (onConflict): ở lại chế độ Sửa
    // Chưa lưu được (mất mạng, 429, lỗi khác) vẫn rời chế độ Sửa: bỏ phần chưa lưu, hiện bản server đã xác nhận (chốt 19/11).
    if (!a.isSaved()) {
      a.stop();
      latest.current.toast('Thay đổi chưa được lưu.');
    }
    latest.current.onLeave(a.lastSaved(), a.version());
  };

  const resolve = (keep: boolean) => {
    const a = mine.current;
    if (!a || !conflict) return;
    if (keep) a.keepMine(conflict);
    else a.useLatest(conflict);
    setConflict(null);
  };

  return (
    <>
      <EditorLayout store={store} topBar={{ doneLabel: 'Xong', onDone: () => void done(), saveState }} />
      {conflict ? <ConflictDialog onKeepMine={() => resolve(true)} onUseLatest={() => resolve(false)} /> : null}
    </>
  );
}
