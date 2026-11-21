import { useState } from 'react';
import { ornamentSVGSoft } from '@ctln/art/ornaments';
import type { OpenedMessage } from '../lib/api';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Sheet } from '../ui/Sheet';
import { formatSentAt } from './countdown';

type Props = {
  message: OpenedMessage;
  hasPrev: boolean;
  hasNext: boolean;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDelete: () => void;
  onBlock: () => void;
  onReport: () => void;
  onClose: () => void;
};

/** Thẻ lời nhắn của chủ cây (đặc tả 9.6, 6.6.2). Nội dung là chữ thuần (React text). */
export function MessageCard({ message: m, hasPrev, hasNext, busy, onPrev, onNext, onDelete, onBlock, onReport, onClose }: Props) {
  const [ask, setAsk] = useState<null | 'delete' | 'block'>(null);
  const title = m.anonymous || !m.authorName ? 'Lời nhắn ẩn danh' : `Lời nhắn từ ${m.authorName}`;
  return (
    <Sheet title={title} onClose={onClose} className="ow-card">
      <div className="ow-card-head">
        <svg viewBox="-30 -6 60 60" width="48" height="48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ornamentSVGSoft(m.ornament, 'read', null) }} />
        <span className="hint">{formatSentAt(m.createdAt)}</span>
      </div>
      <p className="ow-content" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
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
    </Sheet>
  );
}
