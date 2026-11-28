import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { resetConfigForTest } from '../lib/config';
import { PolicyPage } from './PolicyPage';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return { ...actual, api: { getConfig: vi.fn() } };
});
const mocked = vi.mocked(api);

beforeEach(() => {
  vi.resetAllMocks();
  resetConfigForTest();
});

const renderPage = () => render(<MemoryRouter><PolicyPage /></MemoryRouter>);

describe('PolicyPage (đặc tả 6.9.2)', () => {
  it('có đủ các mục và các lời hứa chính', async () => {
    mocked.getConfig.mockResolvedValue({ supportEmail: 'hotro@x.vn', purgeAt: '2027-01-06T17:00:00.000Z' } as never);
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Chính sách riêng tư' })).toBeInTheDocument();
    for (const h of ['Lưu gì', 'Ai thấy gì', 'Giữ bao lâu', 'Lưu trên trình duyệt', 'Liên hệ']) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    }
    const text = document.body.textContent!;
    for (const t of ['không lưu tên hay email Google', '7 ngày', '07/01/2027', 'không mã hoá đầu-cuối', 'cam kết không xem',
      'tên bạn ghi lần trước', 'mã sửa lời nhắn', 'cookie', 'accounts.google.com']) {
      expect(text).toContain(t);
    }
    expect(await screen.findByRole('link', { name: 'hotro@x.vn' })).toHaveAttribute('href', 'mailto:hotro@x.vn');
    expect(screen.getByRole('link', { name: /Về trang chủ/ })).toHaveAttribute('href', '/');
  });

  it('config chưa tải: vẫn có ngày xoá dự phòng 07/01/2027', () => {
    mocked.getConfig.mockReturnValue(new Promise(() => {}) as never);
    renderPage();
    expect(document.body.textContent).toContain('07/01/2027');
  });
});
