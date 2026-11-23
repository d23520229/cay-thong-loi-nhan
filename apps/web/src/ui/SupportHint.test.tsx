import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { resetConfigForTest } from '../lib/config';
import { SupportHint } from './SupportHint';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return { ...actual, api: { getConfig: vi.fn() } };
});
const mocked = vi.mocked(api);
const cfg = (supportEmail: string | null) => ({ googleClientId: null, supportEmail }) as Awaited<ReturnType<typeof api.getConfig>>;

beforeEach(() => {
  vi.resetAllMocks();
  resetConfigForTest();
});

describe('SupportHint', () => {
  it('có email → câu nhắc kèm mailto, không nhắc PIN hay link riêng', async () => {
    mocked.getConfig.mockResolvedValue(cfg('hotro@vidu.vn'));
    render(<SupportHint />);
    const link = await screen.findByRole('link', { name: 'hotro@vidu.vn' });
    expect(link).toHaveAttribute('href', 'mailto:hotro@vidu.vn');
    expect(screen.queryByText(/PIN|link riêng/)).not.toBeInTheDocument();
  });

  it('không có email → không hiện gì', async () => {
    mocked.getConfig.mockResolvedValue(cfg(null));
    const { container } = render(<SupportHint />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container).toBeEmptyDOMElement();
  });
});
