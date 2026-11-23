import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { adminApi, type AdminTree } from './adminApi';
import { AdminContext } from './context';
import { TreeLookup } from './TreeLookup';

vi.mock('./adminApi', async (orig) => {
  const actual = await orig<typeof import('./adminApi')>();
  return { ...actual, adminApi: { tree: vi.fn(), unlockPin: vi.fn(), revokeSessions: vi.fn(), deleteTree: vi.fn(), roomImageUrl: actual.adminApi.roomImageUrl } };
});
const mocked = vi.mocked(adminApi);

const TREE: AdminTree = {
  id: 'abcdefgh', ownerName: 'Lan', title: 'Cây Lan', createdAt: '2026-11-30T03:00:00.000Z', lastOwnerVisitAt: null,
  itemCount: 9, messages: { opened: 1, unopened: 4 }, recovery: { pin: true, google: false }, activeSessions: 2,
  reports: { open: 1, total: 3 }, pin: { failsToday: 50, lockedUntil: '2026-12-02T00:00:00.000Z' },
};

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search + l.hash}</div>;
}
const renderPage = (path = '/quan-tri/phong') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminContext.Provider value={{ email: 'a@b.vn', onError: (e) => (e instanceof Error ? e.message : 'lỗi'), refreshCount: () => {} }}>
        <Routes>
          <Route path="/quan-tri/phong" element={<><TreeLookup /><Where /></>} />
        </Routes>
      </AdminContext.Provider>
    </MemoryRouter>,
  );
const search = async (text: string) => {
  await userEvent.type(screen.getByLabelText('Mã cây hoặc link'), text);
  await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));
};
const confirm = () => userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Đồng ý' }));

beforeEach(() => vi.resetAllMocks());

describe('Tra cứu phòng', () => {
  it('dán link riêng: chỉ gửi mã cây, phần #k= không lên server và không vào địa chỉ trang', async () => {
    mocked.tree.mockResolvedValue(TREE);
    renderPage();
    await search('https://x.vn/c/abcdefgh#k=SECRETKEY');
    await waitFor(() => expect(mocked.tree).toHaveBeenCalledWith('abcdefgh'));
    expect(JSON.stringify(mocked.tree.mock.calls)).not.toContain('SECRET');
    expect(screen.getByTestId('where').textContent).toBe('/quan-tri/phong?id=abcdefgh');
  });

  it('mở với ?id= thì tự tra; hiện số liệu, ảnh phòng, PIN đang bị khoá', async () => {
    mocked.tree.mockResolvedValue(TREE);
    renderPage('/quan-tri/phong?id=abcdefgh');
    expect(await screen.findByText('Lan')).toBeInTheDocument();
    expect(mocked.tree).toHaveBeenCalledWith('abcdefgh');
    expect(screen.getByRole('img', { name: /Ảnh phòng/ })).toHaveAttribute('src', '/api/admin/trees/abcdefgh/room.png');
    expect(screen.getByText('1 đã mở · 4 chưa mở')).toBeInTheDocument();
    expect(screen.getByText('PIN, link riêng')).toBeInTheDocument();
    expect(screen.getByText(/PIN đang bị khoá đến/)).toBeInTheDocument();
  });

  it('mã sai → báo, không gọi API; không có cây (404) → báo không tìm thấy', async () => {
    mocked.tree.mockRejectedValue(new ApiError(404, 'not_found', 'Không tìm thấy cây này.'));
    renderPage();
    await search('ab');
    expect(screen.getByText('Mã cây chưa đúng')).toBeInTheDocument();
    expect(mocked.tree).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Mã cây hoặc link'));
    await search('zzzzzzzz');
    expect(await screen.findByText('Không tìm thấy cây này')).toBeInTheDocument();
  });

  it('mở khoá PIN và thu hồi phiên đều hỏi lại, gửi kèm ghi chú, tải lại số liệu', async () => {
    mocked.tree.mockResolvedValue(TREE);
    mocked.unlockPin.mockResolvedValue(undefined);
    mocked.revokeSessions.mockResolvedValue({ revoked: 2 });
    renderPage('/quan-tri/phong?id=abcdefgh');
    await screen.findByText('Lan');
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'chủ cây nhờ');
    await userEvent.click(screen.getByRole('button', { name: 'Mở khoá PIN' }));
    expect(mocked.unlockPin).not.toHaveBeenCalled();
    await confirm();
    expect(mocked.unlockPin).toHaveBeenCalledWith('abcdefgh', 'chủ cây nhờ');
    expect(await screen.findByText('Đã mở khoá PIN')).toBeInTheDocument();
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('');
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'chủ cây nhờ');
    await userEvent.click(screen.getByRole('button', { name: 'Thu hồi mọi phiên' }));
    await confirm();
    expect(mocked.revokeSessions).toHaveBeenCalledWith('abcdefgh', 'chủ cây nhờ');
    expect(await screen.findByText('Đã thu hồi 2 phiên')).toBeInTheDocument();
    expect(mocked.tree).toHaveBeenCalledTimes(3);
  });

  it('xoá phòng bắt ghi chú, hỏi lại, xoá xong không còn số liệu', async () => {
    mocked.tree.mockResolvedValue(TREE);
    mocked.deleteTree.mockResolvedValue(undefined);
    renderPage('/quan-tri/phong?id=abcdefgh');
    await screen.findByText('Lan');
    expect(screen.getByRole('button', { name: 'Xoá phòng' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'đã xác minh qua email');
    await userEvent.click(screen.getByRole('button', { name: 'Xoá phòng' }));
    await confirm();
    expect(mocked.deleteTree).toHaveBeenCalledWith('abcdefgh', 'đã xác minh qua email');
    expect(await screen.findByText('Đã xoá phòng abcdefgh')).toBeInTheDocument();
    expect(screen.queryByText('Lan')).not.toBeInTheDocument();
  });
});
