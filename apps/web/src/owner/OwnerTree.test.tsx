import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, type OpenedMessage, type OwnerRoom, type OwnerSlot } from '../lib/api';
import { resetClock } from '../lib/clock';
import { storage } from '../lib/storage';
import { defaultRoom } from '../room/model';
import { OwnerTree } from './OwnerTree';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      getConfig: vi.fn(), getOwnerTree: vi.fn(), openMessage: vi.fn(), ownerDeleteMessage: vi.fn(), blockSender: vi.fn(),
      report: vi.fn(), setShowCount: vi.fn(), deleteTree: vi.fn(),
    },
  };
});
const mocked = vi.mocked(api);
const ID = 'abcdefgh';
const room = defaultRoom();
const NOW = Date.parse('2026-12-20T17:00:00Z'); // 0h 21/12 giờ VN — còn 3 ngày
const UNLOCK = '2026-12-23T17:00:00.000Z';
const toast = vi.fn();

const slots = (locked: boolean): OwnerSlot[] =>
  Array.from({ length: 12 }, (_, index) =>
    index === 1 || index === 4 || index === 7
      ? { index, occupied: true, ornament: 'bell', messageId: String(100 + index), unread: index !== 7, locked }
      : { index, occupied: false, locked },
  );
const meta = (over: Partial<OwnerRoom> = {}): OwnerRoom => ({
  id: ID, ownerName: 'Lan', title: null, ...room, slots: slots(true), roomVersion: 1, phase: 'BUILD',
  messageCount: 3, newSinceLastVisit: 2, showMessageCount: true, ...over,
});
const opened = (index: number, over: Partial<OpenedMessage> = {}): OpenedMessage => ({
  messageId: String(100 + index), slotIndex: index, ornament: 'bell', anonymous: false, authorName: `Bạn ${index}`,
  content: `Nội dung ${index}`, createdAt: '2026-12-01T01:00:00Z', ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 2 });
  vi.setSystemTime(NOW);
  localStorage.clear();
  vi.resetAllMocks();
  resetClock();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }));
  mocked.getConfig.mockResolvedValue({ now: new Date(NOW).toISOString(), unlockAt: UNLOCK } as never);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const show = (m: OwnerRoom = meta()) => {
  mocked.getOwnerTree.mockResolvedValue(m);
  return render(
    <MemoryRouter initialEntries={[`/c/${ID}`]}>
      <Routes>
        <Route path="/" element={<div>Trang chủ</div>} />
        <Route path="/c/:id" element={<OwnerTree treeId={ID} meta={m} room={room} toast={toast} onUnauthorized={() => {}} />} />
      </Routes>
    </MemoryRouter>,
  );
};
const zoom = async (c: HTMLElement) => {
  fireEvent.click(c.querySelector('[data-type="tree"]')!);
  await screen.findByRole('button', { name: /Về căn phòng/ });
  await waitFor(() => expect(mocked.getOwnerTree).toHaveBeenCalled());
};
const openSheet = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Tuỳ chọn/ }));
  return screen.getByRole('dialog', { name: 'Tuỳ chọn' });
};

