import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi, type AuditItem } from './adminApi';
import { AdminContext } from './context';
import { AuditLog } from './AuditLog';

vi.mock('./adminApi', async (orig) => {
  const actual = await orig<typeof import('./adminApi')>();
  return { ...actual, adminApi: { audit: vi.fn() } };
});
const mocked = vi.mocked(adminApi);

const row = (id: string, action: string, over: Partial<AuditItem> = {}): AuditItem => ({
  id, at: '2026-12-01T03:00:00.000Z', email: 'a@b.vn', action, targetType: 'tree', targetId: 'abcdefgh', note: null, ...over,
});
const renderPage = () =>
  render(
    <AdminContext.Provider value={{ email: 'a@b.vn', onError: () => 'lỗi', refreshCount: () => {} }}>
      <AuditLog />
    </AdminContext.Provider>,
  );

beforeEach(() => vi.resetAllMocks());

describe('Nhật ký', () => {
  it('hiện danh sách; "Xem thêm" nối trang sau; hết trang thì ẩn nút', async () => {
    mocked.audit
      .mockResolvedValueOnce({ items: [row('9', 'tree_delete', { note: 'vi phạm' }), row('8', 'pin_unlock')], nextBefore: '8' })
      .mockResolvedValueOnce({ items: [row('7', 'login', { targetType: 'admin', targetId: '1' })], nextBefore: null });
    renderPage();
    expect(await screen.findByText('Xoá phòng')).toBeInTheDocument();
    expect(screen.getByText('vi phạm')).toBeInTheDocument();
    expect(screen.getByText('Mở khoá PIN')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    await waitFor(() => expect(mocked.audit).toHaveBeenLastCalledWith('8'));
    expect(await screen.findByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('Mở khoá PIN')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).not.toBeInTheDocument();
  });
});
