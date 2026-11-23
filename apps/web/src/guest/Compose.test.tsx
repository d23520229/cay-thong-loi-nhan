import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { serverNow } from '../lib/clock';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const gate = vi.hoisted(() => ({ pending: null as Promise<unknown> | null }));
vi.mock('../card/measure', () => ({
  cardMeasure: () => gate.pending ?? Promise.resolve((s: string, px: number) => [...s].length * px * 0.5),
}));
vi.mock('../card/CardCanvas', () => ({
  CardCanvas: ({ data }: { data: { content: string; sign: string; sentAt: string; photo?: { id?: string } | null } }) => (
    <div data-testid="thiep" data-photo={data.photo?.id ?? ''}>{data.content}|{data.sign}|{data.sentAt}</div>
  ),
}));
const { preparePhoto } = vi.hoisted(() => ({ preparePhoto: vi.fn() }));
vi.mock('../card/photo', async (orig) => ({ ...(await orig<typeof import('../card/photo')>()), preparePhoto }));
import { PhotoError } from '../card/photo';
import { Compose, newDraft, type ComposeDraft } from './Compose';

type Extra = Partial<Parameters<typeof Compose>[0]>;
function Harness({ initial = newDraft('Lan'), ...rest }: Extra & { initial?: ComposeDraft }) {
  const [draft, setDraft] = useState(initial);
  return <Compose mode="new" draft={draft} onChange={setDraft} busy={false} onSubmit={() => {}} onClose={() => {}} {...rest} />;
}
const inMinutes = (m: number) => new Date(serverNow() + m * 60_000 - 1_000).toISOString();
const previewBtn = () => screen.getByRole('button', { name: 'Xem trước thiệp' });
const submitBtn = () => screen.getByRole('button', { name: /Treo lên cây|Lưu thay đổi/ });
const toPreview = async () => {
  await userEvent.click(previewBtn());
  await screen.findByTestId('thiep');
};
const text = () => screen.getByRole('textbox', { name: /Lời nhắn/ });
const fakePhoto = (id = 'p1') => ({ bitmap: { id, width: 4, height: 3, close: vi.fn() } as unknown as ImageBitmap, base64: `b64-${id}` });
const pick = (f = new File(['x'], 'a.jpg', { type: 'image/jpeg' })) => userEvent.upload(screen.getByLabelText(/Kèm ảnh|Đổi ảnh/), f);

