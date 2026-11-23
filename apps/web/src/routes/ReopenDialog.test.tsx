import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../lib/api';
import { storage } from '../lib/storage';
import { ReopenDialog } from './ReopenDialog';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return {
    ...actual,
    api: { getOwnerTree: vi.fn(), authPin: vi.fn(), authLink: vi.fn(), authGoogle: vi.fn() },
  };
});

vi.mock('../ui/GoogleButton', () => ({
  GoogleButton: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken(GTOKEN)}>Google giả</button>
  ),
}));

// idToken giả có tên "Lan" trong payload.
const GTOKEN = `h.${btoa(JSON.stringify({ name: 'Lan' })).replace(/=+$/, '')}.s`;
vi.mock('../ui/SupportHint', () => ({ SupportHint: () => <p>HỖ TRỢ</p> }));
const mocked = vi.mocked(api);

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

const renderDialog = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ReopenDialog onClose={() => {}} />} />
        <Route path="/c/:id" element={<div>Phòng đã mở</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fill = async (code: string, pin?: string) => {
  const code$ = screen.getByLabelText('Mã cây hoặc link cây');
  await userEvent.clear(code$);
  if (code) await userEvent.type(code$, code);
  if (pin) await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), pin);
  await userEvent.click(screen.getByRole('button', { name: 'Mở cây' }));
};

