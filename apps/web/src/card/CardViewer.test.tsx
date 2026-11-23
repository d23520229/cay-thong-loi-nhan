import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./CardCanvas', () => ({ CardCanvas: ({ onTap }: { onTap?: () => void }) => <div data-testid="canvas" onClick={onTap} /> }));
import { CardViewer } from './CardViewer';

const data = { content: 'Chúc mừng', sign: '— An', sentAt: '2026-12-24T13:05:00Z' };
const mockPortrait = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as never;
};

describe('CardViewer', () => {
  it('Escape gọi onClose', async () => {
    mockPortrait(false);
    const onClose = vi.fn();
    render(<CardViewer data={data} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('nút ✕ gọi onClose', async () => {
    mockPortrait(false);
    const onClose = vi.fn();
    render(<CardViewer data={data} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('chạm vào thiệp chỉ gọi onClose một lần', async () => {
    mockPortrait(false);
    const onClose = vi.fn();
    render(<CardViewer data={data} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('canvas'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('màn dọc có lớp xoay cd-rotated', () => {
    mockPortrait(true);
    render(<CardViewer data={data} onClose={() => {}} />);
    expect(document.querySelector('.cd-rotated')).not.toBeNull();
  });

  it('màn ngang không xoay', () => {
    mockPortrait(false);
    render(<CardViewer data={data} onClose={() => {}} />);
    expect(document.querySelector('.cd-rotated')).toBeNull();
  });
});
