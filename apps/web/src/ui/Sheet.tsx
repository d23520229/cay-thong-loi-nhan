import type { ReactNode } from 'react';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet" role="dialog" aria-label={title}>
      <div className="sheet-head">
        <div className="sheet-title">{title}</div>
        <button type="button" className="tb" aria-label="Đóng" onClick={onClose}>✕</button>
      </div>
      <div className="sheet-body scroll-y">{children}</div>
    </div>
  );
}
