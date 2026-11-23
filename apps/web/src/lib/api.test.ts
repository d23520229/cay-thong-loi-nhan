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

describe('api lời nhắn', () => {
  it('getMine gửi x-edit-token và x-device-id', async () => {
    fetchMock().mockResolvedValue(json(200, { messageId: '12' }));
    await api.getMine('12', 'tok');
    const [url, init] = fetchMock().mock.calls[0]!;
    expect(url).toBe('/api/messages/12/mine');
    expect(init?.method).toBe('GET');
    const h = new Headers(init?.headers);
    expect(h.get('x-edit-token')).toBe('tok');
    expect(h.get('x-device-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('postMessage gửi đúng body', async () => {
    fetchMock().mockResolvedValue(json(201, { messageId: '1', editToken: 't', editUntil: 'u' }));
    const body = { slotIndex: 3, ornament: 'ball', anonymous: true, content: 'Chúc', website: '' };
    await expect(api.postMessage('abcdefgh', body)).resolves.toEqual({ messageId: '1', editToken: 't', editUntil: 'u' });
    const [url, init] = fetchMock().mock.calls[0]!;
    expect(url).toBe('/api/trees/abcdefgh/messages');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(body);
  });

  it('editMessage PUT và deleteMessage DELETE kèm token', async () => {
    fetchMock().mockResolvedValueOnce(json(200, { ok: true })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.editMessage('7', 'tk', { ornament: 'bell', anonymous: false, authorName: 'An', content: 'Hi' });
    await expect(api.deleteMessage('7', 'tk')).resolves.toBeUndefined();
    const [u1, i1] = fetchMock().mock.calls[0]!;
    const [u2, i2] = fetchMock().mock.calls[1]!;
    expect([u1, i1?.method, u2, i2?.method]).toEqual(['/api/messages/7', 'PUT', '/api/messages/7', 'DELETE']);
    expect(new Headers(i2?.headers).get('x-edit-token')).toBe('tk');
  });
});

describe('api ảnh', () => {
  it('getMyPhoto gửi x-edit-token, 404 → null', async () => {
    fetchMock()
      .mockResolvedValueOnce(new Response(new Blob(['w'], { type: 'image/webp' }), { status: 200 }))
      .mockResolvedValueOnce(json(404, { error: { code: 'not_found', message: 'x' } }));
    const b = await api.getMyPhoto('7', 'tk');
    expect(b).toBeInstanceOf(Blob);
    const [url, init] = fetchMock().mock.calls[0]!;
    expect([url, init?.method]).toEqual(['/api/messages/7/photo', 'GET']);
    expect(new Headers(init?.headers).get('x-edit-token')).toBe('tk');
    await expect(api.getMyPhoto('7', 'tk')).resolves.toBeNull();
  });

  it('getOwnerPhoto trả Blob; lỗi khác 404 vẫn ném', async () => {
    fetchMock()
      .mockResolvedValueOnce(new Response(new Blob(['w'], { type: 'image/webp' }), { status: 200 }))
      .mockResolvedValueOnce(json(423, { error: { code: 'locked', message: 'x' } }));
    const b = await api.getOwnerPhoto('abcdefgh', '5');
    expect(b).toBeInstanceOf(Blob);
    expect(fetchMock().mock.calls[0]![0]).toBe('/api/trees/abcdefgh/messages/5/photo');
    await expect(api.getOwnerPhoto('abcdefgh', '5')).rejects.toMatchObject({ status: 423 });
  });

  it('editMessage gửi photo: null khi gỡ ảnh', async () => {
    fetchMock().mockResolvedValue(json(200, { ok: true }));
    await api.editMessage('7', 'tk', { ornament: 'bell', anonymous: true, content: 'Hi', photo: null });
    expect(JSON.parse(fetchMock().mock.calls[0]![1]?.body as string)).toMatchObject({ photo: null });
  });
});

describe('api chủ cây', () => {
  const call = (i = 0) => fetchMock().mock.calls[i]!;
  it('openMessage POST đúng đường dẫn', async () => {
    fetchMock().mockResolvedValue(json(200, { messageId: '5', content: 'x' }));
    await api.openMessage('abcdefgh', '5');
    expect([call()[0], call()[1]?.method]).toEqual(['/api/trees/abcdefgh/messages/5/open', 'POST']);
  });
  it('ownerDeleteMessage, blockSender, report, setShowCount, deleteTree', async () => {
    fetchMock()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(201, { reportId: '1' }))
      .mockResolvedValueOnce(json(200, { showMessageCount: false }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.ownerDeleteMessage('abcdefgh', '5');
    await api.blockSender('abcdefgh', '5');
    await expect(api.report('abcdefgh', { messageId: '5', reason: 'r' })).resolves.toEqual({ reportId: '1' });
    await expect(api.setShowCount('abcdefgh', false)).resolves.toEqual({ showMessageCount: false });
    await api.deleteTree('abcdefgh');
    const got = fetchMock().mock.calls.map(([u, i]) => [u, i?.method, i?.body ? JSON.parse(i.body as string) : null]);
    expect(got).toEqual([
      ['/api/trees/abcdefgh/messages/5', 'DELETE', null],
      ['/api/trees/abcdefgh/block', 'POST', { messageId: '5' }],
      ['/api/trees/abcdefgh/reports', 'POST', { messageId: '5', reason: 'r' }],
      ['/api/trees/abcdefgh/settings', 'PUT', { showMessageCount: false }],
      ['/api/trees/abcdefgh', 'DELETE', null],
    ]);
  });
});
