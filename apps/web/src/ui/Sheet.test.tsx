import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet';

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Mở</button>
      {open ? (
        <Sheet title="Bảng thử" onClose={() => { onClose(); setOpen(false); }}>
          <input aria-label="Ô một" />
          <button type="button">Nút cuối</button>
        </Sheet>
      ) : null}
    </>
  );
}

describe('Sheet', () => {
  it('lấy tiêu điểm không cuộn phòng phía sau (preventScroll) — bảng mở không làm phòng nảy lên', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở' }));
    const dialog = screen.getByRole('dialog');
    const call = focus.mock.calls.find((_, i) => focus.mock.contexts[i] === dialog);
    expect(call?.[0]).toEqual({ preventScroll: true });
    focus.mockRestore();
  });

  it('là hộp thoại modal có tên', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở' }));
    const d = screen.getByRole('dialog', { name: 'Bảng thử' });
    expect(d).toHaveAttribute('aria-modal', 'true');
  });

  it('mở thì tiêu điểm vào trong bảng; Escape đóng và trả tiêu điểm về nút mở', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Mở' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('Tab / Shift+Tab xoay vòng trong bảng', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở' }));
    const close = screen.getByRole('button', { name: 'Đóng' });
    const last = screen.getByRole('button', { name: 'Nút cuối' });
    last.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });
});
