import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Room } from '@ctln/shared';
import { ApiError, api, type OpenedMessage, type OwnerRoom, type OwnerSlot } from '../lib/api';
import { serverNow, syncClock } from '../lib/clock';
import { storage } from '../lib/storage';
import { RoomStage } from '../room/RoomStage';
import { useItemFx } from '../room/useItemFx';
import { slotRects } from '../guest/geometry';
import { slotViews } from '../guest/slots';
import { SlotsLayer, type OwnerState } from '../guest/SlotsLayer';
import { TreeBubble } from '../guest/TreeBubble';
import { useTreeZoom } from '../guest/useTreeZoom';
import { countdownText } from './countdown';
import { MessageCard } from './MessageCard';
import { OwnerOptions } from './OwnerOptions';
import { ReportSheet } from './ReportSheet';
import { ShareSheet } from './ShareSheet';

type Props = {
  treeId: string;
  meta: OwnerRoom;
  room: Room;
  toast: (m: string) => void;
  onUnauthorized: () => void;
  /** Báo trạng thái mới để trang giữ lại khi chủ cây vào Sửa phòng rồi quay về. */
  onChange?: (patch: Pick<OwnerRoom, 'slots' | 'messageCount' | 'showMessageCount'>) => void;
};

const TOP_RESERVE = 56;
const BOTTOM_RESERVE = 116;
const TICK_MS = 30_000;
const RING_MS = 950;
const LOAD_FAILED = 'Chưa tải được, thử lại nhé';

const stateOf = (s: OwnerSlot): OwnerState => (s.locked ? 'locked' : s.unread ? 'unread' : 'read');

