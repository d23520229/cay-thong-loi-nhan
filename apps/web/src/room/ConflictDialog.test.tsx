import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConflictDialog } from './ConflictDialog';

describe('ConflictDialog', () => {
  it('hiện câu hỏi và hai nút gọi đúng hàm', () => {
    const onKeepMine = vi.fn();
    const onUseLatest = vi.fn();
    render(<ConflictDialog onKeepMine={onKeepMine} onUseLatest={onUseLatest} />);
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Có thay đổi chưa lưu trên máy này, nhưng phòng đã được sửa ở thiết bị khác',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Giữ bản trên máy này' }));
    expect(onKeepMine).toHaveBeenCalledTimes(1);
    expect(onUseLatest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dùng bản mới nhất' }));
    expect(onUseLatest).toHaveBeenCalledTimes(1);
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });
});
