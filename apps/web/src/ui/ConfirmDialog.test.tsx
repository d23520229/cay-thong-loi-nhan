import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Sheet } from './Sheet';

describe('ConfirmDialog', () => {
  it('lấy tiêu điểm không cuộn phòng phía sau (preventScroll)', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<ConfirmDialog title="Chắc chưa?" confirmLabel="Có" cancelLabel="Không" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const no = screen.getByRole('button', { name: 'Không' });
    const call = focus.mock.calls.find((_, i) => focus.mock.contexts[i] === no);
    expect(call?.[0]).toEqual({ preventScroll: true });
    focus.mockRestore();
  });

  it('Tab xoay vòng trong hộp, không lọt ra bảng phía sau', async () => {
    // Như thật: bảng mở trước, hộp xác nhận mở sau.
    const ui = (ask: boolean) => (
      <Sheet title="Bảng" onClose={vi.fn()}>
        {ask ? <ConfirmDialog title="Chắc chưa?" confirmLabel="Có" cancelLabel="Không" onConfirm={vi.fn()} onCancel={vi.fn()} /> : null}
      </Sheet>
    );
    const { rerender } = render(ui(false));
    rerender(ui(true));
    const yes = screen.getByRole('button', { name: 'Có' });
    const no = screen.getByRole('button', { name: 'Không' });
    expect(document.activeElement).toBe(no);
    await userEvent.tab();
    expect(document.activeElement).toBe(yes);
    await userEvent.tab();
    expect(document.activeElement).toBe(no);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(yes);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(no);
  });
});
