import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultRoom } from '../room/model';
import { slotRects } from './geometry';
import { SlotsLayer } from './SlotsLayer';
import type { SlotView } from './slots';

const rects = slotRects(defaultRoom());
const mine = { messageId: '1', editToken: 't', editUntil: '2099-01-01T00:00:00Z' };
const views: SlotView[] = rects.map((r) =>
  r.index === 1 ? { index: 1, kind: 'taken', ornament: 'bell' }
    : r.index === 2 ? { index: 2, kind: 'mine', ornament: 'ball', mine }
      : { index: r.index, kind: 'empty' },
);

describe('SlotsLayer', () => {
  it('12 nút với đúng nhãn cho trống / đã treo / của bạn', () => {
    render(<SlotsLayer rects={rects} views={views} fx={{}} onTap={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(screen.getAllByRole('button', { name: 'Điểm trống, chạm để treo lời nhắn' })).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Chuông đã treo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lời nhắn của bạn: Quả châu' })).toHaveClass('is-mine');
  });

  it('bấm nút gọi onTap(index)', async () => {
    const onTap = vi.fn();
    render(<SlotsLayer rects={rects} views={views} fx={{}} onTap={onTap} />);
    await userEvent.click(screen.getByRole('button', { name: 'Chuông đã treo' }));
    expect(onTap).toHaveBeenCalledWith(1);
  });

  it('fx gắn class gs-ring / gs-drop', () => {
    render(<SlotsLayer rects={rects} views={views} fx={{ 1: 'ring', 2: 'drop-in' }} onTap={() => {}} />);
    expect(screen.getByRole('button', { name: 'Chuông đã treo' })).toHaveClass('gs-ring');
    expect(screen.getByRole('button', { name: /Lời nhắn của bạn/ })).toHaveClass('gs-drop');
  });

  it('states: vẽ trạng thái quà của chủ cây với nhãn riêng', () => {
    const owned: SlotView[] = rects.map((r) => ({ index: r.index, kind: r.index < 3 ? 'taken' : 'empty', ornament: 'bell' }));
    const { container } = render(<SlotsLayer rects={rects} views={owned} fx={{}} onTap={() => {}} hideEmpty states={{ 0: 'locked', 1: 'unread', 2: 'read' }} />);
    // Quà còn gói vẽ như phụ kiện bình thường: không nhạt màu, không nơ (chủ dự án chốt 23/11).
    const locked = screen.getByRole('button', { name: 'Quà còn gói' });
    expect(locked.querySelector('.st-filled')).not.toBeNull();
    expect(locked.querySelector('.st-locked, .lock-bow')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lời nhắn chưa đọc: Chuông' }).querySelector('.st-unread')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Lời nhắn đã đọc: Chuông' }).querySelector('.st-read')).not.toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(3);
  });

  it('hideEmpty ẩn bong bóng trống', () => {
    render(<SlotsLayer rects={rects} views={views} fx={{}} onTap={() => {}} hideEmpty />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
