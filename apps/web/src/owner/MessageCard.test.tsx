import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OpenedMessage } from '../lib/api';
import { MessageCard } from './MessageCard';
import { ReportSheet } from './ReportSheet';

const msg = (over: Partial<OpenedMessage> = {}): OpenedMessage => ({
  messageId: '5', slotIndex: 2, ornament: 'bell', anonymous: false, authorName: 'An',
  content: 'Chúc mừng', createdAt: '2026-11-21T13:05:00Z', ...over,
});
const noop = () => {};
const card = (over: Partial<Parameters<typeof MessageCard>[0]> = {}) =>
  render(
    <MessageCard message={msg()} hasPrev={false} hasNext busy={false} onPrev={noop} onNext={noop}
      onDelete={noop} onBlock={noop} onReport={noop} onClose={noop} {...over} />,
  );

describe('MessageCard', () => {
  it('tiêu đề có tên người gửi, thời gian giờ Việt Nam', () => {
    card();
    expect(screen.getByRole('dialog', { name: 'Lời nhắn từ An' })).toBeInTheDocument();
    expect(screen.getByText('21/11 lúc 20:05')).toBeInTheDocument();
  });

  it('ẩn danh', () => {
    card({ message: msg({ anonymous: true, authorName: null }) });
    expect(screen.getByRole('dialog', { name: 'Lời nhắn ẩn danh' })).toBeInTheDocument();
  });

  it('nội dung có HTML hiện nguyên chữ, giữ xuống dòng', () => {
    const { container } = card({ message: msg({ content: '<b>x</b>\nhai dòng' }) });
    const body = screen.getByText((_, el) => el?.classList.contains('ow-content') ?? false);
    expect(body.textContent).toBe('<b>x</b>\nhai dòng');
    expect(container.querySelector('.ow-content b')).toBeNull();
    expect(body).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('trước/sau gọi callback, khoá đúng', async () => {
    const onNext = vi.fn();
    card({ onNext });
    expect(screen.getByRole('button', { name: '‹ Trước' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Sau ›' }));
    expect(onNext).toHaveBeenCalled();
  });

  it('Xoá và Chặn hỏi lại trước khi gọi', async () => {
    const onDelete = vi.fn();
    const onBlock = vi.fn();
    card({ onDelete, onBlock });
    await userEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    const ask = screen.getByRole('alertdialog', { name: 'Xoá lời nhắn này?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Xoá' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Chặn người gửi' }));
    const ask2 = screen.getByRole('alertdialog', { name: 'Chặn người gửi?' });
    expect(ask2).toHaveTextContent('không gửi được tới cây của bạn nữa');
    await userEvent.click(within(ask2).getByRole('button', { name: 'Không chặn' }));
    expect(onBlock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Chặn người gửi' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Chặn' }));
    expect(onBlock).toHaveBeenCalledTimes(1);
  });

  it('Báo cáo gọi onReport', async () => {
    const onReport = vi.fn();
    card({ onReport });
    await userEvent.click(screen.getByRole('button', { name: 'Báo cáo' }));
    expect(onReport).toHaveBeenCalled();
  });
});

describe('ReportSheet', () => {
  it('lý do ≤ 200, gửi chuỗi đã trim', async () => {
    const onSubmit = vi.fn();
    render(<ReportSheet busy={false} onSubmit={onSubmit} onClose={noop} />);
    const box = screen.getByRole('textbox', { name: /Lý do/ });
    expect(box).toHaveAttribute('maxlength', '200');
    await userEvent.type(box, '  nội dung xấu  ');
    await userEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));
    expect(onSubmit).toHaveBeenCalledWith('nội dung xấu');
  });

  it('đang gửi thì khoá nút', () => {
    render(<ReportSheet busy onSubmit={noop} onClose={noop} />);
    expect(screen.getByRole('button', { name: 'Gửi báo cáo' })).toBeDisabled();
  });
});
