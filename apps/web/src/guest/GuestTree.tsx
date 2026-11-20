import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Room } from '@ctln/shared';
import { ApiError, api, type MessageInput, type PublicRoom } from '../lib/api';
import { serverNow, syncClock } from '../lib/clock';
import { storage, type MineEntry } from '../lib/storage';
import { RoomStage } from '../room/RoomStage';
import { useItemFx } from '../room/useItemFx';
import { Compose, newDraft, type ComposeDraft } from './Compose';
import { slotRects, zoomCamera, type Camera } from './geometry';
import { SlotsLayer } from './SlotsLayer';
import { canWrite, isFull, minutesLeft, pruneMine, slotViews } from './slots';

type Props = {
  treeId: string;
  meta: PublicRoom;
  room: Room;
  toast: (m: string) => void;
  onOwnerLogin: () => void;
};

type Open =
  | { mode: 'new'; slot: number }
  | { mode: 'edit'; slot: number; messageId: string; token: string; minutesLeft: number };

const TOP_RESERVE = 56;
// Khối nút của khách: 8 + 44 ("Tạo cây của bạn") + 4 + 44 ("Tôi là chủ cây") + 16 — đo bằng Chrome.
const GUEST_BOTTOM_RESERVE = 116;
const SLOT_FX_MS = 950;
const NOT_EDITABLE = 'Lời nhắn này không sửa được nữa';
const SEND_FAILED = 'Chưa gửi được, thử lại nhé';

/** Lỗi không tới được server hoặc server hỏng (trừ tạm dừng khẩn cấp có thông báo riêng). */
const isTransport = (e: ApiError) => e.status === 0 || (e.status >= 500 && e.code !== 'paused');

