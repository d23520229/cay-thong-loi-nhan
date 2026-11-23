import { useEffect, useMemo, useRef, useState } from 'react';
import { ornamentSVGSoft } from '@ctln/art/ornaments';
import { api, type OpenedMessage } from '../lib/api';
import { CardCanvas } from '../card/CardCanvas';
import { CardViewer } from '../card/CardViewer';
import { downloadCard } from '../card/download';
import { renderCardBlob } from '../card/draw';
import { bitmapFromBlob } from '../card/photo';
import { signText } from '../card/layout';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Sheet } from '../ui/Sheet';
import { formatSentAt } from './countdown';

type Props = {
  treeId: string;
  message: OpenedMessage;
  slotIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDelete: () => void;
  onBlock: () => void;
  onReport: () => void;
  onClose: () => void;
  onNotice?: (m: string) => void;
};

/** Thẻ lời nhắn của chủ cây (đặc tả 9.6, 6.6.2). Nội dung vẽ lên canvas thiệp (chữ thuần, không HTML). */
export function MessageCard({ treeId, message: m, slotIndex, hasPrev, hasNext, busy, onPrev, onNext, onDelete, onBlock, onReport, onClose, onNotice }: Props) {
  const [ask, setAsk] = useState<null | 'delete' | 'block'>(null);
  const [viewing, setViewing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Ảnh kèm, ghi theo lời nhắn (đổi Trước/Sau thì không lẫn ảnh cũ); tải lỗi thì hiện thiệp không ảnh.
  const [got, setGot] = useState<{ mid: string; bm: ImageBitmap | null } | null>(null);
  useEffect(() => {
    if (!m.hasPhoto) return;
    let alive = true;
    let bitmap: ImageBitmap | null = null;
    api
      .getOwnerPhoto(treeId, m.messageId)
      .then((b) => (b ? bitmapFromBlob(b) : null))
      .catch(() => null)
      .then((bm) => {
        if (!alive) return bm?.close?.();
        bitmap = bm;
        setGot({ mid: m.messageId, bm });
      });
    return () => {
      alive = false;
      bitmap?.close?.();
    };
  }, [treeId, m.messageId, m.hasPhoto]);
  const photo = !m.hasPhoto ? null : got?.mid === m.messageId ? got.bm : 'loading';
  const loading = photo === 'loading';
  const data = useMemo(
    () => ({ content: m.content, sign: signText(m.anonymous, m.authorName), sentAt: m.createdAt, photo: loading ? null : photo }),
    [m.content, m.anonymous, m.authorName, m.createdAt, photo, loading],
  );
  // Dựng sẵn ảnh để bấm "Tải ảnh" gọi chia sẻ ngay trong thao tác chạm (iOS đòi vậy).
  const ready = useRef<{ data: typeof data; blob: Blob } | null>(null);
  // Nút khoá tới khi dựng xong; dựng sẵn lỗi thì mở khoá, bấm sẽ thử dựng lại (có báo lỗi nếu vẫn hỏng).
  const [preparing, setPreparing] = useState(true);
  useEffect(() => {
    let alive = true;
    ready.current = null;
    setPreparing(true);
    if (loading) return;
    renderCardBlob(data).then(
      (blob) => {
        if (!alive) return;
        ready.current = { data, blob };
        setPreparing(false);
      },
      () => alive && setPreparing(false),
    );
    return () => {
      alive = false;
    };
  }, [data, loading]);
  const save = async () => {
    setSaving(true);
    try {
      const pre = ready.current?.data === data ? ready.current.blob : null;
      await downloadCard(pre ?? (await renderCardBlob(data)), `loi-nhan-${slotIndex + 1}.png`);
    } catch {
      onNotice?.('Chưa lưu được ảnh, thử lại nhé');
    } finally {
      setSaving(false);
    }
  };
  const title = m.anonymous || !m.authorName ? 'Lời nhắn ẩn danh' : `Lời nhắn từ ${m.authorName}`;
  return (
    <Sheet title={title} onClose={onClose} className="ow-card cd-frame">
      <div className="ow-card-head">
        <svg viewBox="-30 -6 60 60" width="48" height="48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ornamentSVGSoft(m.ornament, 'read', null) }} />
        <span className="hint">{formatSentAt(m.createdAt)}</span>
      </div>
      {loading ? <div className="cd-canvas cd-loading" aria-busy="true" /> : <CardCanvas data={data} onTap={() => setViewing(true)} />}
      <button type="button" className="chip cd-save" disabled={saving || loading || preparing} onClick={() => void save()}>{preparing && !loading ? 'Đang chuẩn bị…' : '⬇ Tải ảnh'}</button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="chip" disabled={!hasPrev || busy} onClick={onPrev}>‹ Trước</button>
        <button type="button" className="chip" disabled={!hasNext || busy} onClick={onNext}>Sau ›</button>
      </div>
      <div className="row">
        <button type="button" className="chip" disabled={busy} onClick={() => setAsk('delete')}>Xoá</button>
        <button type="button" className="chip" disabled={busy} onClick={() => setAsk('block')}>Chặn người gửi</button>
        <button type="button" className="chip" disabled={busy} onClick={onReport}>Báo cáo</button>
      </div>
      {ask === 'delete' ? (
        <ConfirmDialog
          title="Xoá lời nhắn này?"
          message="Phụ kiện sẽ được gỡ khỏi cây."
          confirmLabel="Xoá"
          cancelLabel="Không xoá"
          onConfirm={() => {
            setAsk(null);
            onDelete();
          }}
          onCancel={() => setAsk(null)}
        />
      ) : null}
      {ask === 'block' ? (
        <ConfirmDialog
          title="Chặn người gửi?"
          message="Lời nhắn này sẽ bị xoá và người đó không gửi được tới cây của bạn nữa."
          confirmLabel="Chặn"
          cancelLabel="Không chặn"
          onConfirm={() => {
            setAsk(null);
            onBlock();
          }}
          onCancel={() => setAsk(null)}
        />
      ) : null}
      {viewing ? <CardViewer data={data} onClose={() => setViewing(false)} /> : null}
    </Sheet>
  );
}
