import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const order: string[] = [];
vi.mock('./draw', () => ({
  ensureCardFonts: vi.fn(async () => { order.push('fonts'); }),
  loadCardAssets: vi.fn(async () => { order.push('assets'); return {}; }),
  drawCard: vi.fn(() => { order.push('draw'); }),
}));
import { CardCanvas } from './CardCanvas';

const data = { content: 'Chúc mừng', sign: '— An', sentAt: '2026-12-24T13:05:00Z' };

describe('CardCanvas', () => {
  beforeEach(() => {
    order.length = 0;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as never;
    // jsdom không có bố cục: clientWidth luôn 0, cần giả một bề rộng để canvas vẽ.
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, value: 300 });
  });

  it('chờ ensureCardFonts trước khi drawCard', async () => {
    render(<CardCanvas data={data} />);
    await waitFor(() => expect(order).toContain('draw'));
    expect(order.indexOf('fonts')).toBeLessThan(order.indexOf('draw'));
  });

  it('aria-label chứa nội dung và ký tên', () => {
    render(<CardCanvas data={data} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Chúc mừng — An');
  });

  it('chạm gọi onTap', async () => {
    const onTap = vi.fn();
    render(<CardCanvas data={data} onTap={onTap} />);
    await userEvent.click(screen.getByRole('img'));
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('không lỗi khi getContext trả null', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    expect(() => render(<CardCanvas data={data} />)).not.toThrow();
  });
});
