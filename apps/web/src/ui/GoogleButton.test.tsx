import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { resetConfigForTest } from '../lib/config';
import { googleName } from '../lib/gis';
import { GoogleButton } from './GoogleButton';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return { ...actual, api: { getConfig: vi.fn() } };
});

const mocked = vi.mocked(api);
const config = (googleClientId: string | null) =>
  ({ googleClientId, supportEmail: null }) as Awaited<ReturnType<typeof api.getConfig>>;

beforeEach(() => {
  vi.resetAllMocks();
  resetConfigForTest();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GoogleButton', () => {
  it('không có googleClientId → nút khoá, báo chưa dùng được', async () => {
    mocked.getConfig.mockResolvedValue(config(null));
    render(<GoogleButton onToken={() => {}} />);
    const b = await screen.findByRole('button', { name: 'Đăng nhập Google tạm thời chưa dùng được' });
    expect(b).toBeDisabled();
  });

  it('có googleClientId → khởi tạo Google Identity với đúng client_id, callback trả idToken', async () => {
    mocked.getConfig.mockResolvedValue(config('cid.apps.googleusercontent.com'));
    let cb: ((r: { credential: string }) => void) | undefined;
    const initialize = vi.fn((o: { client_id: string; callback: (r: { credential: string }) => void }) => { cb = o.callback; });
    const renderButton = vi.fn();
    vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } });
    const onToken = vi.fn();
    render(<GoogleButton onToken={onToken} />);
    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(initialize.mock.calls[0]![0].client_id).toBe('cid.apps.googleusercontent.com');
    cb!({ credential: 'tok' });
    expect(onToken).toHaveBeenCalledWith('tok');
  });
});

describe('googleName', () => {
  it('đọc tên trong phần payload của idToken, token hỏng → null', () => {
    const payload = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ name: 'Lan Anh' }))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(googleName(`h.${payload}.s`)).toBe('Lan Anh');
    expect(googleName('hỏng')).toBeNull();
  });
});
