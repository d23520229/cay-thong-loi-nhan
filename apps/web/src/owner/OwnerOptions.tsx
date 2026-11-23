import { useState } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Sheet } from '../ui/Sheet';
import { SupportHint } from '../ui/SupportHint';

type Props = {
  showCount: boolean;
  busy: boolean;
  onToggleCount: (show: boolean) => void;
  onDeleteTree: () => void;
  onClose: () => void;
};

/** "⋯ Tuỳ chọn" của chủ cây: bật/tắt số lời nhắn (O10), xoá cây (O5), email hỗ trợ (6.8.7). */
export function OwnerOptions({ showCount, busy, onToggleCount, onDeleteTree, onClose }: Props) {
  const [ask, setAsk] = useState(false);
  return (
    <Sheet title="Tuỳ chọn" onClose={onClose}>
      <label className="ow-switch">
        <input type="checkbox" checked={showCount} disabled={busy} onChange={(e) => onToggleCount(e.target.checked)} />
        <span>Hiện số lời nhắn</span>
      </label>
      <p className="hint">Tắt nếu bạn muốn để dành bất ngờ đến đêm 24/12.</p>
      <button type="button" className="chip ow-danger" disabled={busy} onClick={() => setAsk(true)}>Xoá cây này</button>
      <SupportHint />
      {ask ? (
        <ConfirmDialog
          title="Xoá cây và mọi lời nhắn?"
          message="Không khôi phục được."
          confirmLabel="Xoá cây"
          cancelLabel="Giữ lại"
          onConfirm={() => {
            setAsk(false);
            onDeleteTree();
          }}
          onCancel={() => setAsk(false)}
        />
      ) : null}
    </Sheet>
  );
}