describe('Compose', () => {
  // jsdom không có canvas: ảnh nhỏ xem trước không vẽ gì (tránh lỗi 'Not implemented').
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('mặc định chọn Quả châu (ball) và Để tên, tên điền lastName', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Quả châu' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Để tên' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('textbox', { name: 'Tên của bạn' })).toHaveValue('Lan');
    expect(screen.getAllByRole('button', { pressed: false }).filter((b) => b.classList.contains('orn-pick'))).toHaveLength(19);
  });

  it('nút Treo khoá khi lời nhắn trống hoặc chỉ khoảng trắng', async () => {
    render(<Harness />);
    expect(previewBtn()).toBeDisabled();
    await userEvent.type(text(), '   ');
    expect(previewBtn()).toBeDisabled();
    await userEvent.type(text(), 'Chúc');
    expect(previewBtn()).toBeEnabled();
  });

  it('phông chưa đo xong → khoá nút và báo "Đang chuẩn bị khung thiệp…", đo xong thì mở', async () => {
    let done!: (m: unknown) => void;
    gate.pending = new Promise((r) => { done = r; });
    try {
      render(<Harness initial={{ ...newDraft('Lan'), content: 'Chúc' }} />);
      expect(previewBtn()).toBeDisabled();
      expect(screen.getByRole('alert')).toHaveTextContent('Đang chuẩn bị khung thiệp…');
      await act(async () => { done((s: string, px: number) => [...s].length * px * 0.5); });
      expect(previewBtn()).toBeEnabled();
      expect(screen.queryByText('Đang chuẩn bị khung thiệp…')).toBeNull();
    } finally {
      gate.pending = null;
    }
  });

  it('quá 400 ký tự → báo giới hạn và khoá; so theo nội dung đã trim', async () => {
    const { rerender } = render(<Harness initial={{ ...newDraft('Lan'), content: 'a'.repeat(401) }} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Lời nhắn tối đa 400 ký tự');
    expect(previewBtn()).toBeDisabled();
    rerender(<Harness key="b" initial={{ ...newDraft('Lan'), content: `  ${'a'.repeat(400)}  ` }} />);
    await waitFor(() => expect(previewBtn()).toBeEnabled());
    expect(screen.queryByText('Lời nhắn tối đa 400 ký tự')).toBeNull();
  });

  it('khoá khi Để tên mà tên trống', async () => {
    render(<Harness initial={{ ...newDraft(''), content: 'Chúc' }} />);
    expect(previewBtn()).toBeDisabled();
  });

  it('Ẩn danh thì ẩn ô tên và không gửi authorName', async () => {
    const onSubmit = vi.fn();
    render(<Harness initial={{ ...newDraft('Lan'), content: 'Chúc' }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn danh' }));
    expect(screen.queryByRole('textbox', { name: 'Tên của bạn' })).not.toBeInTheDocument();
    await toPreview();
    await userEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledWith({ ornament: 'ball', anonymous: true, content: 'Chúc' }, '');
  });

  it('bộ đếm tính theo ký tự Unicode, ô lời nhắn không có maxlength', async () => {
    render(<Harness initial={{ ...newDraft('Lan'), content: '🎄ê' }} />);
    expect(screen.getByText('2/400')).toBeInTheDocument();
    expect(text()).not.toHaveAttribute('maxlength');
    await waitFor(() => expect(previewBtn()).toBeEnabled());
  });

  it('quá 400 ký tự (đếm sau trim): khoá Xem trước thiệp', () => {
    render(<Harness initial={{ ...newDraft('Lan'), content: 'a '.repeat(201) }} />);
    expect(screen.getByText('401/400')).toBeInTheDocument();
    expect(previewBtn()).toBeDisabled();
  });

  it('bộ đếm 0/400; tên giới hạn 30', () => {
    render(<Harness />);
    expect(screen.getByText('0/400')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tên của bạn' })).toHaveAttribute('maxlength', '30');
  });

  it("onSubmit nhận nội dung, tên đã trim và website ''", async () => {
    const onSubmit = vi.fn();
    render(<Harness initial={{ ...newDraft(' Lan '), content: '  Giáng sinh vui  ' }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Chuông' }));
    await toPreview();
    await userEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledWith({ ornament: 'bell', anonymous: false, authorName: 'Lan', content: 'Giáng sinh vui' }, '');
  });

  it('ô bẫy website có trong form, không lộ cho người dùng', () => {
    const { container } = render(<Harness />);
    const hp = container.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(hp).toHaveAttribute('tabindex', '-1');
    expect(hp).toHaveAttribute('aria-hidden', 'true');
  });

  it('busy → nút bị disabled; bấm 2 lần chỉ gọi onSubmit 1 lần', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<Compose mode="new" draft={{ ...newDraft('Lan'), content: 'x' }} onChange={() => {}} busy={false} onSubmit={onSubmit} onClose={() => {}} />);
    await toPreview();
    await userEvent.dblClick(submitBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(<Compose mode="new" draft={{ ...newDraft('Lan'), content: 'x' }} onChange={() => {}} busy onSubmit={onSubmit} onClose={() => {}} />);
    expect(submitBtn()).toBeDisabled();
  });

  it('chế độ sửa: tiêu đề kèm "còn 7 phút", nút Xoá hỏi lại bằng hộp xác nhận', async () => {
    const onDelete = vi.fn();
    render(<Harness mode="edit" editUntil={inMinutes(7)} onDelete={onDelete} initial={{ ...newDraft('Lan'), content: 'x' }} />);
    expect(screen.getByRole('dialog', { name: 'Sửa lời nhắn của bạn (còn 7 phút)' })).toBeInTheDocument();
    expect(screen.getByText('Còn 7 phút để sửa hoặc xoá lời nhắn này.')).toBeInTheDocument();
    expect(previewBtn()).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xoá lời nhắn' }));
    const ask = screen.getByRole('alertdialog', { name: 'Xoá lời nhắn này?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Không xoá' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xoá lời nhắn' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xoá' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('chế độ sửa: số phút tự đếm lùi; hết giờ thì khoá Lưu và Xoá', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Harness mode="edit" editUntil={inMinutes(2)} onDelete={() => {}} initial={{ ...newDraft('Lan'), content: 'x' }} />);
      expect(screen.getByRole('dialog', { name: 'Sửa lời nhắn của bạn (còn 2 phút)' })).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(61_000));
      expect(screen.getByRole('dialog', { name: 'Sửa lời nhắn của bạn (còn 1 phút)' })).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(screen.getByRole('dialog', { name: 'Sửa lời nhắn của bạn (đã hết giờ sửa)' })).toBeInTheDocument();
      expect(previewBtn()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Xoá lời nhắn' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('đang gửi: ô nhập bị khoá để chữ không đổi giữa chừng', () => {
    render(<Harness busy initial={{ ...newDraft('Lan'), content: 'x' }} />);
    expect(text()).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Tên của bạn' })).toBeDisabled();
  });

  it('đóng bảng khi đã viết chữ: hỏi "Huỷ lời nhắn đang viết?"; Viết tiếp thì giữ, Huỷ lời nhắn thì đóng', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.type(text(), 'Dở dang');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    const ask = screen.getByRole('alertdialog', { name: 'Huỷ lời nhắn đang viết?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Viết tiếp' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(text()).toHaveValue('Dở dang');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Huỷ lời nhắn' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape trong hộp xác nhận chỉ đóng hộp xác nhận', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.type(text(), 'Dở dang');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('chế độ sửa có thay đổi: hỏi "Bỏ thay đổi?"; không đổi gì thì đóng luôn', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<Harness mode="edit" editUntil={inMinutes(5)} onClose={onClose} initial={{ ...newDraft('Lan'), content: 'Cũ' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    render(<Harness mode="edit" editUntil={inMinutes(5)} onClose={onClose} initial={{ ...newDraft('Lan'), content: 'Cũ' }} />);
    await userEvent.type(text(), ' mới');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('alertdialog', { name: 'Bỏ thay đổi?' })).toBeInTheDocument();
  });

  it('chế độ mới: gợi ý về 24/12, không có nút Xoá', () => {
    render(<Harness />);
    expect(screen.getByText(/Chủ cây sẽ đọc được từ đêm 24\/12/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xoá lời nhắn' })).not.toBeInTheDocument();
  });

  it('error hiện trong bảng (role="alert")', async () => {
    render(<Harness error="Mỗi người chỉ treo được 3 lời nhắn trên một cây." />);
    await waitFor(() => expect(screen.queryByText('Đang chuẩn bị khung thiệp…')).toBeNull());
    expect(screen.getByRole('alert')).toHaveTextContent('Mỗi người chỉ treo được 3 lời nhắn');
  });

  it('Escape khi chưa viết gì gọi onClose ngay', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('quá 9 dòng: hiện cảnh báo và khoá Xem trước thiệp', async () => {
    const dai = Array.from({ length: 10 }, (_, i) => `dòng ${i}`).join('\n');
    render(<Harness initial={{ ...newDraft('Lan'), content: dai }} />);
    expect(await screen.findByText('Lời nhắn dài quá khung thiệp, bớt vài dòng nhé')).toBeInTheDocument();
    expect(previewBtn()).toBeDisabled();
    await userEvent.clear(text());
    await userEvent.type(text(), 'Ngắn');
    expect(screen.queryByText('Lời nhắn dài quá khung thiệp, bớt vài dòng nhé')).not.toBeInTheDocument();
    expect(previewBtn()).toBeEnabled();
  });

  it('Xem trước thiệp: thấy thiệp; Sửa lại giữ chữ; Treo lên cây gọi onSubmit', async () => {
    const onSubmit = vi.fn();
    render(<Harness initial={{ ...newDraft('Lan'), content: 'Chúc vui' }} onSubmit={onSubmit} />);
    await toPreview();
    expect(screen.getByTestId('thiep').textContent).toMatch(/^Chúc vui\|— Lan\|\d{4}-\d\d-\d\dT/);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: /Lời nhắn/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '‹ Sửa lại' }));
    expect(text()).toHaveValue('Chúc vui');
    await toPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Treo lên cây' }));
    expect(onSubmit).toHaveBeenCalledWith({ ornament: 'ball', anonymous: false, authorName: 'Lan', content: 'Chúc vui' }, '');
  });

  it('chế độ sửa cũng qua xem trước, nút Lưu thay đổi', async () => {
    const onSubmit = vi.fn();
    render(<Harness mode="edit" editUntil={inMinutes(7)} onSubmit={onSubmit} initial={{ ...newDraft('Lan'), content: 'Cũ' }} />);
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument();
    await toPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('đóng từ bước xem trước cũng hỏi xác nhận khi đã viết chữ', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} initial={{ ...newDraft('Lan'), content: 'Dở' }} />);
    await toPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('alertdialog', { name: 'Huỷ lời nhắn đang viết?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
  describe('ảnh kèm', () => {
    it('chọn ảnh quá 20 MB → "Ảnh lớn quá, chọn ảnh dưới 20 MB nhé"', async () => {
      preparePhoto.mockRejectedValueOnce(new PhotoError('too_big'));
      render(<Harness initial={{ ...newDraft('Lan'), content: 'x' }} />);
      await pick();
      expect(await screen.findByRole('alert')).toHaveTextContent('Ảnh lớn quá, chọn ảnh dưới 20 MB nhé');
      expect(screen.queryByRole('button', { name: 'Gỡ ảnh' })).not.toBeInTheDocument();
    });

    it('không đọc được → "Ảnh này chưa đọc được, chọn ảnh JPG hoặc PNG nhé"', async () => {
      preparePhoto.mockRejectedValueOnce(new PhotoError('unreadable'));
      render(<Harness initial={{ ...newDraft('Lan'), content: 'x' }} />);
      await pick();
      expect(await screen.findByRole('alert')).toHaveTextContent('Ảnh này chưa đọc được, chọn ảnh JPG hoặc PNG nhé');
    });

    it('có ảnh → ảnh nhỏ dưới ô lời nhắn; xem trước dùng mẫu có ảnh (CardCanvas nhận photo)', async () => {
      preparePhoto.mockResolvedValueOnce(fakePhoto());
      render(<Harness initial={{ ...newDraft('Lan'), content: 'x' }} />);
      await pick();
      expect(await screen.findByRole('img', { name: 'Ảnh đã chọn' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Gỡ ảnh' })).toBeInTheDocument();
      await toPreview();
      expect(screen.getByTestId('thiep')).toHaveAttribute('data-photo', 'p1');
    });

    it('Treo lên cây gửi photo base64', async () => {
      preparePhoto.mockResolvedValueOnce(fakePhoto());
      const onSubmit = vi.fn();
      render(<Harness initial={{ ...newDraft('Lan'), content: 'Chúc' }} onSubmit={onSubmit} />);
      await pick();
      await screen.findByRole('button', { name: 'Gỡ ảnh' });
      await toPreview();
      await userEvent.click(submitBtn());
      expect(onSubmit).toHaveBeenCalledWith({ ornament: 'ball', anonymous: false, authorName: 'Lan', content: 'Chúc', photo: 'b64-p1' }, '');
    });

    it('đổi ảnh thì đóng ảnh cũ; gỡ ảnh trong bảng mới thì không gửi trường photo', async () => {
      const a = fakePhoto('a');
      preparePhoto.mockResolvedValueOnce(a).mockResolvedValueOnce(fakePhoto('b'));
      const onSubmit = vi.fn();
      render(<Harness initial={{ ...newDraft('Lan'), content: 'Chúc' }} onSubmit={onSubmit} />);
      await pick();
      await screen.findByRole('button', { name: 'Gỡ ảnh' });
      await pick();
      await vi.waitFor(() => expect(a.bitmap.close).toHaveBeenCalled());
      await userEvent.click(screen.getByRole('button', { name: 'Gỡ ảnh' }));
      expect(screen.queryByRole('img', { name: 'Ảnh đã chọn' })).not.toBeInTheDocument();
      await toPreview();
      expect(screen.getByTestId('thiep')).toHaveAttribute('data-photo', '');
      await userEvent.click(submitBtn());
      expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('photo');
    });

    it('gỡ ảnh khi sửa → gửi photo: null; không đổi ảnh → không có trường photo', async () => {
      const onSubmit = vi.fn();
      const withPhoto = { ...newDraft('Lan'), content: 'Cũ', photo: fakePhoto('old') };
      const { unmount } = render(<Harness mode="edit" editUntil={inMinutes(7)} onSubmit={onSubmit} initial={withPhoto} />);
      await toPreview();
      expect(screen.getByTestId('thiep')).toHaveAttribute('data-photo', 'old');
      await userEvent.click(submitBtn());
      expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('photo');
      unmount();
      onSubmit.mockClear();
      render(<Harness mode="edit" editUntil={inMinutes(7)} onSubmit={onSubmit} initial={withPhoto} />);
      await userEvent.click(screen.getByRole('button', { name: 'Gỡ ảnh' }));
      await toPreview();
      await userEvent.click(submitBtn());
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ photo: null });
    });

    it('sửa: gỡ ảnh là thay đổi → đóng bảng hỏi lại', async () => {
      const onClose = vi.fn();
      render(<Harness mode="edit" editUntil={inMinutes(7)} onClose={onClose} initial={{ ...newDraft('Lan'), content: 'Cũ', photo: fakePhoto() }} />);
      await userEvent.click(screen.getByRole('button', { name: 'Gỡ ảnh' }));
      await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
      expect(screen.getByRole('alertdialog', { name: 'Bỏ thay đổi?' })).toBeInTheDocument();
    });

    it('đang gửi có ảnh → "Đang gửi…"', () => {
      const props = { mode: 'new' as const, onChange: () => {}, busy: true, onSubmit: () => {}, onClose: () => {} };
      const { rerender } = render(<Compose {...props} draft={{ ...newDraft('Lan'), content: 'x' }} />);
      expect(screen.queryByText('Đang gửi…')).not.toBeInTheDocument();
      rerender(<Compose {...props} draft={{ ...newDraft('Lan'), content: 'x', photo: fakePhoto(), photoChanged: true }} />);
      expect(screen.getByRole('status')).toHaveTextContent('Đang gửi…');
    });
  });
});
