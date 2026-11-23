import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { adminApi, type AdminReport } from './adminApi';
import { AdminContext } from './context';
import { Reports } from './Reports';

vi.mock('./adminApi', async (orig) => {
  const actual = await orig<typeof import('./adminApi')>();
  return { ...actual, adminApi: { reports: vi.fn(), resolve: vi.fn(), reportPhotoUrl: actual.adminApi.reportPhotoUrl } };
});
const mocked = vi.mocked(adminApi);

const rep = (over: Partial<AdminReport>): AdminReport => ({
  id: '1', createdAt: '2026-12-01T03:00:00.000Z', reporter: 'owner', reason: 'thô tục', treeId: 'abcdefgh',
  messageId: '9', snapshot: 'lời nhắn xấu', hasPhoto: true, messageExists: true, status: 'open',
  resolution: null, handledAt: null, note: null, ...over,
});
const OWNER = rep({});
const GUEST = rep({ id: '2', reporter: 'guest', messageId: null, snapshot: null, hasPhoto: false, reason: 'phòng xấu' });
const GONE = rep({ id: '3', messageExists: false, snapshot: 'đã xoá rồi', hasPhoto: false });

const refreshCount = vi.fn();
const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminContext.Provider value={{ email: 'a@b.vn', onError: (e) => (e instanceof Error ? e.message : 'lỗi'), refreshCount }}>
        <Reports />
      </AdminContext.Provider>
    </MemoryRouter>,
  );
const open = async (text: string) => userEvent.click(await screen.findByRole('button', { name: new RegExp(text) }));
const detail = () => screen.getByRole('region', { name: 'Chi tiết báo cáo' });

beforeEach(() => vi.resetAllMocks());

