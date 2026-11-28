import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type AppConfig } from './api';
import { resetConfigForTest, useConfig } from './config';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, api: { getConfig: vi.fn() } };
});
const mocked = vi.mocked(api);

const MS = {
  unlockAt: '2026-12-23T17:00:00.000Z',
  writeClosesAt: '2026-12-25T17:00:00.000Z',
  serviceEndsAt: '2026-12-31T17:00:00.000Z',
};
const cfg = (now: string, phase: string) => ({ now, phase, ...MS, purgeAt: '2027-01-06T17:00:00.000Z' }) as AppConfig;

function Phase() {
  return <p>phase:{useConfig()?.phase ?? 'null'}</p>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  resetConfigForTest();
});
afterEach(() => vi.useRealTimers());

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe('useConfig tải lại theo mốc giờ (tab mở qua 0h 26/12)', () => {
  it('tới mốc kế tiếp thì tải lại và đổi giai đoạn', async () => {
    mocked.getConfig
      .mockResolvedValueOnce(cfg('2026-12-25T16:59:55.000Z', 'OPEN'))
      .mockResolvedValueOnce(cfg('2026-12-25T17:00:01.000Z', 'NOTICE'));
    render(<Phase />);
    await flush();
    expect(screen.getByText('phase:OPEN')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(7_000); });
    expect(mocked.getConfig).toHaveBeenCalledTimes(2);
    expect(screen.getByText('phase:NOTICE')).toBeInTheDocument();
  });

  it('mốc còn xa (> 1 ngày): không tải lại ngay, tải lại sau 1 ngày', async () => {
    mocked.getConfig.mockResolvedValue(cfg('2026-12-01T03:00:00.000Z', 'BUILD'));
    render(<Phase />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocked.getConfig).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(24 * 3_600_000); });
    expect(mocked.getConfig).toHaveBeenCalledTimes(2);
  });

  it('quay lại tab (visibilitychange) thì tải lại', async () => {
    mocked.getConfig
      .mockResolvedValueOnce(cfg('2026-12-20T03:00:00.000Z', 'BUILD'))
      .mockResolvedValueOnce(cfg('2026-12-27T03:00:00.000Z', 'NOTICE'));
    render(<Phase />);
    await flush();
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('phase:NOTICE')).toBeInTheDocument();
  });

  it('tải lại lỗi: giữ cấu hình cũ', async () => {
    mocked.getConfig
      .mockResolvedValueOnce(cfg('2026-12-25T16:59:55.000Z', 'OPEN'))
      .mockRejectedValueOnce(new Error('mạng'));
    render(<Phase />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(7_000); });
    expect(screen.getByText('phase:OPEN')).toBeInTheDocument();
  });
});
