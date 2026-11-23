import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '../lib/storage';
import { Home } from './Home';

vi.mock('../ui/SupportHint', () => ({ SupportHint: () => <p>HỖ TRỢ</p> }));

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const renderHome = (url = '/') =>
  render(<MemoryRouter initialEntries={[url]}><Home /></MemoryRouter>);

describe('Home', () => {
  it('chân trang có câu nhắc email hỗ trợ', () => {
    renderHome();
    expect(screen.getByText('HỖ TRỢ')).toBeInTheDocument();
  });

  it('hiện đủ chữ giới thiệu và nút, không có nút đóng', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Cây Thông Lời Nhắn' })).toBeInTheDocument();
    for (const t of [
      'Trang trí căn phòng Noel của riêng bạn',
      'Gửi link — bạn bè treo lời nhắn lên cây',
      '0h 24/12 mới được mở quà đọc thư',
      'Chúc bạn một mùa Noel thật ấm áp ✨',
    ]) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bắt đầu tạo cây' })).toHaveAttribute('href', '/tao');
    expect(screen.queryByRole('button', { name: /đóng/i })).toBeNull();
  });

  it('bấm "Bạn đã có cây?" mở khung mở lại cây', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Bạn đã có cây?' }));
    expect(screen.getByRole('dialog', { name: 'Mở lại cây của bạn' })).toBeInTheDocument();
  });

  it('?ref hợp lệ được lưu', () => {
    renderHome('/?ref=abcdefgh');
    expect(storage.getRef()).toBe('abcdefgh');
  });

  it('?ref sai định dạng bị bỏ qua', () => {
    renderHome('/?ref=ABC');
    expect(storage.getRef()).toBeNull();
  });
});