describe('Báo cáo', () => {
  it('hai tab gọi đúng trạng thái', async () => {
    mocked.reports.mockResolvedValue({ items: [] });
    renderPage();
    await waitFor(() => expect(mocked.reports).toHaveBeenCalledWith('open'));
    await userEvent.click(screen.getByRole('button', { name: 'Đã xử lý' }));
    await waitFor(() => expect(mocked.reports).toHaveBeenLastCalledWith('handled'));
  });

  it('chi tiết: bản chụp, ảnh, link tra cứu phòng; ghi chú trống khoá nút', async () => {
    mocked.reports.mockResolvedValue({ items: [OWNER, GUEST] });
    renderPage();
    await open('lời nhắn xấu');
    const d = detail();
    expect(within(d).getByText('lời nhắn xấu')).toBeInTheDocument();
    expect(within(d).getByRole('img')).toHaveAttribute('src', '/api/admin/reports/1/photo');
    expect(within(d).getByRole('link', { name: /abcdefgh/ })).toHaveAttribute('href', '/quan-tri/phong?id=abcdefgh');
    for (const name of ['Xoá lời nhắn', 'Xoá phòng', 'Bỏ qua']) expect(within(d).getByRole('button', { name })).toBeDisabled();
    await userEvent.type(within(d).getByLabelText('Ghi chú'), 'vi phạm');
    expect(within(d).getByRole('button', { name: 'Bỏ qua' })).toBeEnabled();
  });

  it('báo cáo cả phòng không có nút xoá lời nhắn, không có ảnh', async () => {
    mocked.reports.mockResolvedValue({ items: [GUEST] });
    renderPage();
    await open('phòng xấu');
    expect(within(detail()).queryByRole('button', { name: 'Xoá lời nhắn' })).not.toBeInTheDocument();
    expect(within(detail()).queryByRole('img')).not.toBeInTheDocument();
  });

  it('lời nhắn đã bị xoá → nút xoá lời nhắn khoá, có chữ giải thích', async () => {
    mocked.reports.mockResolvedValue({ items: [GONE] });
    renderPage();
    await open('đã xoá rồi');
    await userEvent.type(within(detail()).getByLabelText('Ghi chú'), 'x');
    expect(within(detail()).getByRole('button', { name: 'Xoá lời nhắn' })).toBeDisabled();
    expect(within(detail()).getByText('Lời nhắn đã bị xoá')).toBeInTheDocument();
  });

  it('xoá lời nhắn: hỏi lại, xác nhận → resolve, báo cáo rời danh sách, cập nhật số chờ', async () => {
    mocked.reports.mockResolvedValue({ items: [OWNER, GUEST] });
    mocked.resolve.mockResolvedValue({ ok: true });
    renderPage();
    await open('lời nhắn xấu');
    await userEvent.type(within(detail()).getByLabelText('Ghi chú'), 'vi phạm');
    await userEvent.click(within(detail()).getByRole('button', { name: 'Xoá lời nhắn' }));
    expect(mocked.resolve).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xoá' }));
    expect(mocked.resolve).toHaveBeenCalledWith('1', 'delete_message', 'vi phạm');
    await waitFor(() => expect(screen.queryByRole('button', { name: /lời nhắn xấu/ })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /phòng xấu/ })).toBeInTheDocument();
    expect(refreshCount).toHaveBeenCalled();
  });

  it('bỏ qua không cần hỏi lại; đã được xử lý ở tab khác (409) → báo và tải lại', async () => {
    mocked.reports.mockResolvedValue({ items: [GUEST] });
    mocked.resolve.mockRejectedValue(new ApiError(409, 'already_handled', 'Báo cáo này đã được xử lý.'));
    renderPage();
    await open('phòng xấu');
    await userEvent.type(within(detail()).getByLabelText('Ghi chú'), 'ổn');
    await userEvent.click(within(detail()).getByRole('button', { name: 'Bỏ qua' }));
    expect(mocked.resolve).toHaveBeenCalledWith('2', 'dismiss', 'ổn');
    expect(await screen.findByText('Báo cáo này đã được xử lý.')).toBeInTheDocument();
    expect(mocked.reports).toHaveBeenCalledTimes(2);
  });

  it('tab đã xử lý hiện kết quả và ghi chú, không có nút hành động', async () => {
    mocked.reports.mockImplementation(async (s) => ({
      items: s === 'handled' ? [rep({ status: 'resolved', resolution: 'message_deleted', note: 'delete_message: vi phạm', handledAt: '2026-12-01T04:00:00.000Z' })] : [],
    }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Đã xử lý' }));
    await open('lời nhắn xấu');
    expect(within(detail()).getByText(/Đã xoá lời nhắn/)).toBeInTheDocument();
    expect(within(detail()).getByText('delete_message: vi phạm')).toBeInTheDocument();
    expect(within(detail()).queryByRole('button', { name: 'Bỏ qua' })).not.toBeInTheDocument();
  });

  it('xoá phòng xong tải lại danh sách: báo cáo khác của cùng phòng cũng biến mất', async () => {
    mocked.reports.mockResolvedValueOnce({ items: [OWNER, GUEST] }).mockResolvedValueOnce({ items: [] });
    mocked.resolve.mockResolvedValue({ ok: true });
    renderPage();
    await open('lời nhắn xấu');
    await userEvent.type(within(detail()).getByLabelText('Ghi chú'), 'vi phạm');
    await userEvent.click(within(detail()).getByRole('button', { name: 'Xoá phòng' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xoá' }));
    await waitFor(() => expect(mocked.reports).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: /phòng xấu/ })).not.toBeInTheDocument());
  });

  it('lời nhắn vừa bị xoá ở nơi khác (409 message_gone) → tải lại, nút xoá lời nhắn bị khoá', async () => {
    mocked.reports.mockResolvedValueOnce({ items: [OWNER] }).mockResolvedValueOnce({ items: [{ ...OWNER, messageExists: false }] });
    mocked.resolve.mockRejectedValue(new ApiError(409, 'message_gone', 'Lời nhắn đã bị xoá trước đó.'));
    renderPage();
    await open('lời nhắn xấu');
    await userEvent.type(within(detail()).getByLabelText('Ghi chú'), 'x');
    await userEvent.click(within(detail()).getByRole('button', { name: 'Xoá lời nhắn' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xoá' }));
    expect(await within(detail()).findByText('Lời nhắn đã bị xoá')).toBeInTheDocument();
    expect(within(detail()).getByRole('button', { name: 'Xoá lời nhắn' })).toBeDisabled();
  });

  it('đổi tab nhanh: phản hồi cũ của tab trước không ghi đè danh sách tab đang xem', async () => {
    let releaseOpen!: (v: { items: AdminReport[] }) => void;
    mocked.reports.mockImplementation((s) =>
      s === 'open'
        ? new Promise((r) => { releaseOpen = r; })
        : Promise.resolve({ items: [rep({ id: '7', status: 'dismissed', snapshot: 'đã xử lý xong' })] }),
    );
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Đã xử lý' }));
    expect(await screen.findByRole('button', { name: /đã xử lý xong/ })).toBeInTheDocument();
    releaseOpen({ items: [OWNER] });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: /lời nhắn xấu/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đã xử lý xong/ })).toBeInTheDocument();
  });
});
