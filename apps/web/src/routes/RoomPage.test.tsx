import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, type OwnerRoom, type PublicRoom } from '../lib/api';
import { storage } from '../lib/storage';
import { defaultRoom } from '../room/model';
import { RoomPage } from './RoomPage';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return {
    ...actual,
    api: { getOwnerTree: vi.fn(), getTree: vi.fn(), authLink: vi.fn(), authPin: vi.fn(), saveRoom: vi.fn() },
  };
});

const mocked = vi.mocked(api);
const ID = 'abcdefgh';

const publicRoom = (over: Partial<PublicRoom> = {}): PublicRoom => ({
  id: ID, ownerName: 'Lan', title: 'Cây của Lan', ...defaultRoom(), slots: [], roomVersion: 2, phase: 'BUILD', ...over,
});
const ownerRoom = (over: Partial<OwnerRoom> = {}): OwnerRoom => ({
  ...publicRoom(), slots: [], messageCount: 0, newSinceLastVisit: 0, showMessageCount: true, ...over,
});
const unauthorized = () => new ApiError(401, 'owner_required', 'x');

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(async () => {
  // Gỡ trang rồi chờ một nhịp để bộ tự lưu (dừng hoãn một nhịp) gửi nốt bằng mock của test này, không lấn sang test sau.
  cleanup();
  await new Promise((r) => setTimeout(r, 0));
  vi.unstubAllGlobals();
});

