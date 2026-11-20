import { useEffect, useRef, type KeyboardEvent } from 'react';

type Props = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Hộp hỏi lại trước thao tác làm mất dữ liệu. Tiêu điểm vào nút an toàn; Escape = huỷ hộp này (không lan ra bảng bên dưới). */
export function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const safe = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    safe.current?.focus({ preventScroll: true });
    // Đóng hộp thì trả tiêu điểm về chỗ cũ (để Escape / Tab của bảng bên dưới vẫn chạy).
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const sure = useRef<HTMLButtonElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Tab') {
      // Giữ tiêu điểm trong hộp (hai nút), không để bẫy Tab của bảng phía sau kéo ra ngoài.
      e.stopPropagation();
      e.preventDefault();
      (document.activeElement === safe.current ? sure : safe).current?.focus();
    }
  };
  return (
    <div className="cfm-backdrop" onKeyDown={onKeyDown}>
      <div className="cfm" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="sheet-title">{title}</div>
        {message ? <p className="hint">{message}</p> : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button ref={sure} type="button" className="chip" onClick={onConfirm}>{confirmLabel}</button>
          <button ref={safe} type="button" className="btn btn-primary" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