/** Khách: xem phòng, zoom vào cây, treo / sửa / gỡ lời nhắn (đặc tả 6.6.1). */
export function GuestTree({ treeId, meta, room, toast, onOwnerLogin }: Props) {
  const [slots, setSlots] = useState(meta.slots);
  const [phase, setPhase] = useState(meta.phase);
  const [mine, setMine] = useState<Record<number, MineEntry>>(() => pruneMine(treeId, meta.slots, serverNow()));
  const [camera, setCamera] = useState<Camera | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [draft, setDraft] = useState<ComposeDraft>(() => newDraft(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotFx, setSlotFx] = useState<Record<number, 'ring' | 'drop-in'>>({});
  const held = useRef<ComposeDraft | null>(null); // chữ giữ lại sau slot_taken
  const stage = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { fx, tap } = useItemFx(room);

  useEffect(() => {
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, []);

  // Hạn sửa so theo giờ server.
  useEffect(() => {
    api.getConfig().then(
      (c) => {
        syncClock(c.now);
        setMine(pruneMine(treeId, meta.slots, serverNow()));
      },
      () => {},
    );
  }, [treeId, meta.slots]);

  const flash = (slot: number, kind: 'ring' | 'drop-in') => {
    setSlotFx((f) => ({ ...f, [slot]: kind }));
    timers.current.push(
      setTimeout(() => setSlotFx((f) => {
        const { [slot]: _, ...rest } = f;
        return rest;
      }), SLOT_FX_MS),
    );
  };

  const refresh = useCallback(async () => {
    try {
      const r = await api.getTree(treeId);
      setSlots(r.slots);
      setPhase(r.phase);
      setMine(pruneMine(treeId, r.slots, serverNow()));
    } catch {
      /* giữ trạng thái cũ */
    }
  }, [treeId]);

  const zoomed = camera !== null;
  const writable = canWrite(phase);
  const views = slotViews(slots, room.tree.slotCount, mine, serverNow());

  const onItemTap = (clientId: string) => {
    const it = room.items.find((i) => i.clientId === clientId);
    if (it?.type !== 'tree') return tap(clientId);
    if (zoomed) return;
    const el = stage.current;
    setCamera(zoomCamera(room, el?.clientWidth ?? 0, el?.clientHeight ?? 0));
    void refresh();
  };

  const forget = (slot: number) => {
    storage.clearMine(treeId, slot);
    setMine((m) => {
      const { [slot]: _, ...rest } = m;
      return rest;
    });
  };

  const close = () => {
    setOpen(null);
    setError(null);
  };

  const onSlotTap = async (slot: number) => {
    const v = views[slot];
    if (!v) return;
    if (v.kind === 'empty') {
      if (!writable) return;
      setDraft(held.current ?? newDraft(storage.getLastName()));
      setError(null);
      setOpen({ mode: 'new', slot });
      return;
    }
    if (v.kind === 'mineExpired' || (v.kind === 'mine' && !writable)) {
      toast(NOT_EDITABLE);
      forget(slot);
      return flash(slot, 'ring');
    }
    if (v.kind === 'taken') return flash(slot, 'ring');
    const m = v.mine!;
    try {
      const msg = await api.getMine(m.messageId, m.editToken);
      setDraft({ ornament: msg.ornament, anonymous: msg.anonymous, authorName: msg.authorName ?? '', content: msg.content });
      setError(null);
      setOpen({ mode: 'edit', slot, messageId: m.messageId, token: m.editToken, minutesLeft: minutesLeft(msg.editUntil, serverNow()) });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        toast(e.message || NOT_EDITABLE);
        forget(slot);
      } else toast(SEND_FAILED);
    }
  };

  /** Lỗi chung của treo/sửa/gỡ; trả true nếu đã xử lý xong (bảng đóng). */
  const writeClosed = (e: ApiError) => {
    if (e.code !== 'write_closed') return false;
    close();
    setPhase('NOTICE');
    toast('Đã hết thời gian treo lời nhắn');
    return true;
  };

  const markSlot = (slot: number, occupied: boolean, ornament?: string) =>
    setSlots((ss) => {
      const rest = ss.filter((s) => s.index !== slot);
      return [...rest, occupied ? { index: slot, occupied, ornament } : { index: slot, occupied }];
    });

  const submit = async (input: MessageInput, website: string) => {
    if (!open) return;
    setBusy(true);
    try {
      if (open.mode === 'new') {
        const r = await api.postMessage(treeId, { ...input, slotIndex: open.slot, website });
        const entry = { messageId: r.messageId, editToken: r.editToken, editUntil: r.editUntil };
        storage.setMine(treeId, open.slot, entry);
        if (!input.anonymous && input.authorName) storage.setLastName(input.authorName);
        held.current = null;
        setMine((m) => ({ ...m, [open.slot]: entry }));
        markSlot(open.slot, true, input.ornament);
        close();
        flash(open.slot, 'drop-in');
        toast('Đã treo! Còn 15 phút để sửa');
      } else {
        await api.editMessage(open.messageId, open.token, input);
        markSlot(open.slot, true, input.ornament);
        close();
        flash(open.slot, 'ring');
        toast('Đã lưu thay đổi');
      }
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'network', SEND_FAILED);
      if (writeClosed(err)) return;
      if (open.mode === 'new' && err.code === 'slot_taken') {
        held.current = draft;
        close();
        toast(err.message);
        void refresh();
      } else if (open.mode === 'edit' && (err.status === 403 || err.status === 404)) {
        close();
        toast(err.message || NOT_EDITABLE);
        forget(open.slot);
      } else setError(isTransport(err) ? SEND_FAILED : err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (open?.mode !== 'edit') return;
    setBusy(true);
    try {
      await api.deleteMessage(open.messageId, open.token);
      forget(open.slot);
      markSlot(open.slot, false);
      close();
      toast('Đã xoá lời nhắn');
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'network', SEND_FAILED);
      if (writeClosed(err)) return;
      if (err.status === 403 || err.status === 404) {
        close();
        toast(err.message || NOT_EDITABLE);
        forget(open.slot);
      } else setError(isTransport(err) ? SEND_FAILED : err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    // Bỏ bảng viết mới thì bỏ luôn chữ đang giữ.
    if (open?.mode === 'new') held.current = null;
    close();
  };

  return (
    <>
      <div className="room-stage">
        <RoomStage
          room={room}
          reserveTop={TOP_RESERVE}
          reserveBottom={GUEST_BOTTOM_RESERVE}
          stageRef={stage}
          camera={camera}
          fx={fx}
          onItemTap={onItemTap}
          overlay={
            zoomed ? (
              <SlotsLayer rects={slotRects(room)} views={views} fx={slotFx} onTap={(i) => void onSlotTap(i)} hideEmpty={!writable} />
            ) : null
          }
        />
      </div>
      {zoomed ? (
        <div className="room-bottom">
          {writable && isFull(views) ? (
            <>
              <p className="gs-hint">Cây đã đầy lời nhắn</p>
              <Link to={`/?ref=${treeId}`} className="btn btn-primary">Tạo cây của bạn</Link>
            </>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => setCamera(null)}>
            <span aria-hidden="true">‹</span> Về căn phòng
          </button>
        </div>
      ) : (
        <div className="room-bottom">
          <p className="gs-hint">Chạm vào cây thông để treo lời nhắn</p>
          <Link to={`/?ref=${treeId}`} className="btn btn-primary">Tạo cây của bạn</Link>
          <button type="button" className="linkbtn" onClick={onOwnerLogin}>Tôi là chủ cây</button>
        </div>
      )}
      {open ? (
        <Compose
          mode={open.mode}
          draft={draft}
          onChange={setDraft}
          minutesLeft={open.mode === 'edit' ? open.minutesLeft : undefined}
          busy={busy}
          error={error}
          onSubmit={(input, website) => void submit(input, website)}
          onDelete={open.mode === 'edit' ? () => void remove() : undefined}
          onClose={cancel}
        />
      ) : null}
    </>
  );
}
