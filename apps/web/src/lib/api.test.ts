import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@ctln/shared';
import { api, ApiError, type OwnerRoom } from './api';

const room = { background: 'night', tree: { shape: 'cloud3', palette: 'teal', trunkShape: 'straight', wood: 'oak', slotCount: 12 }, items: [] } as Room;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());
const fetchMock = () => vi.mocked(fetch);

describe('api', () => {
  it('409 version_conflict → ApiError có status, code, extra.room', async () => {
    fetchMock().mockResolvedValue(json(409, { error: { code: 'version_conflict', message: 'x', room: { id: 'r' } } }));
    const e = await api.saveRoom('abcdefgh', 3, room).catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(409);
    expect(e.code).toBe('version_conflict');
    expect(e.extra.room).toEqual({ id: 'r' });
  });

  it('fetch ném lỗi → ApiError status 0 code network', async () => {
    fetchMock().mockRejectedValue(new TypeError('fail'));
    const e = await api.getConfig().catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(0);
    expect(e.code).toBe('network');
  });

  it('saveRoom gửi PUT đúng đường dẫn và body, kèm header', async () => {
    fetchMock().mockResolvedValue(json(200, { roomVersion: 4 }));
    await expect(api.saveRoom('abcdefgh', 3, room)).resolves.toEqual({ roomVersion: 4 });
    const [url, init] = fetchMock().mock.calls[0]!;
    expect(url).toBe('/api/trees/abcdefgh/room');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ roomVersion: 3, room });
    expect(init?.credentials).toBe('same-origin');
    const h = new Headers(init?.headers);
    expect(h.get('content-type')).toBe('application/json');
    expect(h.get('x-device-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('saveRoom với { keepalive: true } truyền keepalive cho fetch; không truyền thì không có', async () => {
    fetchMock().mockImplementation(async () => json(200, { roomVersion: 4 }));
    await api.saveRoom('abcdefgh', 3, room, { keepalive: true });
    expect(fetchMock().mock.calls[0]![1]?.keepalive).toBe(true);
    await api.saveRoom('abcdefgh', 3, room);
    expect(fetchMock().mock.calls[1]![1]?.keepalive).toBeUndefined();
  });

  it('GET không có content-type nhưng có x-device-id; 204 trả undefined', async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.logout('abcdefgh')).resolves.toBeUndefined();
    fetchMock().mockResolvedValue(json(200, {}));
    await api.getTree('abcdefgh');
    const h = new Headers(fetchMock().mock.calls[1]![1]?.headers);
    expect(h.get('content-type')).toBeNull();
    expect(h.get('x-device-id')).toBeTruthy();
  });

  it('ownerVisit gửi POST /api/trees/{id}/owner/visit không body', async () => {
    fetchMock().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.ownerVisit('abcdefgh')).resolves.toBeUndefined();
    const [url, init] = fetchMock().mock.calls[0]!;
    expect(String(url)).toBe('/api/trees/abcdefgh/owner/visit');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('lỗi không phải JSON vẫn thành ApiError', async () => {
    fetchMock().mockResolvedValue(new Response('<html>', { status: 502 }));
    const e = await api.getConfig().catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
  });
});

describe('OwnerRoom', () => {
  it('slots có messageId, unread, locked (ghim bằng typecheck)', async () => {
    const owner: OwnerRoom = {
      id: 'abcdefgh', ownerName: 'A', title: null, background: 'night', tree: room.tree, items: [], roomVersion: 1, phase: 'BUILD',
      slots: [{ index: 0, occupied: true, ornament: 'star', messageId: '7', unread: true, locked: true }, { index: 1, occupied: false, locked: true }],
      messageCount: 1, newSinceLastVisit: 1, showMessageCount: true,
    };
    fetchMock().mockResolvedValue(json(200, owner));
    const got = await api.getOwnerTree('abcdefgh');
    expect(got.slots[0]!.messageId).toBe('7');
    expect(got.slots[1]!.locked).toBe(true);
  });
});
