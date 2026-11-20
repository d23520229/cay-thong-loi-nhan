import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, type PublicRoom } from '../lib/api';
import { resetClock } from '../lib/clock';
import { storage } from '../lib/storage';
import { defaultRoom } from '../room/model';
import { GuestTree } from './GuestTree';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      getConfig: vi.fn(), getTree: vi.fn(), postMessage: vi.fn(), getMine: vi.fn(), editMessage: vi.fn(), deleteMessage: vi.fn(),
      getOwnerTree: vi.fn(), saveRoom: vi.fn(), authPin: vi.fn(), authLink: vi.fn(), authGoogle: vi.fn(), createTree: vi.fn(), logout: vi.fn(),
    },
  };
});
const mocked = vi.mocked(api);
const ID = 'abcdefgh';
const room = defaultRoom();
const NOW = Date.parse('2026-12-01T05:00:00Z');
const emptySlots = () => Array.from({ length: 12 }, (_, index) => ({ index, occupied: false }));
const slotsWith = (i: number, ornament = 'bell') =>
  emptySlots().map((s) => (s.index === i ? { ...s, occupied: true, ornament } : s));
const meta = (over: Partial<PublicRoom> = {}): PublicRoom => ({
  id: ID, ownerName: 'Lan', title: null, ...room, slots: emptySlots(), roomVersion: 1, phase: 'BUILD', ...over,
});
const toast = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 2 });
  vi.setSystemTime(NOW);
  localStorage.clear();
  vi.resetAllMocks();
  resetClock();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  mocked.getConfig.mockResolvedValue({ now: new Date(NOW).toISOString() } as never);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const show = (m: PublicRoom = meta()) => {
  mocked.getTree.mockResolvedValue(m);
  return render(
    <MemoryRouter>
      <GuestTree treeId={ID} meta={m} room={room} toast={toast} onOwnerLogin={() => {}} />
    </MemoryRouter>,
  );
};
const zoom = async (c: HTMLElement) => {
  fireEvent.pointerDown(c.querySelector('[data-type="tree"]')!);
  await screen.findByRole('button', { name: /Về căn phòng/ });
  await waitFor(() => expect(mocked.getTree).toHaveBeenCalled());
};
const bubbles = () => screen.queryAllByRole('button', { name: 'Điểm trống, chạm để treo lời nhắn' });
const writeAndSend = async (text = 'Giáng sinh vui') => {
  if (screen.queryByRole('textbox', { name: 'Tên của bạn' })?.getAttribute('value') === '') {
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn danh' }));
  }
  await userEvent.type(screen.getByRole('textbox', { name: /Lời nhắn/ }), text);
  await userEvent.click(screen.getByRole('button', { name: 'Treo lên cây' }));
};
const posted = { messageId: '9', editToken: 'tok', editUntil: new Date(NOW + 15 * 60_000).toISOString() };
const mineMsg = (until: string) => ({ messageId: '9', slotIndex: 2, ornament: 'bell', anonymous: true, authorName: null, content: 'Cũ', editUntil: until });
/** Điểm 2 là lời nhắn của máy này, còn `minutes` phút. */
const withMine = (minutes: number) => {
  const until = new Date(NOW + minutes * 60_000).toISOString();
  storage.setMine(ID, 2, { messageId: '9', editToken: 'tok', editUntil: until });
  mocked.getMine.mockResolvedValue(mineMsg(until));
  return meta({ slots: slotsWith(2) });
};
const openMine = async () => userEvent.click(await screen.findByRole('button', { name: 'Lời nhắn của bạn: Chuông' }));