/** Chế độ Xem của chủ cây: đếm ngược, số lời nhắn, mở quà, xoá / chặn / báo cáo, tuỳ chọn (đặc tả 6.6.2). */
export function OwnerTree({ treeId, meta, room, toast, onUnauthorized, onChange }: Props) {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<OwnerSlot[]>(meta.slots);
  const [count, setCount] = useState(meta.messageCount);
  const [showCount, setShowCount] = useState(meta.showMessageCount);
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [now, setNow] = useState(serverNow);
  const [card, setCard] = useState<{ index: number; message: OpenedMessage } | null>(null);
  const [sheet, setSheet] = useState<null | 'options' | 'report' | 'share'>(null);
  const [busy, setBusy] = useState(false);
  const [ring, setRing] = useState<Record<number, 'ring'>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { camera, stageRef, zoomIn, zoomOut, onFit } = useTreeZoom(room);
  const { fx, tap } = useItemFx(room);
  const newCount = meta.newSinceLastVisit; // giữ số "mới" lúc vào trang
  const backBtn = useRef<HTMLButtonElement>(null);
  const [focusBack, setFocusBack] = useState(false);
  const report = useRef(onChange);
  report.current = onChange;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    report.current?.({ slots, messageCount: count, showMessageCount: showCount });
  }, [slots, count, showCount]);

  // Xoá/chặn xong: nút phụ kiện vừa mở đã biến mất, đưa tiêu điểm về "Về căn phòng".
  useEffect(() => {
    if (!focusBack || card) return;
    backBtn.current?.focus();
    setFocusBack(false);
  }, [focusBack, card]);

  useEffect(() => {
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let alive = true;
    api.getConfig().then(
      (c) => {
        if (!alive) return;
        syncClock(c.now);
        setNow(serverNow());
        setUnlockAt(Date.parse(c.unlockAt));
      },
      () => {},
    );
    const t = setInterval(() => setNow(serverNow()), TICK_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) return onUnauthorized();
    toast(e instanceof ApiError && e.status === 423 ? e.message : LOAD_FAILED);
  };

  const refresh = async () => {
    try {
      const r = await api.getOwnerTree(treeId);
      setSlots(r.slots);
      setCount(r.messageCount);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
    }
  };

  // Vừa qua mốc mở quà khi trang đang mở: tải lại một lần để phụ kiện hết "còn gói".
  const wasUnlocked = useRef<boolean | null>(null);
  useEffect(() => {
    if (unlockAt === null) return;
    const u = serverNow() >= unlockAt;
    if (wasUnlocked.current === false && u && meta.phase === 'BUILD') void refresh();
    wasUnlocked.current = u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, unlockAt]);

  const zoomed = camera !== null;
  const views = slotViews(slots, room.tree.slotCount, {}, now);
  const states: Record<number, OwnerState> = {};
  for (const s of slots) if (s.occupied) states[s.index] = stateOf(s);
  const order = slots.filter((s) => s.occupied && s.messageId).map((s) => s.index).sort((a, b) => a - b);

  const flashRing = (i: number) => {
    setRing((r) => ({ ...r, [i]: 'ring' }));
    timers.current.push(setTimeout(() => setRing(({ [i]: _, ...rest }) => rest), RING_MS));
  };

  const openAt = async (index: number) => {
    const s = slots.find((x) => x.index === index);
    if (!s?.occupied || !s.messageId) return;
    if (s.locked) {
      toast('Quà còn gói — mở được từ 0h 24/12');
      return flashRing(index);
    }
    setBusy(true);
    try {
      const message = await api.openMessage(treeId, s.messageId);
      setCard({ index, message });
      setSlots((ss) => ss.map((x) => (x.index === index ? { ...x, unread: false } : x)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast('Lời nhắn này không còn nữa');
        setCard(null);
        void refresh();
      } else fail(e);
    } finally {
      setBusy(false);
    }
  };

  const removeSlot = (index: number) => {
    setSlots((ss) => ss.map((x) => (x.index === index ? { index, occupied: false, locked: x.locked } : x)));
    setCount((n) => Math.max(0, n - 1));
    setCard(null);
    setFocusBack(true);
  };

  const act = async (run: () => Promise<unknown>, done: string, index: number) => {
    setBusy(true);
    try {
      await run();
      removeSlot(index);
      toast(done);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        removeSlot(index);
        toast('Lời nhắn này không còn nữa');
      } else fail(e);
    } finally {
      setBusy(false);
    }
  };

  const step = (dir: -1 | 1) => {
    if (!card) return;
    const pos = order.indexOf(card.index);
    const next = order[pos + dir];
    if (next !== undefined) void openAt(next);
  };

  const sendReport = async (reason: string) => {
    if (!card) return;
    setBusy(true);
    try {
      await api.report(treeId, { messageId: card.message.messageId, ...(reason ? { reason } : {}) });
      setSheet(null);
      toast('Đã gửi báo cáo, cảm ơn bạn');
    } catch (e) {
      // Server chỉ nhận báo cáo lời nhắn đã mở (đặc tả 8.5).
      if (e instanceof ApiError && e.code === 'not_opened') {
        setSheet(null);
        toast('Chỉ báo cáo được lời nhắn bạn đã mở.');
      } else fail(e);
    } finally {
      setBusy(false);
    }
  };

  const toggleCount = async (show: boolean) => {
    setBusy(true);
    try {
      const r = await api.setShowCount(treeId, show);
      setShowCount(r.showMessageCount);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteTree = async () => {
    setBusy(true);
    try {
      await api.deleteTree(treeId);
      storage.removeMyTree(treeId);
      toast('Đã xoá cây.');
      navigate('/');
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  // Trang mở qua 0h 24/12 vẫn chuyển sang mở quà (giai đoạn lúc tải trang có thể đã cũ).
  const unlocked = unlockAt !== null && now >= unlockAt;
  const canRead = meta.phase === 'OPEN' || meta.phase === 'NOTICE' || unlocked;
  // Đếm ngược ngắn ở góc trên bên phải (đè lên phòng); số lời nhắn ở khối dưới.
  const countdown = canRead ? 'Đã mở quà' : unlockAt !== null ? countdownText(unlockAt - now) : null;
  const status = showCount ? [`${count} lời nhắn`, ...(newCount > 0 ? [`${newCount} mới`] : [])].join(' · ') : '';
  const pos = card ? order.indexOf(card.index) : -1;

  return (
    <>
      <div className="room-stage">
        <RoomStage
          room={room}
          reserveTop={TOP_RESERVE}
          reserveBottom={BOTTOM_RESERVE}
          stageRef={stageRef}
          camera={camera}
          onFit={onFit}
          fx={fx}
          onItemTap={(clientId) => {
            const it = room.items.find((i) => i.clientId === clientId);
            if (it?.type !== 'tree') return tap(clientId);
            if (zoomed) return;
            zoomIn();
            void refresh();
          }}
          overlay={
            <>
              <TreeBubble room={room} hidden={zoomed} text={canRead ? 'Chạm vào cây để mở quà' : 'Chạm vào cây để xem lời nhắn'} />
              <SlotsLayer rects={slotRects(room)} views={views} fx={ring} onTap={(i) => void openAt(i)} hideEmpty states={states} interactive={zoomed} />
            </>
          }
        />
      </div>
      {countdown ? <div className="ow-countdown">{countdown}</div> : null}
      <div className="room-bottom">
        {status ? <p className="ow-status">{status}</p> : null}
        <div className="row" style={{ justifyContent: 'center' }}>
          {zoomed ? (
            <button ref={backBtn} type="button" className="btn btn-ghost" onClick={zoomOut}>
              <span aria-hidden="true">‹</span> Về căn phòng
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => setSheet('share')}>
                <span aria-hidden="true">🔗</span> Chia sẻ
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSheet('options')}>
                <span aria-hidden="true">⋯</span> Tuỳ chọn
              </button>
            </>
          )}
        </div>
      </div>
      {card && sheet !== 'report' ? (
        <MessageCard
          message={card.message}
          slotIndex={card.index}
          onNotice={toast}
          hasPrev={pos > 0}
          hasNext={pos >= 0 && pos < order.length - 1}
          busy={busy}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onDelete={() => void act(() => api.ownerDeleteMessage(treeId, card.message.messageId), 'Đã xoá lời nhắn', card.index)}
          onBlock={() => void act(() => api.blockSender(treeId, card.message.messageId), 'Đã chặn người gửi', card.index)}
          onReport={() => setSheet('report')}
          onClose={() => setCard(null)}
        />
      ) : null}
      {sheet === 'report' ? <ReportSheet busy={busy} onSubmit={(r) => void sendReport(r)} onClose={() => setSheet(null)} /> : null}
      {sheet === 'share' ? (
        <ShareSheet
          url={`${window.location.origin}/c/${treeId}`}
          title={meta.title || `Cây thông của ${meta.ownerName}`}
          toast={toast}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'options' ? (
        <OwnerOptions
          showCount={showCount}
          busy={busy}
          onToggleCount={(v) => void toggleCount(v)}
          onDeleteTree={() => void deleteTree()}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  );
}
