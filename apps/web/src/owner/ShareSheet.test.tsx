import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMobile, ShareSheet } from './ShareSheet';

const URL_ = 'http://localhost:5173/c/abcdefgh';
const toast = vi.fn();
const openUrl = vi.fn();
const writeText = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  writeText.mockResolvedValue(undefined);
});
afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).share;
});

const show = (mobile = false) =>
  render(<ShareSheet treeId="abcdefgh" url={URL_} title="Cây của Lan" toast={toast} onClose={() => {}} openUrl={openUrl} mobile={mobile} />);

describe('ShareSheet', () => {
  it('hiện link, Sao chép ghi vào clipboard', async () => {
    show();
    expect(screen.getByRole('textbox', { name: 'Link gửi bạn bè' })).toHaveValue(URL_);
    await userEvent.click(screen.getByRole('button', { name: 'Sao chép' }));
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(toast).toHaveBeenCalledWith('Đã sao chép link');
  });

  it('clipboard lỗi: chọn sẵn chữ trong ô và hướng dẫn', async () => {
    writeText.mockRejectedValue(new Error('no'));
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Sao chép' }));
    const box = screen.getByRole('textbox', { name: 'Link gửi bạn bè' }) as HTMLInputElement;
    expect(box.selectionStart).toBe(0);
    expect(box.selectionEnd).toBe(URL_.length);
    expect(toast).toHaveBeenCalledWith('Hãy giữ vào ô link để sao chép');
  });

  it('không có Web Share thì không có nút "Chia sẻ…"; có thì gọi share', async () => {
    const { unmount } = show();
    expect(screen.queryByRole('button', { name: 'Chia sẻ…' })).not.toBeInTheDocument();
    unmount();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Chia sẻ…' }));
    expect(share).toHaveBeenCalledWith({ title: 'Cây của Lan', text: expect.stringContaining('Treo một lời nhắn'), url: URL_ });
  });

  it('Messenger trên điện thoại mở app; trên máy tính sao chép', async () => {
    const { unmount } = show(true);
    await userEvent.click(screen.getByRole('button', { name: 'Messenger' }));
    expect(openUrl).toHaveBeenCalledWith('fb-messenger://share/?link=' + encodeURIComponent(URL_));
    unmount();
    show(false);
    await userEvent.click(screen.getByRole('button', { name: 'Messenger' }));
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(toast).toHaveBeenCalledWith('Đã sao chép — dán vào Messenger nhé');
  });

  it('Zalo sao chép link và hướng dẫn dán', async () => {
    show(true);
    await userEvent.click(screen.getByRole('button', { name: 'Zalo' }));
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(toast).toHaveBeenCalledWith('Đã sao chép — mở Zalo và dán vào nhé');
  });

  it('có link ⬇ Tải ảnh phòng với href /api/trees/{id}/image.png và thuộc tính download', () => {
    show();
    const a = screen.getByRole('link', { name: '⬇ Tải ảnh phòng' });
    expect(a).toHaveAttribute('href', '/api/trees/abcdefgh/image.png');
    expect(a).toHaveAttribute('download');
  });

  it('isMobile nhận Android / iPhone / iPad', () => {
    expect(isMobile('Mozilla/5.0 (Linux; Android 14)')).toBe(true);
    expect(isMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(true);
    expect(isMobile('Mozilla/5.0 (Windows NT 10.0; Win64)')).toBe(false);
  });
});
