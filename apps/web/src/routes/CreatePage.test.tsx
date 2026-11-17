import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { storage } from '../lib/storage';
import { CreatePage } from './CreatePage';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return { ...actual, api: { createTree: vi.fn() } };
});

const mocked = vi.mocked(api);
const created = { id: 'k7m2xq4a', publicUrl: 'http://h/c/k7m2xq4a', privateUrl: 'http://h/c/k7m2xq4a#k=z', roomVersion: 1 };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/tao']}>
      <Routes>
        <Route path="/tao" element={<CreatePage />} />
        <Route path="/c/:id" element={<div>Phòng đã mở</div>} />
      </Routes>
    </MemoryRouter>,
  );

const openSheet = () => userEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
const createBtn = () => screen.getByRole('button', { name: 'Tạo cây' });
const fillForm = async () => {
  await openSheet();
  await userEvent.type(screen.getByLabelText('Tên của bạn'), 'Lan');
  await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '123456');
};

describe('CreatePage', () => {
  it('thiếu tên hoặc PIN chưa đủ 6 số thì khoá "Tạo cây"', async () => {
    renderPage();
    await openSheet();
    expect(createBtn()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Tên của bạn'), 'Lan');
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '12345');
    expect(createBtn()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '6');
    expect(createBtn()).toBeEnabled();
    expect(screen.getByRole('button', { name: /Google/ })).toBeDisabled();
  });

  it('bấm hai lần nhanh chỉ gọi createTree một lần; thành công hiện màn Tạo xong', async () => {
    let resolve!: (v: typeof created) => void;
    mocked.createTree.mockReturnValue(new Promise((r) => { resolve = r; }));
    storage.setRef('abcdefgh');
    renderPage();
    await openSheet();
    await userEvent.type(screen.getByLabelText('Tên của bạn'), 'Lan');
    await userEvent.type(screen.getByLabelText('Tên cây (không bắt buộc)'), 'Cây nhà Lan');
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '123456');
    await userEvent.dblClick(createBtn());
    expect(mocked.createTree).toHaveBeenCalledTimes(1);
    expect(mocked.createTree.mock.calls[0]![0]).toMatchObject({
      ownerName: 'Lan', title: 'Cây nhà Lan', recovery: { type: 'pin', pin: '123456' }, ref: 'abcdefgh',
    });
    resolve(created);
    expect(await screen.findByText('Cây của bạn đã sẵn sàng! 🎉')).toBeInTheDocument();
    expect(screen.getByText('k7m2xq4a')).toBeInTheDocument();
    expect(screen.getByDisplayValue(created.privateUrl)).toBeInTheDocument();
    expect(storage.myTrees()[0]!.id).toBe('k7m2xq4a');
    expect(storage.getDraft('new')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Về phòng của tôi' }));
    expect(await screen.findByText('Phòng đã mở')).toBeInTheDocument();
  });

  it('không gửi ref khi không có', async () => {
    mocked.createTree.mockResolvedValue(created);
    renderPage();
    await fillForm();
    await userEvent.click(createBtn());
    await waitFor(() => expect(mocked.createTree).toHaveBeenCalled());
    expect(mocked.createTree.mock.calls[0]![0].ref).toBeUndefined();
  });

  it('nháp hỏng bị bỏ và xoá', () => {
    localStorage.setItem('draft:new', JSON.stringify({ room: { nope: 1 }, baseVersion: null, savedAt: 'x' }));
    renderPage();
    expect(storage.getDraft('new')).toBeNull();
  });

  it('sao chép lỗi thì báo sao chép thủ công', async () => {
    mocked.createTree.mockResolvedValue(created);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('no')) },
    });
    renderPage();
    await fillForm();
    await userEvent.click(createBtn());
    await userEvent.click((await screen.findAllByRole('button', { name: 'Sao chép' }))[0]!);
    expect(await screen.findByText('Hãy sao chép thủ công')).toBeInTheDocument();
  });
});
