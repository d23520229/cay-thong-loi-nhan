import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Room } from '@ctln/shared';
import { ApiError, api, type MessageInput, type PublicRoom } from '../lib/api';
import { serverNow, syncClock } from '../lib/clock';
import { storage, type MineEntry } from '../lib/storage';
import { bitmapFromBlob, type PreparedPhoto } from '../card/photo';
import { RoomStage } from '../room/RoomStage';
import { useItemFx } from '../room/useItemFx';
import { Compose, newDraft, type ComposeDraft } from './Compose';
import { slotRects } from './geometry';
import { SlotsLayer } from './SlotsLayer';
import { TreeBubble } from './TreeBubble';
import { canWrite, isFull, pruneMine, slotViews } from './slots';
import { useTreeZoom } from './useTreeZoom';

type Props = {
  treeId: string;
  meta: PublicRoom;
  room: Room;
  toast: (m: string) => void;
  onOwnerLogin: () => void;
};

type Open =
  | { mode: 'new'; slot: number }
  | { mode: 'edit'; slot: number; messageId: string; token: string; editUntil: string };

const TOP_RESERVE = 56;
// Khối nút của khách: 8 + 44 ("Tạo cây của bạn") + 4 + 44 ("Tôi là chủ cây") + 28 ("Tải ảnh phòng") + 16 — ước tính, cần đo lại bằng Chrome.
const GUEST_BOTTOM_RESERVE = 144;
const SLOT_FX_MS = 950;
const NOT_EDITABLE = 'Lời nhắn này không sửa được nữa';
const SEND_FAILED = 'Chưa gửi được, thử lại nhé';
const LOAD_FAILED = 'Chưa tải được, thử lại nhé';

/** Lỗi không tới được server hoặc server hỏng (trừ tạm dừng khẩn cấp có thông báo riêng). */
const isTransport = (e: ApiError) => e.status === 0 || (e.status >= 500 && e.code !== 'paused');

/** Khách: xem phòng, zoom vào cây, treo / sửa / gỡ lời nhắn (đặc tả 6.6.1). */
export function GuestTree({ treeId, meta, room, toast, onOwnerLogin }: Props) {
  const [slots, setSlots] = useState(meta.slots);
  const [phase, setPhase] = useState(meta.phase);
  // Chỉ đọc khi mở trang; dọn khoá (pruneMine) sau khi đã có giờ server, kẻo máy chạy nhanh xoá nhầm khoá còn hạn.
  const [mine, setMine] = useState<Record<number, MineEntry>>(() => storage.listMine(treeId));
  const { camera, stageRef: stage, zoomIn, zoomOut, onFit } = useTreeZoom(room);
  const [open, setOpen] = useState<Open | null>(null);
  const [draft, setDraft] = useState<ComposeDraft>(() => newDraft(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotFx, setSlotFx] = useState<Record<number, 'ring' | 'drop-in'>>({});
  const held = useRef<ComposeDraft | null>(null); // chữ (và ảnh) giữ lại sau slot_taken
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { fx, tap } = useItemFx(room);

  useEffect(() => {
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, []);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  // Hạn sửa so theo giờ server; có giờ (hoặc không lấy được) mới dọn khoá, theo trạng thái điểm hiện tại.
  useEffect(() => {
    let alive = true;
    const prune = () => {
      if (alive) setMine(pruneMine(treeId, slotsRef.current, serverNow()));
    };
    api.getConfig().then((c) => {
      syncClock(c.now);
      prune();
    }, prune);
    return () => {
      alive = false;
    };
  }, [treeId]);

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
    zoomIn();
    void refresh();
  };

  const forget = (slot: number) => {
    storage.clearMine(treeId, slot);
    setMine((m) => {
      const { [slot]: _, ...rest } = m;
      return rest;
    });
  };

  /** Đóng bảng; trừ khi giữ bản nháp (`keep`, sau slot_taken), bỏ luôn ảnh đã thu nhỏ. */
  const close = (keep = false) => {
    if (!keep) {
      if (open?.mode === 'new') held.current = null;
      draft.photo?.bitmap.close?.();
    }
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
      // Ảnh đang có chỉ để xem; không đổi ảnh thì không gửi lại (base64 rỗng).
      let photo: PreparedPhoto | null = null;
      if (msg.hasPhoto) {
        const b = await api.getMyPhoto(m.messageId, m.editToken);
        if (b) photo = { bitmap: await bitmapFromBlob(b), base64: '' };
      }
      setDraft({ ornament: msg.ornament, anonymous: msg.anonymous, authorName: msg.authorName ?? '', content: msg.content, photo, photoChanged: false });
      setError(null);
      setOpen({ mode: 'edit', slot, messageId: m.messageId, token: m.editToken, editUntil: msg.editUntil });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        toast(e.message || NOT_EDITABLE);
        forget(slot);
      } else toast(LOAD_FAILED);
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
        close(true);
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
    // Đang gửi thì không đóng: kết quả về sau sẽ đóng/mở đúng bảng này, không lẫn sang bảng khác.
    if (busy) return;
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
          onFit={onFit}
          fx={fx}
          onItemTap={onItemTap}
          overlay={
            <>
              <TreeBubble
                room={room}
                hidden={zoomed}
                text={writable ? 'Chạm vào cây thông để treo lời nhắn' : 'Chạm vào cây thông để xem các lời nhắn đã treo'}
              />
              <SlotsLayer rects={slotRects(room)} views={views} fx={slotFx} onTap={(i) => void onSlotTap(i)} hideEmpty={!writable} interactive={zoomed} />
            </>
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
          <button type="button" className="btn btn-ghost" onClick={zoomOut}>
            <span aria-hidden="true">‹</span> Về căn phòng
          </button>
        </div>
      ) : (
        <div className="room-bottom">
          <Link to={`/?ref=${treeId}`} className="btn btn-primary">Tạo cây của bạn</Link>
          <button type="button" className="linkbtn" onClick={onOwnerLogin}>Tôi là chủ cây</button>
          <a className="linkbtn" href={api.roomImageUrl(treeId)} download>⬇ Tải ảnh phòng</a>
        </div>
      )}
      {open ? (
        <Compose
          mode={open.mode}
          draft={draft}
          onChange={setDraft}
          editUntil={open.mode === 'edit' ? open.editUntil : undefined}
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
