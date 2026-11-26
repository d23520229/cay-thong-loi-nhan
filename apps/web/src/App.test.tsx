import { act, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './App';
import { request } from './lib/api';
import { resetConfigForTest } from './lib/config';
import { resetServiceEndedForTest } from './lib/ended';

const ENDED_TITLE = 'Mùa Noel đã kết thúc, cảm ơn bạn!';

const cfg = (phase: string) => ({
  now: '2026-12-27T03:00:00.000Z', phase,
  unlockAt: '2026-12-23T17:00:00.000Z', writeClosesAt: '2026-12-25T17:00:00.000Z',
  serviceEndsAt: '2026-12-31T17:00:00.000Z', purgeAt: '2027-01-06T17:00:00.000Z',
  catalogVersion: 1, limits: {}, googleClientId: null, supportEmail: 'hotro@vidu.vn',
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** fetch giả: `/api/config` trả cấu hình (hoặc lỗi mạng); `/api/x410` trả 410 với mã cho trước; còn lại 404. */
function stubFetch(config: unknown | 'network', code410 = 'service_ended') {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/config')) {
      if (config === 'network') throw new TypeError('Failed to fetch');
      return json(200, config);
    }
    if (url.startsWith('/api/x410')) return json(410, { error: { code: code410, message: 'Hết' } });
    return json(404, { error: { code: 'not_found', message: 'Không thấy' } });
  }));
}

const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  resetConfigForTest();
  resetServiceEndedForTest();
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('AppShell — NOTICE / ENDED (đặc tả 6.9.1)', () => {
  it('NOTICE: biểu ngữ ngừng dịch vụ kèm ngày xoá dữ liệu', async () => {
    stubFetch(cfg('NOTICE'));
    renderAt('/');
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('ngừng hoạt động hết 31/12');
    expect(banner).toHaveTextContent('07/01/2027');
  });

  it.each(['BUILD', 'OPEN'])('%s: không có biểu ngữ', async (phase) => {
    stubFetch(cfg(phase));
    renderAt('/');
    await screen.findByRole('link', { name: 'Bắt đầu tạo cây' });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/ngừng hoạt động/)).not.toBeInTheDocument();
  });

  it.each(['/', '/c/abcd2345', '/tao'])('ENDED ở %s: trang kết thúc có link chính sách', async (path) => {
    stubFetch(cfg('ENDED'));
    renderAt(path);
    expect(await screen.findByRole('heading', { name: ENDED_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chính sách riêng tư' })).toHaveAttribute('href', '/chinh-sach');
    expect(screen.getByText(/07\/01\/2027/)).toBeInTheDocument();
  });

  it('/quan-tri nằm ngoài khung trang công khai (vẫn vào được sau ENDED)', () => {
    // Route lazy không chạy được trong jsdom (Request/AbortSignal của router), nên kiểm cấu trúc route.
    expect(routes.some((r) => r.path === '/quan-tri/*')).toBe(true);
    const shell = routes.find((r) => r.children)!;
    expect(shell.children!.some((r) => r.path?.startsWith('/quan-tri'))).toBe(false);
  });

  it('lỗi mạng khi tải cấu hình: không hiện trang kết thúc', async () => {
    stubFetch('network');
    renderAt('/');
    await screen.findByRole('link', { name: 'Bắt đầu tạo cây' });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: ENDED_TITLE })).not.toBeInTheDocument();
  });

  it('API trả 410 service_ended giữa chừng → chuyển trang kết thúc', async () => {
    stubFetch(cfg('NOTICE'));
    renderAt('/');
    await screen.findByRole('status');
    await act(async () => { await request('GET', '/api/x410').catch(() => {}); });
    expect(await screen.findByRole('heading', { name: ENDED_TITLE })).toBeInTheDocument();
  });

  it('410 mã khác: không chuyển trang kết thúc', async () => {
    stubFetch(cfg('NOTICE'), 'gone_other');
    renderAt('/');
    await screen.findByRole('status');
    await act(async () => { await request('GET', '/api/x410').catch(() => {}); });
    expect(screen.queryByRole('heading', { name: ENDED_TITLE })).not.toBeInTheDocument();
  });
});
