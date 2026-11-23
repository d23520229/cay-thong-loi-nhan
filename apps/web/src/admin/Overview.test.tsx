import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi, type Overview as O } from './adminApi';
import { AdminContext } from './context';
import { Overview } from './Overview';

vi.mock('./adminApi', async (orig) => {
  const actual = await orig<typeof import('./adminApi')>();
  return { ...actual, adminApi: { overview: vi.fn() } };
});
const mocked = vi.mocked(adminApi);

const GB = 1024 ** 3;
const data = (over: Partial<O['server']> = {}, users: Partial<O['users']> = {}): O => ({
  now: '2026-12-01T03:00:00.000Z',
  phase: 'BUILD',
  next: { key: 'unlockAt', at: '2026-12-23T17:00:00.000Z' },
  users: {
    trees: { total: 120, last24h: 7 }, messages: { total: 900, last24h: 55 }, views: { total: 4000, last24h: 300 },
    openReports: 2, viral: 1 / 3, ...users,
  },
  server: {
    errors24h: 3, lastError: { at: '2026-12-01T02:40:00.000Z', route: '/api/trees/:id/messages', status: 500 },
    p95Ms: 180, latencySince: '2026-12-01T02:00:00.000Z', dbBytes: 12 * 1024 ** 2, dbQuotaBytes: 32 * GB,
    photos: { count: 40, bytes: 8 * 1024 ** 2, unknown: 0, reportSnapshots: 1 }, azureUrl: null, ...over,
  },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminContext.Provider value={{ email: 'a@b.vn', onError: (e) => String(e), refreshCount: () => {} }}>
        <Overview />
      </AdminContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe('Tổng quan', () => {
  it('giai đoạn, đếm ngược, ba thẻ người dùng, báo cáo chờ, lan truyền', async () => {
    mocked.overview.mockResolvedValue(data());
    renderPage();
    expect(await screen.findByText('Đang trang trí')).toBeInTheDocument();
    expect(screen.getByText(/Mở quà còn 22 ngày 14 giờ 0 phút/)).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('+7 trong 24 giờ')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('4000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('href', '/quan-tri/bao-cao');
    expect(screen.getByText('0,33')).toBeInTheDocument();
  });

  it('khối máy chủ: lỗi gần nhất, p95, CSDL, kho ảnh; không có link Azure khi chưa đặt', async () => {
    mocked.overview.mockResolvedValue(data());
    renderPage();
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(screen.getByText(/500 · \/api\/trees\/:id\/messages/)).toBeInTheDocument();
    expect(screen.getByText('180 ms')).toBeInTheDocument();
    expect(screen.getByText('12 MB / 32 GB')).toBeInTheDocument();
    expect(screen.getByText('40 ảnh · 8 MB')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Azure/ })).not.toBeInTheDocument();
  });

  it('chưa có số liệu, khởi động chưa đủ 60 phút, ảnh chưa rõ dung lượng, có Azure, lan truyền null', async () => {
    mocked.overview.mockResolvedValue(data(
      { p95Ms: null, latencySince: '2026-12-01T02:30:00.000Z', lastError: null, errors24h: 0, photos: { count: 3, bytes: 0, unknown: 2, reportSnapshots: 0 }, azureUrl: 'https://portal.azure.com/rg' },
      { viral: null },
    ));
    renderPage();
    expect(await screen.findByText(/chưa có số liệu/)).toBeInTheDocument();
    expect(screen.getByText(/từ \d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText('2 ảnh chưa rõ dung lượng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Azure/ })).toHaveAttribute('href', 'https://portal.azure.com/rg');
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Không có lỗi')).toBeInTheDocument();
  });

  it('tự tải lại sau 60 giây', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocked.overview.mockResolvedValue(data());
    renderPage();
    await screen.findByText('Đang trang trí');
    expect(mocked.overview).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(mocked.overview).toHaveBeenCalledTimes(2);
  });
});
