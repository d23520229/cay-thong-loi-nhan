import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OpenedMessage } from '../lib/api';
import { MessageCard } from './MessageCard';

const { renderCardBlob, downloadCard } = vi.hoisted(() => ({
  renderCardBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' })),
  downloadCard: vi.fn(async () => 'downloaded'),
}));
vi.mock('../card/draw', async (orig) => ({ ...(await orig<typeof import('../card/draw')>()), renderCardBlob }));
vi.mock('../card/download', () => ({ downloadCard }));
import { ReportSheet } from './ReportSheet';

const msg = (over: Partial<OpenedMessage> = {}): OpenedMessage => ({
  messageId: '5', slotIndex: 2, ornament: 'bell', anonymous: false, authorName: 'An',
  content: 'Chúc mừng', createdAt: '2026-11-21T13:05:00Z', ...over,
});
const noop = () => {};
const card = (over: Partial<Parameters<typeof MessageCard>[0]> = {}) =>
  render(
    <MessageCard message={msg()} slotIndex={2} hasPrev={false} hasNext busy={false} onPrev={noop} onNext={noop}
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

  it('hiện thiệp (role img có nội dung) thay khối chữ cũ', () => {
    const { container } = card({ message: msg({ content: '<b>x</b>' }) });
    expect(screen.getByRole('img', { name: '<b>x</b> — An' })).toBeInTheDocument();
    expect(container.querySelector('.ow-content')).toBeNull();
  });

  it('nút ⬇ Tải ảnh gọi renderCardBlob + downloadCard', async () => {
    card({ slotIndex: 2 });
    await userEvent.click(screen.getByRole('button', { name: '⬇ Tải ảnh' }));
    await vi.waitFor(() => expect(downloadCard).toHaveBeenCalledTimes(1));
    expect(renderCardBlob).toHaveBeenCalledWith(expect.objectContaining({ content: 'Chúc mừng', sign: '— An', sentAt: '2026-11-21T13:05:00Z' }));
    expect(downloadCard).toHaveBeenCalledWith(expect.any(Blob), 'loi-nhan-3.png');
  });

  it('chạm thiệp mở CardViewer', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as never;
    card();
    await userEvent.click(screen.getByRole('img', { name: 'Chúc mừng — An' }));
    expect(screen.getAllByRole('img', { name: 'Chúc mừng — An' })).toHaveLength(2);
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
