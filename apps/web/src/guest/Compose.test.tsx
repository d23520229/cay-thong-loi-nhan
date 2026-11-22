import { useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { serverNow } from '../lib/clock';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../card/measure', () => ({ cardMeasure: async () => (s: string, px: number) => [...s].length * px * 0.5 }));
vi.mock('../card/CardCanvas', () => ({ CardCanvas: ({ data }: { data: { content: string; sign: string; sentAt: string } }) => <div data-testid="thiep">{data.content}|{data.sign}|{data.sentAt}</div> }));
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

describe('Compose', () => {
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

  it('bộ đếm tính theo ký tự Unicode, ô lời nhắn không có maxlength', () => {
    render(<Harness initial={{ ...newDraft('Lan'), content: '🎄ê' }} />);
    expect(screen.getByText('2/400')).toBeInTheDocument();
    expect(text()).not.toHaveAttribute('maxlength');
    expect(previewBtn()).toBeEnabled();
  });

  it('quá 400 ký tự: khoá Xem trước thiệp', () => {
    render(<Harness initial={{ ...newDraft('Lan'), content: 'a '.repeat(201) }} />);
    expect(screen.getByText('402/400')).toBeInTheDocument();
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

  it('error hiện trong bảng (role="alert")', () => {
    render(<Harness error="Mỗi người chỉ treo được 3 lời nhắn trên một cây." />);
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
});
