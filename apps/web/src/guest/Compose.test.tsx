import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Compose, newDraft, type ComposeDraft } from './Compose';

type Extra = Partial<Parameters<typeof Compose>[0]>;
function Harness({ initial = newDraft('Lan'), ...rest }: Extra & { initial?: ComposeDraft }) {
  const [draft, setDraft] = useState(initial);
  return <Compose mode="new" draft={draft} onChange={setDraft} busy={false} onSubmit={() => {}} onClose={() => {}} {...rest} />;
}
const submitBtn = () => screen.getByRole('button', { name: /Treo lên cây|Lưu thay đổi/ });
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
    expect(submitBtn()).toBeDisabled();
    await userEvent.type(text(), '   ');
    expect(submitBtn()).toBeDisabled();
    await userEvent.type(text(), 'Chúc');
    expect(submitBtn()).toBeEnabled();
  });

  it('khoá khi Để tên mà tên trống', async () => {
    render(<Harness initial={{ ...newDraft(''), content: 'Chúc' }} />);
    expect(submitBtn()).toBeDisabled();
  });

  it('Ẩn danh thì ẩn ô tên và không gửi authorName', async () => {
    const onSubmit = vi.fn();
    render(<Harness initial={{ ...newDraft('Lan'), content: 'Chúc' }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ẩn danh' }));
    expect(screen.queryByRole('textbox', { name: 'Tên của bạn' })).not.toBeInTheDocument();
    await userEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledWith({ ornament: 'ball', anonymous: true, content: 'Chúc' }, '');
  });

  it('bộ đếm 0/300; ô lời nhắn giới hạn 300', () => {
    render(<Harness />);
    expect(screen.getByText('0/300')).toBeInTheDocument();
    expect(text()).toHaveAttribute('maxlength', '300');
    expect(screen.getByRole('textbox', { name: 'Tên của bạn' })).toHaveAttribute('maxlength', '30');
  });

  it("onSubmit nhận nội dung, tên đã trim và website ''", async () => {
    const onSubmit = vi.fn();
    render(<Harness initial={{ ...newDraft(' Lan '), content: '  Giáng sinh vui  ' }} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Chuông' }));
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
    await userEvent.dblClick(submitBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(<Compose mode="new" draft={{ ...newDraft('Lan'), content: 'x' }} onChange={() => {}} busy onSubmit={onSubmit} onClose={() => {}} />);
    expect(submitBtn()).toBeDisabled();
  });

  it('chế độ sửa: tiêu đề, "Còn 7 phút", nút Xoá hỏi confirm', async () => {
    const onDelete = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<Harness mode="edit" minutesLeft={7} onDelete={onDelete} initial={{ ...newDraft('Lan'), content: 'x' }} />);
    expect(screen.getByRole('dialog', { name: 'Sửa lời nhắn của bạn' })).toBeInTheDocument();
    expect(screen.getByText('Còn 7 phút để sửa hoặc xoá lời nhắn này.')).toBeInTheDocument();
    expect(submitBtn()).toHaveTextContent('Lưu thay đổi');
    await userEvent.click(screen.getByRole('button', { name: 'Xoá lời nhắn' }));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Xoá lời nhắn' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('Xoá lời nhắn này?');
    confirm.mockRestore();
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

  it('Escape gọi onClose', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