describe('ReopenDialog', () => {
  it('mã sai định dạng', async () => {
    renderDialog();
    await fill('abc', '123456');
    expect(await screen.findByText('Mã cây chưa đúng')).toBeInTheDocument();
    expect(mocked.authPin).not.toHaveBeenCalled();
  });

  it('PIN sai', async () => {
    mocked.authPin.mockRejectedValue(new ApiError(401, 'bad_pin', 'x'));
    renderDialog();
    await fill('k7m2xq4a', '111111');
    expect(await screen.findByText('Mã PIN chưa đúng')).toBeInTheDocument();
  });

  it('PIN bị khoá', async () => {
    mocked.authPin.mockRejectedValue(new ApiError(429, 'pin_locked', 'x', { retryAt: 'z' }));
    renderDialog();
    await fill('k7m2xq4a', '111111');
    expect(await screen.findByText('Nhập sai quá nhiều lần, thử lại sau 15 phút')).toBeInTheDocument();
    expect(screen.queryByText('HỖ TRỢ')).not.toBeInTheDocument();
  });

  it('PIN bị khoá đến hết ngày (> 60 phút) → hiện email hỗ trợ', async () => {
    const retryAt = new Date(Date.now() + 5 * 3_600_000).toISOString();
    mocked.authPin.mockRejectedValue(new ApiError(429, 'pin_locked', 'x', { retryAt }));
    renderDialog();
    await fill('k7m2xq4a', '111111');
    expect(await screen.findByText('HỖ TRỢ')).toBeInTheDocument();
  });

  it('404', async () => {
    mocked.authPin.mockRejectedValue(new ApiError(404, 'not_found', 'x'));
    renderDialog();
    await fill('k7m2xq4a', '111111');
    expect(await screen.findByText('Không tìm thấy cây này')).toBeInTheDocument();
  });

  it('PIN đúng: lưu cây và chuyển trang', async () => {
    mocked.authPin.mockResolvedValue(undefined);
    renderDialog();
    await fill('k7m2xq4a', '111111');
    expect(await screen.findByText('Phòng đã mở')).toBeInTheDocument();
    expect(mocked.authPin).toHaveBeenCalledWith('k7m2xq4a', '111111');
    expect(storage.myTrees()[0]!.id).toBe('k7m2xq4a');
  });

  it('link riêng gọi authLink, không gọi authPin', async () => {
    mocked.authLink.mockResolvedValue(undefined);
    renderDialog();
    await fill('https://x.test/c/k7m2xq4a#k=AbC_d-1');
    expect(await screen.findByText('Phòng đã mở')).toBeInTheDocument();
    expect(mocked.authLink).toHaveBeenCalledWith('k7m2xq4a', 'AbC_d-1');
    expect(mocked.authPin).not.toHaveBeenCalled();
  });

  it('cây có trong myTrees và phiên còn hiệu lực: mở thẳng, không hỏi PIN', async () => {
    storage.addMyTree({ id: 'k7m2xq4a', title: null, createdAt: 'x' });
    mocked.getOwnerTree.mockResolvedValue({} as never);
    renderDialog();
    expect(await screen.findByText('Phòng đã mở')).toBeInTheDocument();
    expect(mocked.authPin).not.toHaveBeenCalled();
  });

  it('nhiều cây trong myTrees: không tự gọi getOwnerTree, điền sẵn cây mới nhất; bấm chip mới thử phiên rồi chuyển', async () => {
    storage.addMyTree({ id: 'aaaaaaaa', title: null, createdAt: 'x' });
    storage.addMyTree({ id: 'k7m2xq4a', title: null, createdAt: 'y' });
    mocked.getOwnerTree.mockResolvedValue({} as never);
    renderDialog();
    await new Promise((r) => setTimeout(r, 0));
    expect(mocked.getOwnerTree).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Mã cây hoặc link cây')).toHaveValue('k7m2xq4a');
    await userEvent.click(screen.getByRole('button', { name: 'aaaaaaaa' }));
    expect(mocked.getOwnerTree).toHaveBeenCalledWith('aaaaaaaa');
    expect(await screen.findByText('Phòng đã mở')).toBeInTheDocument();
  });

  it('điền sẵn mã cây; 404 khi thử mở thì xoá khỏi myTrees', async () => {
    storage.addMyTree({ id: 'k7m2xq4a', title: null, createdAt: 'x' });
    mocked.getOwnerTree.mockRejectedValue(new ApiError(404, 'not_found', 'x'));
    renderDialog();
    expect(screen.getByLabelText('Mã cây hoặc link cây')).toHaveValue('k7m2xq4a');
    await waitFor(() => expect(storage.myTrees()).toEqual([]));
  });

  it('PIN chỉ nhận số', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '1a2b3');
    expect(screen.getByLabelText('Mã PIN 6 số')).toHaveValue('123');
  });

  describe('Google', () => {
    it('tài khoản chưa có cây', async () => {
      mocked.authGoogle.mockResolvedValue({ trees: [] });
      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Google giả' }));
      expect(await screen.findByText('Tài khoản Google này chưa có cây nào')).toBeInTheDocument();
      expect(screen.getByText('HỖ TRỢ')).toBeInTheDocument();
    });

    it('một cây → đăng nhập cây đó, nhớ cây, mở phòng', async () => {
      mocked.authGoogle.mockResolvedValueOnce({ trees: [{ id: 'abc12345', title: 'Cây Lan' }] }).mockResolvedValueOnce(undefined);
      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Google giả' }));
      expect(await screen.findByText('Phòng đã mở')).toBeInTheDocument();
      expect(mocked.authGoogle).toHaveBeenLastCalledWith(GTOKEN, 'abc12345');
      expect(storage.myTrees().map((t) => t.id)).toContain('abc12345');
    });

    it('nhiều cây → chọn một cây rồi đăng nhập cây đó', async () => {
      mocked.authGoogle
        .mockResolvedValueOnce({ trees: [{ id: 'abc12345', title: 'Cây A' }, { id: 'xyz98765', title: null }] })
        .mockResolvedValueOnce(undefined);
      renderDialog();
      await userEvent.click(screen.getByRole('button', { name: 'Google giả' }));
      await userEvent.click(await screen.findByRole('button', { name: 'xyz98765' }));
      expect(await screen.findByText('Phòng đã mở')).toBeInTheDocument();
      expect(mocked.authGoogle).toHaveBeenLastCalledWith(GTOKEN, 'xyz98765');
    });
  });
});
