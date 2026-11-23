import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from './adminApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('adminApi', () => {
  it('lệnh ghi gửi x-csrf-token lấy từ me()', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(200, { email: 'a@b.vn', csrfToken: 'c1' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await adminApi.me();
    await adminApi.unlockPin('abcdefgh');
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe('/api/admin/trees/abcdefgh/unlock-pin');
    expect(init.headers['x-csrf-token']).toBe('c1');
  });

  it('403 csrf → lấy lại token bằng me() rồi thử lại đúng một lần', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(403, { error: { code: 'csrf', message: 'x' } }))
      .mockResolvedValueOnce(json(200, { email: 'a@b.vn', csrfToken: 'c2' }))
      .mockResolvedValueOnce(json(200, { revoked: 2 }));
    vi.stubGlobal('fetch', fetch);
    expect(await adminApi.revokeSessions('abcdefgh')).toEqual({ revoked: 2 });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2]![1].headers['x-csrf-token']).toBe('c2');
  });

  it('403 csrf lần hai thì ném lỗi, không lặp', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(403, { error: { code: 'csrf', message: 'x' } }))
      .mockResolvedValueOnce(json(200, { email: 'a@b.vn', csrfToken: 'c3' }))
      .mockResolvedValueOnce(json(403, { error: { code: 'csrf', message: 'x' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(adminApi.revokeSessions('abcdefgh')).rejects.toMatchObject({ code: 'csrf' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