describe('GuestTree', () => {
  it('lời nhắc chạm cây; chạm cây → 12 điểm, nút Về căn phòng, gọi lại getTree', async () => {
    const { container } = show();
    expect(screen.getByText('Chạm vào cây thông để treo lời nhắn')).toBeInTheDocument();
    await zoom(container);
    expect(bubbles()).toHaveLength(12);
    expect(mocked.getTree).toHaveBeenCalledWith(ID);
    expect(screen.queryByText('Tạo cây của bạn')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Về căn phòng/ }));
    expect(bubbles()).toHaveLength(0);
    expect(screen.getByText('Tạo cây của bạn')).toBeInTheDocument();
  });

  it('treo thành công lưu msg:, lastName, toast "Còn 15 phút"', async () => {
    mocked.postMessage.mockResolvedValue(posted);
    const { container } = show();
    await zoom(container);
    await userEvent.click(bubbles()[3]!);
    await userEvent.type(screen.getByRole('textbox', { name: 'Tên của bạn' }), 'An');
    await writeAndSend();
    expect(mocked.postMessage).toHaveBeenCalledWith(ID, {
      slotIndex: 3, ornament: 'ball', anonymous: false, authorName: 'An', content: 'Giáng sinh vui', website: '',
    });
    expect(storage.getMine(ID, 3)).toEqual(posted);
    expect(storage.getLastName()).toBe('An');
    expect(toast).toHaveBeenCalledWith('Đã treo! Còn 15 phút để sửa');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lời nhắn của bạn: Quả châu' })).toHaveClass('gs-drop');
  });

  it('slot_taken: toast, tải lại slots, chạm bong bóng khác thấy chữ cũ', async () => {
    mocked.postMessage.mockRejectedValue(new ApiError(409, 'slot_taken', 'Chỗ này vừa có người treo, chọn chỗ khác nhé'));
    const { container } = show();
    await zoom(container);
    mocked.getTree.mockResolvedValue(meta({ slots: slotsWith(0) }));
    await userEvent.click(bubbles()[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn danh' }));
    await writeAndSend('Chữ của tôi');
    expect(toast).toHaveBeenCalledWith('Chỗ này vừa có người treo, chọn chỗ khác nhé');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chuông đã treo' })).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(bubbles()[0]!);
    expect(screen.getByRole('textbox', { name: /Lời nhắn/ })).toHaveValue('Chữ của tôi');
    expect(screen.getByRole('button', { name: 'Ẩn danh' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['device_limit', new ApiError(409, 'device_limit', 'Mỗi người chỉ treo được 3 lời nhắn trên một cây.'), 'Mỗi người chỉ treo được 3 lời nhắn trên một cây.'],
    ['blocked', new ApiError(403, 'blocked', 'Bạn không thể gửi lời nhắn tới cây này.'), 'Bạn không thể gửi lời nhắn tới cây này.'],
    ['429', new ApiError(429, 'rate_limited', 'Bạn thao tác nhanh quá, đợi một lát nhé.'), 'Bạn thao tác nhanh quá, đợi một lát nhé.'],
    ['503 paused', new ApiError(503, 'paused', 'Đang bảo trì một chút, quay lại sau ít phút nhé'), 'Đang bảo trì một chút, quay lại sau ít phút nhé'],
    ['mạng', new ApiError(0, 'network', 'x'), 'Chưa gửi được, thử lại nhé'],
    ['500', new ApiError(500, 'unknown', 'x'), 'Chưa gửi được, thử lại nhé'],
  ])('lỗi %s: thông báo trong bảng, chữ còn nguyên', async (_name, err, msg) => {
    mocked.postMessage.mockRejectedValue(err);
    const { container } = show();
    await zoom(container);
    await userEvent.click(bubbles()[0]!);
    await writeAndSend('Còn đây');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert')).toHaveTextContent(msg);
    expect(within(dialog).getByRole('textbox', { name: /Lời nhắn/ })).toHaveValue('Còn đây');
    expect(screen.getByRole('button', { name: 'Treo lên cây' })).toBeEnabled();
  });

  it('write_closed: bảng đóng, không còn bong bóng', async () => {
    mocked.postMessage.mockRejectedValue(new ApiError(403, 'write_closed', 'x'));
    const { container } = show();
    await zoom(container);
    await userEvent.click(bubbles()[0]!);
    await writeAndSend();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bubbles()).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith('Đã hết thời gian treo lời nhắn');
  });

  it('phase NOTICE: zoom được, không có bong bóng', async () => {
    const { container } = show(meta({ phase: 'NOTICE' }));
    await zoom(container);
    expect(bubbles()).toHaveLength(0);
  });

  it('cây đầy: hiện "Cây đã đầy lời nhắn"', async () => {
    const { container } = show(meta({ slots: emptySlots().map((s) => ({ ...s, occupied: true, ornament: 'bell' })) }));
    await zoom(container);
    expect(screen.getByText('Cây đã đầy lời nhắn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tạo cây của bạn' })).toHaveAttribute('href', `/?ref=${ID}`);
  });

  it('sửa trong hạn: getMine với token, "Còn N phút" theo giờ server', async () => {
    // Máy chậm 1 ngày so với server: hạn phải tính theo server.
    const serverNow = NOW + 86_400_000;
    mocked.getConfig.mockResolvedValue({ now: new Date(serverNow).toISOString() } as never);
    const until = new Date(serverNow + 7 * 60_000).toISOString();
    storage.setMine(ID, 2, { messageId: '9', editToken: 'tok', editUntil: until });
    mocked.getMine.mockResolvedValue(mineMsg(until));
    const { container } = show(meta({ slots: slotsWith(2) }));
    await waitFor(() => expect(mocked.getConfig).toHaveBeenCalled());
    await zoom(container);
    await openMine();
    expect(mocked.getMine).toHaveBeenCalledWith('9', 'tok');
    expect(await screen.findByText('Còn 7 phút để sửa hoặc xoá lời nhắn này.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Lời nhắn/ })).toHaveValue('Cũ');
  });

  it('sửa: lưu thành công gọi editMessage và đóng bảng', async () => {
    mocked.editMessage.mockResolvedValue({ ok: true });
    const { container } = show(withMine(7));
    await zoom(container);
    await openMine();
    await userEvent.type(await screen.findByRole('textbox', { name: /Lời nhắn/ }), ' mới');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(mocked.editMessage).toHaveBeenCalledWith('9', 'tok', { ornament: 'bell', anonymous: true, content: 'Cũ mới' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sửa: already_opened → toast, khoá msg: bị xoá', async () => {
    mocked.editMessage.mockRejectedValue(new ApiError(403, 'already_opened', 'Chủ cây đã mở lời nhắn này, không sửa được nữa.'));
    const { container } = show(withMine(7));
    await zoom(container);
    await openMine();
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));
    expect(toast).toHaveBeenCalledWith('Chủ cây đã mở lời nhắn này, không sửa được nữa.');
    expect(storage.getMine(ID, 2)).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sửa: conflict → lỗi trong bảng, khoá còn', async () => {
    mocked.editMessage.mockRejectedValue(new ApiError(409, 'conflict', 'Lời nhắn vừa thay đổi, thử lại nhé.'));
    const { container } = show(withMine(7));
    await zoom(container);
    await openMine();
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Lời nhắn vừa thay đổi, thử lại nhé.');
    expect(storage.getMine(ID, 2)).not.toBeNull();
  });

  it('xoá: confirm → deleteMessage, điểm thành bong bóng', async () => {
    mocked.deleteMessage.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = show(withMine(7));
    await zoom(container);
    await openMine();
    await userEvent.click(await screen.findByRole('button', { name: 'Xoá lời nhắn' }));
    expect(mocked.deleteMessage).toHaveBeenCalledWith('9', 'tok');
    await waitFor(() => expect(bubbles()).toHaveLength(12));
    expect(storage.getMine(ID, 2)).toBeNull();
  });

  it('lời nhắn của mình đã hết hạn: hiện như đã treo, không gọi getMine', async () => {
    const { container } = show(withMine(-1));
    await zoom(container);
    await userEvent.click(screen.getByRole('button', { name: 'Chuông đã treo' }));
    expect(mocked.getMine).not.toHaveBeenCalled();
    expect(storage.getMine(ID, 2)).toBeNull();
  });

  it('khoá msg: hỏng không làm sập trang', async () => {
    localStorage.setItem(`msg:${ID}:2`, '{hỏng');
    const { container } = show(meta({ slots: slotsWith(2) }));
    await zoom(container);
    expect(screen.getByRole('button', { name: 'Chuông đã treo' })).toBeInTheDocument();
    expect(localStorage.getItem(`msg:${ID}:2`)).toBeNull();
  });

  it('chạm phụ kiện người khác: rung, không gọi API', async () => {
    const { container } = show(meta({ slots: slotsWith(4) }));
    await zoom(container);
    await userEvent.click(screen.getByRole('button', { name: 'Chuông đã treo' }));
    expect(screen.getByRole('button', { name: 'Chuông đã treo' })).toHaveClass('gs-ring');
    expect(mocked.getMine).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('button', { name: 'Chuông đã treo' })).not.toHaveClass('gs-ring');
  });

  it('khách chỉ gọi API công khai và API lời nhắn của chính mình', async () => {
    mocked.postMessage.mockResolvedValue(posted);
    const { container } = show();
    await zoom(container);
    await userEvent.click(bubbles()[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn danh' }));
    await writeAndSend();
    for (const k of ['getOwnerTree', 'saveRoom', 'authPin', 'authLink', 'authGoogle', 'createTree', 'logout'] as const) {
      expect(mocked[k]).not.toHaveBeenCalled();
    }
  });
});

describe('GuestTree — sửa sau lượt soát', () => {
  it('máy chạy nhanh hơn server: khoá msg: còn hạn theo server không bị xoá khi mở trang', async () => {
    const serverNow = NOW - 86_400_000; // máy nhanh 1 ngày
    let release!: (v: unknown) => void;
    mocked.getConfig.mockReturnValue(new Promise((r) => { release = r; }) as never);
    const until = new Date(serverNow + 7 * 60_000).toISOString();
    storage.setMine(ID, 2, { messageId: '9', editToken: 'tok', editUntil: until });
    mocked.getMine.mockResolvedValue(mineMsg(until));
    const { container } = show(meta({ slots: slotsWith(2) }));
    expect(storage.getMine(ID, 2)).not.toBeNull();
    await act(async () => release({ now: new Date(serverNow).toISOString() }));
    expect(storage.getMine(ID, 2)).not.toBeNull();
    await zoom(container);
    await openMine();
    expect(await screen.findByText('Còn 7 phút để sửa hoặc xoá lời nhắn này.')).toBeInTheDocument();
  });

  it('đang gửi thì không đóng được bảng (Escape / ✕), chữ không mất', async () => {
    let finish!: (v: unknown) => void;
    mocked.postMessage.mockReturnValue(new Promise((r) => { finish = r; }) as never);
    const { container } = show();
    await zoom(container);
    await userEvent.click(bubbles()[0]!);
    await writeAndSend('Đang gửi');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => finish(posted));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
