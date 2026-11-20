import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    api: { getOwnerTree: vi.fn(), getTree: vi.fn(), authLink: vi.fn(), authPin: vi.fn(), saveRoom: vi.fn(), getConfig: vi.fn() },
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
// Tự lưu gộp 1,5 giây: đồng hồ giả (vẫn trôi theo giờ thật cho userEvent/waitFor), tua qua mốc đó thay vì chờ.
const passDebounce = () => act(() => vi.advanceTimersByTimeAsync(1500));

/** Vào chế độ Sửa và đổi phông nền (mặc định 'night') sang "Nhà gỗ". */
const editBackground = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Sửa phòng/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
  await userEvent.click(screen.getByRole('button', { name: 'Nhà gỗ' }));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 2 });
  localStorage.clear();
  vi.resetAllMocks();
  mocked.getConfig.mockRejectedValue(new Error('không cần trong test này'));
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
  vi.useRealTimers();
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

  it('khách trên máy thấp 360x640: phòng không bị khối nút phía dưới che', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 360 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 640 });
    try {
      mocked.getOwnerTree.mockRejectedValue(unauthorized());
      mocked.getTree.mockResolvedValue(publicRoom());
      const { container } = renderAt();
      await screen.findByRole('link', { name: 'Tạo cây của bạn' });
      const box = container.querySelector<HTMLElement>('.room-stage [style*="transform: scale"]')!.parentElement!;
      expect(parseFloat(box.style.top)).toBe(56);
      expect(parseFloat(box.style.top) + parseFloat(box.style.height)).toBeLessThanOrEqual(640 - 116);
    } finally {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
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
    expect(screen.getByText('Link riêng chưa đúng hoặc đã hết hạn.')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(storage.myTrees()).toEqual([]);
  });

  it('còn draft:{id} từ bản cũ → xoá khi mở phòng; mở chế độ Xem, không gửi, không hỏi (kể cả StrictMode)', async () => {
    const mine = defaultRoom();
    mine.tree = { ...mine.tree, slotCount: 9 };
    storage.setDraft(ID, { room: mine, baseVersion: 1, savedAt: '' });
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    renderAt(`/c/${ID}`, true);
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
    expect(storage.getDraft(ID)).toBeNull();
    expect(screen.queryByText('Dùng bản mới nhất')).not.toBeInTheDocument();
    expect(mocked.saveRoom).not.toHaveBeenCalled();
  });

  it('/c/new không xoá nháp /tao (draft:new)', async () => {
    storage.setDraft('new', { room: defaultRoom(), baseVersion: null, savedAt: 'x' });
    mocked.getOwnerTree.mockRejectedValue(new ApiError(404, 'not_found', 'x'));
    renderAt('/c/new');
    expect(await screen.findByText('Không tìm thấy cây này.')).toBeInTheDocument();
    expect(storage.getDraft('new')).not.toBeNull();
  });

  it('StrictMode: chỉ một bộ tự lưu — sửa một lần thì gửi đúng một lần', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockResolvedValue({ roomVersion: 3 });
    renderAt(`/c/${ID}`, true);
    await editBackground();
    await passDebounce();
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
    expect(mocked.saveRoom).toHaveBeenCalledWith(ID, 2, expect.objectContaining({ background: expect.not.stringMatching(/^night$/) }));
  });

  it('lưu bị 401 → "Chào chủ cây" → đăng nhập → tải lại và gửi lại thay đổi', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValueOnce(unauthorized()).mockResolvedValue({ roomVersion: 3 });
    renderAt();
    await editBackground();
    await passDebounce();
    expect(await screen.findByRole('dialog', { name: 'Chào chủ cây 👋' })).toBeInTheDocument();
    mocked.authPin.mockResolvedValue(undefined);
    await userEvent.type(screen.getByLabelText('Mã PIN 6 số'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Vào cây' }));
    await waitFor(() => expect(mocked.saveRoom).toHaveBeenCalledTimes(2));
    expect(mocked.getOwnerTree).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Xong' }).length).toBeGreaterThan(0);
  });

  it('lưu bị 403 write_closed → về Xem, ẩn "Sửa phòng"', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(403, 'write_closed', 'x'));
    renderAt();
    await editBackground();
    await passDebounce();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Xong' })).not.toBeInTheDocument());
    expect(screen.getByText('Cây của Lan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa phòng/ })).not.toBeInTheDocument();
  });

  it('lưu bị lỗi mạng → "Chưa lưu", thông báo "Mất mạng — thay đổi chưa được lưu", không ghi draft:{id}', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(0, 'network', 'x'));
    renderAt();
    await editBackground();
    await passDebounce();
    expect(await screen.findByText('Mất mạng — thay đổi chưa được lưu')).toBeInTheDocument();
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument();
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
    expect(storage.getDraft(ID)).toBeNull();
  });

  it('lưu bị 429 → báo lưu hơi nhiều, không báo mất mạng', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(429, 'rate_limited', 'x'));
    renderAt();
    await editBackground();
    await passDebounce();
    expect(
      await screen.findByText('Bạn lưu hơi nhiều, sẽ tự lưu lại sau ít phút.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Mất mạng — thay đổi chưa được lưu')).not.toBeInTheDocument();
  });

  it('lưu bị 404 (cây đã bị xoá ở nơi khác) → "Cây này không còn nữa.", ngừng lưu; "Xong" vẫn về Xem', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(404, 'not_found', 'x'));
    renderAt();
    await editBackground();
    await passDebounce();
    expect(await screen.findByText('Cây này không còn nữa.')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
    expect(screen.getByText('Thay đổi chưa được lưu.')).toBeInTheDocument();
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
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

    await userEvent.click(screen.getByRole('button', { name: /Sửa phòng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
    expect(screen.getByRole('button', { name: 'Nhà gỗ' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Đêm ấm' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    await screen.findByRole('button', { name: /Sửa phòng/ });
    expect(mocked.saveRoom).toHaveBeenCalledTimes(2);
    expect(mocked.saveRoom.mock.calls[1]![1]).toBe(3);
  });

  it('rời trang khi đang sửa → gửi ngay một lần, không ghi draft:{id}', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(0, 'network', 'x'));
    const { unmount } = renderAt();
    await editBackground();
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    await waitFor(() => expect(mocked.saveRoom).toHaveBeenCalledTimes(1));
    expect(mocked.saveRoom.mock.calls[0]![2].background).not.toBe('night');
    expect(storage.getDraft(ID)).toBeNull();
  });

  it('lưu bị 409 slots_in_use → hiện thông báo của server', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValueOnce(new ApiError(409, 'slots_in_use', 'Đã có lời nhắn ở điểm 10.'));
    mocked.saveRoom.mockResolvedValue({ roomVersion: 3 });
    renderAt();
    await editBackground();
    await passDebounce();
    expect(await screen.findByText('Đã có lời nhắn ở điểm 10.')).toBeInTheDocument();
  });
  it('"Xong" khi mất mạng: vẫn về Xem với bản server đã xác nhận, báo "Thay đổi chưa được lưu.", không gửi thêm', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(0, 'network', 'x'));
    const { container } = renderAt();
    await editBackground();
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    expect(await screen.findByRole('button', { name: /Sửa phòng/ })).toBeInTheDocument();
    expect(screen.getByText('Thay đổi chưa được lưu.')).toBeInTheDocument();
    expect(container.querySelector('img[data-bg]')!.getAttribute('src')).toContain('bg-night');
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 0));
    expect(mocked.saveRoom).toHaveBeenCalledTimes(1);
    expect(storage.getDraft(ID)).toBeNull();

    // Vào Sửa lại: bắt đầu từ bản server, không phải bản chưa lưu.
    await userEvent.click(screen.getByRole('button', { name: /Sửa phòng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
    expect(screen.getByRole('button', { name: 'Nhà gỗ' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Đã lưu')).toBeInTheDocument();
  });

  it('"Xong" gặp 403 write_closed: về Xem với bản server đã nhận, không phải bản bị từ chối', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    mocked.saveRoom.mockRejectedValue(new ApiError(403, 'write_closed', 'x'));
    const { container } = renderAt();
    await editBackground();
    await userEvent.click(screen.getAllByRole('button', { name: 'Xong' })[0]!);
    expect(await screen.findByText('Cây của Lan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa phòng/ })).not.toBeInTheDocument();
    expect(container.querySelector('img[data-bg]')!.getAttribute('src')).toContain('bg-night');
  });
});

describe('RoomPage chủ cây (M3 phần 2)', () => {
  it('StrictMode: vào trang chỉ gọi /owner một lần (giữ số "mới")', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom({ messageCount: 3, newSinceLastVisit: 2 }));
    renderAt(`/c/${ID}`, true);
    expect(await screen.findByText(/3 lời nhắn · 2 mới/)).toBeInTheDocument();
    expect(mocked.getOwnerTree).toHaveBeenCalledTimes(1);
  });
});

describe('RoomPage hiệu ứng chạm (G6)', () => {
  it('khách chạm hộp quà hai lần thấy hai class khác nhau', async () => {
    mocked.getOwnerTree.mockRejectedValue(unauthorized());
    mocked.getTree.mockResolvedValue(publicRoom());
    const { container } = renderAt();
    await screen.findByText('Tạo cây của bạn');
    const gift = () => container.querySelector<HTMLElement>('[data-type="gift"]')!;
    fireEvent.click(gift());
    expect(gift().classList.contains('g-hop')).toBe(true);
    fireEvent.click(gift());
    expect(gift().classList.contains('g-shake')).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(1900));
    expect(gift().classList.contains('g-shake')).toBe(false);
  });

  it('chủ cây ở chế độ Xem chạm thú cưng cũng có hiệu ứng', async () => {
    mocked.getOwnerTree.mockResolvedValue(ownerRoom());
    const { container } = renderAt();
    await screen.findByRole('button', { name: /Sửa phòng/ });
    fireEvent.click(container.querySelector<HTMLElement>('[data-type="pet"]')!);
    expect(container.querySelector('[data-type="pet"]')!.classList.contains('pop')).toBe(true);
  });
});