const renderAt = (path = `/c/${ID}`, strict = false) => {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>Trang chủ</div>} />
        <Route path="/c/:id" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe('RoomPage', () => {
  it('chủ cây: chế độ Xem có "Sửa phòng", không có "Tạo cây của bạn"; bấm → "Xong" và "Đã lưu"; ghi myTrees', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: /Sửa phòng/ }));
    expect(screen.queryByText('Tạo cây của bạn')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xong' })).toBeInTheDocument();
    expect(screen.getByText('Đã lưu')).toBeInTheDocument();
    expect(storage.myTrees()[0]).toMatchObject({ id: ID, title: 'Cây của Lan' });

    await userEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
    expect(mocked.saveRoom).not.toHaveBeenCalled();
  });

  it.each(['NOTICE', 'ENDED'])('phase %s → không có "Sửa phòng"', async (phase) => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom({ phase }));
    renderAt();
    expect(await screen.findByText('Cây của Lan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa phòng/ })).not.toBeInTheDocument();
  });

  it('không có tên cây → "Phòng của {ownerName}"', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom({ title: null }));
    renderAt();
    expect(await screen.findByText('Phòng của Lan')).toBeInTheDocument();
  });

  it('khách: "Tạo cây của bạn" → /?ref={id}, "Tôi là chủ cây" → PIN đúng → thành chủ cây', async () => {
    mocked.getOwnerTree.mockRejectedValueOnce(unauthorized());
    mocked.getTree.mockResolvedValue(publicRoom());
    renderAt();
    const create = await screen.findByRole('link', { name: 'Tạo cây của bạn' });
    expect(create).toHaveAttribute('href', `/?ref=${ID}`);
    expect(screen.queryByRole('button', { name: /Sửa phòng/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tôi là chủ cây' }));
    expect(screen.getByRole('dialog', { name: 'Chào chủ cây 👋' })).toBeInTheDocument();
    expect(screen.getByText('Nhập mã PIN bạn đã đặt khi tạo cây.')).toBeInTheDocument();
    expect(screen.getByText('Có link riêng? Mở link đó là vào được ngay.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Google/ })).toBeDisabled();

    mocked.authPin.mockResolvedValue(undefined);
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Vào cây' }));
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
    expect(mocked.authPin).toHaveBeenCalledWith(ID, '123456');
    expect(screen.queryByRole('dialog', { name: 'Chào chủ cây 👋' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tạo cây của bạn')).not.toBeInTheDocument();
  });

  it('"Chào chủ cây": PIN sai và bị khoá hiện đúng thông báo', async () => {
    mocked.getOwnerTree.mockRejectedValue(unauthorized());
    mocked.getTree.mockResolvedValue(publicRoom());
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: 'Tôi là chủ cây' }));
    mocked.authPin.mockRejectedValueOnce(new ApiError(401, 'bad_pin', 'x'));
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '111111');
    await userEvent.click(screen.getByRole('button', { name: 'Vào cây' }));
    expect(await screen.findByText('Mã PIN chưa đúng')).toBeInTheDocument();
    mocked.authPin.mockRejectedValueOnce(new ApiError(429, 'pin_locked', 'x', { retryAt: 'z' }));
    await userEvent.click(screen.getByRole('button', { name: 'Vào cây' }));
    expect(await screen.findByText('Nhập sai quá nhiều lần, thử lại sau 15 phút')).toBeInTheDocument();
  });

  it('404 → "Không tìm thấy cây này." + nút tạo cây, xoá khỏi myTrees', async () => {
    storage.addMyTree({ id: ID, title: null, createdAt: 'x' });
    storage.addMyTree({ id: 'zzzzzzzz', title: null, createdAt: 'x' });
    mocked.getOwnerTree.mockRejectedValue(new ApiError(404, 'not_found', 'x'));
    renderAt();
    expect(await screen.findByText('Không tìm thấy cây này.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tạo cây của bạn' })).toHaveAttribute('href', '/');
    expect(storage.myTrees().map((t) => t.id)).toEqual(['zzzzzzzz']);
  });

  it('#k= → authLink(id, key) một lần (kể cả StrictMode), xoá #k= khỏi địa chỉ, ghi myTrees', async () => {
    window.history.replaceState(null, '', `/c/${ID}#k=KEY`);
    mocked.authLink.mockResolvedValue(undefined);
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    renderAt(`/c/${ID}#k=KEY`, true);
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
    expect(mocked.authLink).toHaveBeenCalledWith(ID, 'KEY');
    expect(mocked.authLink).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe(`/c/${ID}`);
    expect(storage.myTrees()[0]!.id).toBe(ID);
  });

  it('#k= sai vẫn xoá khỏi địa chỉ và vào như khách', async () => {
    window.history.replaceState(null, '', `/c/${ID}#k=BAD`);
    mocked.authLink.mockRejectedValue(new ApiError(401, 'bad_key', 'x'));
    mocked.getOwnerTree.mockRejectedValue(unauthorized());
    mocked.getTree.mockResolvedValue(publicRoom());
    renderAt(`/c/${ID}#k=BAD`);
    expect(await screen.findByRole('link', { name: 'Tạo cây của bạn' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(storage.myTrees()).toEqual([]);
  });

  it('nháp baseVersion 1, server roomVersion 2 → bảng xung đột; "Dùng bản mới nhất" xoá nháp', async () => {
    const mine = defaultRoom();
    mine.background = 'night';
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 1, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    renderAt();
    expect(await screen.findByText('Có thay đổi chưa lưu trên máy này, nhưng phòng đã được sửa ở thiết bị khác')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dùng bản mới nhất' }));
    expect(screen.queryByText('Dùng bản mới nhất')).not.toBeInTheDocument();
    expect(storage.getDraft(ID)).toBeNull();
    expect(mocked.saveRoom).not.toHaveBeenCalled();
  });

  it('nháp cùng bản server → gửi nháp đúng một lần (kể cả StrictMode)', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 2, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockResolvedValue({ roomVersion: 3 });
    renderAt(`/c/${ID}`, true);
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
    expect(mocked.saveRoom).toHaveBeenCalledWith(ID, 2, mine);
    expect(screen.queryByText('Dùng bản mới nhất')).not.toBeInTheDocument();
    expect(storage.getDraft(ID)).toBeNull();
  });

  it('lưu bị 401 → "Chào chủ cây" → đăng nhập → tải lại và gửi lại thay đổi', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 2, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValueOnce(unauthorized()).mockResolvedValue({ roomVersion: 3 });
    renderAt();
    expect(await screen.findByRole('dialog', { name: 'Chào chủ cây 👋' })).toBeInTheDocument();
    mocked.authPin.mockResolvedValue(undefined);
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Vào cây' }));
    await waitFor(() => expect(mocked.saveRoom).toHaveBeenCalledTimes(2));
    expect(mocked.getOwnerTree).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xong' })).toBeInTheDocument();
  });

  it('lưu bị 403 write_closed → về Xem, ẩn "Sửa phòng"', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 2, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(403, 'write_closed', 'x'));
    renderAt();
    expect(await screen.findByText('Cây của Lan')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Xong' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Sửa phòng/ })).not.toBeInTheDocument();
  });

  it('lưu bị lỗi mạng → thông báo "Mất mạng — thay đổi được giữ trên máy"', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 2, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(0, 'network', 'x'));
    renderAt();
    expect(await screen.findByText('Mất mạng — thay đổi được giữ trên máy')).toBeInTheDocument();
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument();
  });

  it('lưu bị 429 → báo lưu hơi nhiều, không báo mất mạng', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 2, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(429, 'rate_limited', 'x'));
    renderAt();
    expect(
      await screen.findByText('Bạn lưu hơi nhiều, sẽ tự lưu lại sau ít phút — thay đổi vẫn giữ trên máy.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Mất mạng — thay đổi được giữ trên máy')).not.toBeInTheDocument();
    expect(storage.getDraft(ID)).not.toBeNull();
  });

  it('lưu bị 404 (cây đã bị xoá ở nơi khác) → "Cây này không còn nữa.", ngừng lưu, giữ nháp', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 2, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(404, 'not_found', 'x'));
    renderAt();
    expect(await screen.findByText('Cây này không còn nữa.')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    expect(await screen.findByText('Chưa lưu được — thay đổi vẫn giữ trên máy.')).toBeInTheDocument();
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
    expect(storage.getDraft(ID)!.room.tree.slotCount).toBe(9);
  });

  it('tên cây có HTML hiển thị nguyên chuỗi dạng text', async () => {
    const evil = '<img src=x onerror=alert(1)>';
    mocked.getOwnerTree.mockRejectedValue(unauthorized());
    mocked.getTree.mockResolvedValue(publicRoom({ title: evil }));
    const { container } = renderAt();
    expect(await screen.findByText(evil)).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('phòng từ server không hợp lệ → "Không mở được cây này."', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom({ items: [] }));
    renderAt();
    expect(await screen.findByText('Không mở được cây này.')).toBeInTheDocument();
  });
  it('"Xong" gửi ngay thay đổi đang chờ rồi về Xem; vào Sửa lần nữa dùng roomVersion mới', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockResolvedValueOnce({ roomVersion: 3 }).mockResolvedValueOnce({ roomVersion: 4 });
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: /Sửa phòng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nhà gỗ' }));
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument();
    const [topDone] = screen.getAllByRole('button', { name: 'Xong' });
    await userEvent.click(topDone!);
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
    expect(mocked.saveRoom.mock.calls[0]![1]).toBe(2);
    expect(mocked.saveRoom.mock.calls[0]![2].background).not.toBe('night');
    expect(storage.getDraft(ID)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /Sửa phòng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
    expect(screen.getByRole('button', { name: 'Nhà gỗ' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Đêm ấm' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    await screen.findByRole('button', { name: /Sửa phòng/ });
    expect(mocked.saveRoom).toHaveBeenCalledTimes(2);
    expect(mocked.saveRoom.mock.calls[1]![1]).toBe(3);
  });

  it('lưu bị 409 slots_in_use → hiện thông báo của server', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 2, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValueOnce(new ApiError(409, 'slots_in_use', 'Đã có lời nhắn ở điểm 10.'));
    mocked.saveRoom.mockResolvedValue({ roomVersion: 3 });
    renderAt();
    expect(await screen.findByText('Đã có lời nhắn ở điểm 10.')).toBeInTheDocument();
  });
  it('"Xong" khi mất mạng: ở lại chế độ Sửa, vẫn thử lại; có mạng → Đã lưu → "Xong" mới về Xem', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValueOnce(new ApiError(0, 'network', 'x')).mockResolvedValue({ roomVersion: 3 });
    renderAt();
    await userEvent.click(await screen.findByRole('button', { name: /Sửa phòng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nhà gỗ' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    expect(await screen.findByText('Chưa lưu được — thay đổi vẫn giữ trên máy.')).toBeInTheDocument();
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa phòng/ })).not.toBeInTheDocument();
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('online'));
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(mocked.saveRoom).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
  });

  it('"Xong" gặp 403 write_closed: về Xem với bản server đã nhận, không phải bản bị từ chối; giữ nháp', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(403, 'write_closed', 'x'));
    const { container } = renderAt();
    await userEvent.click(await screen.findByRole('button', { name: /Sửa phòng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nhà gỗ' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    expect(await screen.findByText('Cây của Lan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa phòng/ })).not.toBeInTheDocument();
    expect(container.querySelector('img[data-bg]')!.getAttribute('src')).toContain('bg-night');
    expect(storage.getDraft(ID)!.room.background).not.toBe('night');
  });
});
