import { act, render, screen, within } from '@testing-library/react';
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
const { getOwnerPhoto, bitmapFromBlob } = vi.hoisted(() => ({ getOwnerPhoto: vi.fn(), bitmapFromBlob: vi.fn() }));
vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return { ...actual, api: { ...actual.api, getOwnerPhoto } };
});
vi.mock('../card/photo', () => ({ bitmapFromBlob }));
import { ReportSheet } from './ReportSheet';

const msg = (over: Partial<OpenedMessage> = {}): OpenedMessage => ({
  messageId: '5', slotIndex: 2, ornament: 'bell', anonymous: false, authorName: 'An',
  content: 'Chúc mừng', createdAt: '2026-11-21T13:05:00Z', hasPhoto: false, ...over,
});
const noop = () => {};
const card = (over: Partial<Parameters<typeof MessageCard>[0]> = {}) =>
  render(
    <MessageCard treeId="abcdefgh" message={msg()} slotIndex={2} hasPrev={false} hasNext busy={false} onPrev={noop} onNext={noop}
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
    await userEvent.click(await screen.findByRole('button', { name: '⬇ Tải ảnh' }));
    await vi.waitFor(() => expect(downloadCard).toHaveBeenCalledTimes(1));
    expect(renderCardBlob).toHaveBeenCalledWith(expect.objectContaining({ content: 'Chúc mừng', sign: '— An', sentAt: '2026-11-21T13:05:00Z' }));
    expect(downloadCard).toHaveBeenCalledWith(expect.any(Blob), 'loi-nhan-3.png');
  });

  it('chưa dựng xong → nút khoá, chữ "Đang chuẩn bị…"; dựng xong thì mở', async () => {
    let done!: (b: Blob) => void;
    renderCardBlob.mockImplementationOnce(() => new Promise<Blob>((res) => { done = res; }));
    card();
    const btn = screen.getByRole('button', { name: 'Đang chuẩn bị…' });
    expect(btn).toBeDisabled();
    await act(async () => { done(new Blob(['x'], { type: 'image/png' })); });
    expect(screen.getByRole('button', { name: '⬇ Tải ảnh' })).toBeEnabled();
  });

  it('dựng sẵn lỗi → mở khoá, bấm vẫn thử dựng lại', async () => {
    renderCardBlob.mockClear();
    downloadCard.mockClear();
    renderCardBlob.mockRejectedValueOnce(new Error('hỏng'));
    card();
    await userEvent.click(await screen.findByRole('button', { name: '⬇ Tải ảnh' }));
    await vi.waitFor(() => expect(downloadCard).toHaveBeenCalledTimes(1));
    expect(renderCardBlob).toHaveBeenCalledTimes(2);
  });

  it('dùng ảnh dựng sẵn, không dựng lại khi bấm', async () => {
    renderCardBlob.mockClear();
    downloadCard.mockClear();
    card();
    await vi.waitFor(() => expect(renderCardBlob).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.click(screen.getByRole('button', { name: '⬇ Tải ảnh' }));
    await vi.waitFor(() => expect(downloadCard).toHaveBeenCalledTimes(1));
    expect(renderCardBlob).toHaveBeenCalledTimes(1);
  });

  it('huỷ chia sẻ không báo lỗi; lỗi thật báo đúng một lần', async () => {
    const onNotice = vi.fn();
    downloadCard.mockClear();
    downloadCard.mockResolvedValueOnce('cancelled');
    card({ onNotice });
    await userEvent.click(await screen.findByRole('button', { name: '⬇ Tải ảnh' }));
    await vi.waitFor(() => expect(downloadCard).toHaveBeenCalledTimes(1));
    expect(onNotice).not.toHaveBeenCalled();
    downloadCard.mockRejectedValueOnce(new Error('x'));
    await userEvent.click(screen.getByRole('button', { name: '⬇ Tải ảnh' }));
    await vi.waitFor(() => expect(onNotice).toHaveBeenCalledTimes(1));
    expect(onNotice).toHaveBeenCalledWith('Chưa lưu được ảnh, thử lại nhé');
  });

  it('hasPhoto → gọi getOwnerPhoto, thiệp nhận photo; tải ảnh có ảnh', async () => {
    const blob = new Blob(['w'], { type: 'image/webp' });
    const bitmap = { width: 4, height: 3, close: vi.fn() };
    getOwnerPhoto.mockResolvedValue(blob);
    bitmapFromBlob.mockResolvedValue(bitmap);
    renderCardBlob.mockClear();
    downloadCard.mockClear();
    const { unmount } = card({ message: msg({ hasPhoto: true }) });
    expect(getOwnerPhoto).toHaveBeenCalledWith('abcdefgh', '5');
    await vi.waitFor(() => expect(renderCardBlob).toHaveBeenCalledWith(expect.objectContaining({ photo: bitmap })));
    expect(renderCardBlob).not.toHaveBeenCalledWith(expect.objectContaining({ photo: null }));
    expect(screen.getByRole('img', { name: 'Chúc mừng — An' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '⬇ Tải ảnh' }));
    await vi.waitFor(() => expect(downloadCard).toHaveBeenCalledTimes(1));
    expect(renderCardBlob.mock.calls.every((c) => (c as unknown[])[0] && ((c as unknown[])[0] as { photo?: unknown }).photo === bitmap)).toBe(true);
    unmount();
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('getOwnerPhoto lỗi → vẫn hiện thiệp không ảnh, không vỡ', async () => {
    getOwnerPhoto.mockRejectedValue(new Error('x'));
    renderCardBlob.mockClear();
    card({ message: msg({ hasPhoto: true }) });
    await vi.waitFor(() => expect(renderCardBlob).toHaveBeenCalledWith(expect.objectContaining({ photo: null })));
    expect(screen.getByRole('img', { name: 'Chúc mừng — An' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '⬇ Tải ảnh' })).toBeEnabled();
  });

  it('không có ảnh → không gọi getOwnerPhoto', () => {
    getOwnerPhoto.mockClear();
    card();
    expect(getOwnerPhoto).not.toHaveBeenCalled();
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
