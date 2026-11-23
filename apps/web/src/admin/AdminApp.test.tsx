import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { adminApi } from './adminApi';
import { AdminApp } from './AdminApp';

vi.mock('./adminApi', async (orig) => {
  const actual = await orig<typeof import('./adminApi')>();
  return {
    ...actual,
    adminApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn(), overview: vi.fn() },
  };
});
vi.mock('../ui/GoogleButton', () => ({
  GoogleButton: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken('tok')}>Google giả</button>
  ),
}));

const mocked = vi.mocked(adminApi);
const ME = { email: 'admin@test.vn', csrfToken: 'c' };
const overview = (openReports = 2) => ({ users: { openReports } }) as Awaited<ReturnType<typeof adminApi.overview>>;

const renderAdmin = (path = '/quan-tri') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/quan-tri/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => vi.resetAllMocks());
afterEach(() => document.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove()));

describe('AdminApp', () => {
  it('chưa đăng nhập → màn đăng nhập; đăng nhập xong thấy thanh bên có email và số báo cáo chờ', async () => {
    mocked.me.mockRejectedValue(new ApiError(401, 'admin_required', 'x'));
    mocked.login.mockResolvedValue(ME);
    mocked.overview.mockResolvedValue(overview(3));
    renderAdmin();
    await userEvent.click(await screen.findByRole('button', { name: 'Google giả' }));
    expect(mocked.login).toHaveBeenCalledWith('tok');
    expect(await screen.findByText('admin@test.vn')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Báo cáo.*3/ })).toHaveAttribute('href', '/quan-tri/bao-cao');
    for (const name of ['Tổng quan', 'Tra cứu phòng', 'Nhật ký']) expect(screen.getByRole('link', { name })).toBeInTheDocument();
  });

  it('email không có quyền → báo lỗi trên màn đăng nhập', async () => {
    mocked.me.mockRejectedValue(new ApiError(401, 'admin_required', 'x'));
    mocked.login.mockRejectedValue(new ApiError(403, 'not_admin', 'x'));
    renderAdmin();
    await userEvent.click(await screen.findByRole('button', { name: 'Google giả' }));
    expect(await screen.findByText('Tài khoản này không có quyền quản trị')).toBeInTheDocument();
  });

  it('phiên hết hạn giữa chừng (401) → về màn đăng nhập, không gọi me lặp lại', async () => {
    mocked.me.mockResolvedValue(ME);
    mocked.overview.mockRejectedValue(new ApiError(401, 'admin_required', 'x'));
    renderAdmin();
    expect(await screen.findByRole('button', { name: 'Google giả' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(mocked.me).toHaveBeenCalledTimes(1);
  });

  it('đăng xuất → gọi logout và về màn đăng nhập', async () => {
    mocked.me.mockResolvedValue(ME);
    mocked.overview.mockResolvedValue(overview());
    mocked.logout.mockResolvedValue(undefined);
    renderAdmin();
    await userEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(mocked.logout).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Google giả' })).toBeInTheDocument();
  });

  it('gắn meta robots noindex khi mở, gỡ khi rời trang', async () => {
    mocked.me.mockResolvedValue(ME);
    mocked.overview.mockResolvedValue(overview());
    const { unmount } = renderAdmin();
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex'));
    unmount();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});
