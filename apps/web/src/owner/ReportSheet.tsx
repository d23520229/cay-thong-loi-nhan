import { useState } from 'react';
import { Sheet } from '../ui/Sheet';

const REASON_MAX = 200;

/** Báo cáo một lời nhắn cho quản trị viên (đặc tả 6.6.2). Lý do không bắt buộc. */
export function ReportSheet({ busy, onSubmit, onClose }: { busy: boolean; onSubmit: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <Sheet title="Báo cáo lời nhắn" onClose={onClose}>
      <p className="hint">Quản trị viên sẽ xem lời nhắn này. Bạn có thể ghi thêm lý do.</p>
      <label className="ed-field">
        <span className="lab">Lý do (không bắt buộc)</span>
        <textarea className="input" rows={3} maxLength={REASON_MAX} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSubmit(reason.trim())}>Gửi báo cáo</button>
      </div>
    </Sheet>
  );
}