describe('OwnerTree', () => {
  it('BUILD: đếm ngược theo giờ server, số lời nhắn và số mới', async () => {
    show();
    expect(await screen.findByText('Còn 3 ngày 0 giờ nữa là mở quà · 3 lời nhắn · 2 mới')).toBeInTheDocument();
    expect(screen.getByText('Chạm vào cây để xem các món quà đang chờ')).toBeInTheDocument();
  });

  it('tắt hiện số lời nhắn thì không có số', async () => {
    show(meta({ showMessageCount: false }));
    expect(await screen.findByText('Còn 3 ngày 0 giờ nữa là mở quà')).toBeInTheDocument();
  });

  it('BUILD: zoom → quà còn gói, chạm thì báo, không mở', async () => {
    const { container } = show();
    await zoom(container);
    const gifts = screen.getAllByRole('button', { name: 'Quà còn gói' });
    expect(gifts).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Điểm trống/ })).not.toBeInTheDocument();
    await userEvent.click(gifts[0]!);
    expect(toast).toHaveBeenCalledWith('Quà còn gói — mở được từ 0h 24/12');
    expect(mocked.openMessage).not.toHaveBeenCalled();
  });

  const openedRoom = () => meta({ phase: 'OPEN', slots: slots(false) });

  it('OPEN: "Quà đã mở!", chạm phụ kiện → thẻ lời nhắn, chuyển sang đã đọc', async () => {
    mocked.openMessage.mockResolvedValue(opened(1));
    const { container } = show(openedRoom());
    expect(await screen.findByText('Quà đã mở! · 3 lời nhắn · 2 mới')).toBeInTheDocument();
    await zoom(container);
    await userEvent.click(screen.getAllByRole('button', { name: 'Lời nhắn chưa đọc: Chuông' })[0]!);
    expect(mocked.openMessage).toHaveBeenCalledWith(ID, '101');
    expect(await screen.findByRole('dialog', { name: 'Lời nhắn từ Bạn 1' })).toHaveTextContent('Nội dung 1');
    expect(screen.getAllByRole('button', { name: 'Lời nhắn đã đọc: Chuông' })).toHaveLength(2);
  });

  it('Sau › mở điểm kế tiếp theo thứ tự điểm', async () => {
    mocked.openMessage.mockImplementation(async (_id, mid) => opened(Number(mid) - 100));
    const { container } = show(openedRoom());
    await zoom(container);
    await userEvent.click(screen.getAllByRole('button', { name: /Lời nhắn chưa đọc/ })[0]!);
    await screen.findByRole('dialog', { name: 'Lời nhắn từ Bạn 1' });
    await userEvent.click(screen.getByRole('button', { name: 'Sau ›' }));
    expect(await screen.findByRole('dialog', { name: 'Lời nhắn từ Bạn 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹ Trước' })).toBeEnabled();
  });

  it('xoá lời nhắn đang mở: gọi API, điểm biến mất, thẻ đóng, Sau › không mở lại điểm đã xoá', async () => {
    mocked.openMessage.mockImplementation(async (_id, mid) => opened(Number(mid) - 100));
    mocked.ownerDeleteMessage.mockResolvedValue(undefined);
    const { container } = show(openedRoom());
    await zoom(container);
    await userEvent.click(screen.getAllByRole('button', { name: /Lời nhắn chưa đọc/ })[1]!); // điểm 4
    await screen.findByRole('dialog', { name: 'Lời nhắn từ Bạn 4' });
    await userEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Xoá' }));
    expect(mocked.ownerDeleteMessage).toHaveBeenCalledWith(ID, '104');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Lời nhắn/ })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: /Lời nhắn chưa đọc/ })[0]!); // điểm 1
    await screen.findByRole('dialog', { name: 'Lời nhắn từ Bạn 1' });
    await userEvent.click(screen.getByRole('button', { name: 'Sau ›' }));
    expect(await screen.findByRole('dialog', { name: 'Lời nhắn từ Bạn 7' })).toBeInTheDocument();
  });

  it('chặn người gửi gọi blockSender', async () => {
    mocked.openMessage.mockResolvedValue(opened(1));
    mocked.blockSender.mockResolvedValue(undefined);
    const { container } = show(openedRoom());
    await zoom(container);
    await userEvent.click(screen.getAllByRole('button', { name: /Lời nhắn chưa đọc/ })[0]!);
    await userEvent.click(await screen.findByRole('button', { name: 'Chặn người gửi' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Chặn' }));
    expect(mocked.blockSender).toHaveBeenCalledWith(ID, '101');
    expect(toast).toHaveBeenCalledWith('Đã chặn người gửi');
  });

  it('báo cáo gửi messageId và lý do', async () => {
    mocked.openMessage.mockResolvedValue(opened(1));
    mocked.report.mockResolvedValue({ reportId: '1' });
    const { container } = show(openedRoom());
    await zoom(container);
    await userEvent.click(screen.getAllByRole('button', { name: /Lời nhắn chưa đọc/ })[0]!);
    await userEvent.click(await screen.findByRole('button', { name: 'Báo cáo' }));
    await userEvent.type(screen.getByRole('textbox', { name: /Lý do/ }), 'xấu');
    await userEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));
    expect(mocked.report).toHaveBeenCalledWith(ID, { messageId: '101', reason: 'xấu' });
    expect(toast).toHaveBeenCalledWith('Đã gửi báo cáo, cảm ơn bạn');
  });

  it('423 khi mở → thông báo của server', async () => {
    mocked.openMessage.mockRejectedValue(new ApiError(423, 'locked', 'Chưa đến 0h 24/12, quà vẫn còn gói.'));
    const { container } = show(openedRoom());
    await zoom(container);
    await userEvent.click(screen.getAllByRole('button', { name: /Lời nhắn chưa đọc/ })[0]!);
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Chưa đến 0h 24/12, quà vẫn còn gói.'));
  });

  it('tuỳ chọn: tắt hiện số lời nhắn', async () => {
    mocked.setShowCount.mockResolvedValue({ showMessageCount: false });
    show();
    await screen.findByText(/3 lời nhắn/);
    const sheet = await openSheet();
    await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Hiện số lời nhắn' }));
    expect(mocked.setShowCount).toHaveBeenCalledWith(ID, false);
    await waitFor(() => expect(screen.queryByText(/3 lời nhắn/)).not.toBeInTheDocument());
  });

  it('tuỳ chọn: xoá cây → hỏi lại → deleteTree, bỏ khỏi myTrees, về trang chủ', async () => {
    storage.addMyTree({ id: ID, title: null, createdAt: '1' });
    mocked.deleteTree.mockResolvedValue(undefined);
    show();
    const sheet = await openSheet();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Xoá cây này' }));
    await userEvent.click(within(screen.getByRole('alertdialog', { name: 'Xoá cây và mọi lời nhắn?' })).getByRole('button', { name: 'Xoá cây' }));
    expect(mocked.deleteTree).toHaveBeenCalledWith(ID);
    expect(await screen.findByText('Trang chủ')).toBeInTheDocument();
    expect(storage.myTrees()).toEqual([]);
  });

  it('đếm ngược tự cập nhật', async () => {
    show(meta({ showMessageCount: false }));
    await screen.findByText('Còn 3 ngày 0 giờ nữa là mở quà');
    await act(() => vi.advanceTimersByTimeAsync(2 * 3600_000));
    expect(screen.getByText('Còn 2 ngày 22 giờ nữa là mở quà')).toBeInTheDocument();
  });
});
