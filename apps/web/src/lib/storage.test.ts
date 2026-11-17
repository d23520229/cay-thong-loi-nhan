import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@ctln/shared';

const room = { background: 'night', tree: { shape: 'cloud3', palette: 'teal', trunkShape: 'straight', wood: 'oak', slotCount: 12 }, items: [] } as Room;

async function load() {
  vi.resetModules();
  return (await import('./storage')).storage;
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('storage', () => {
  it('addMyTree cùng id hai lần → 1 phần tử, mới nhất đứng đầu', async () => {
    const s = await load();
    s.addMyTree({ id: 'a', title: 'A', createdAt: '1' });
    s.addMyTree({ id: 'b', title: null, createdAt: '2' });
    s.addMyTree({ id: 'a', title: 'A2', createdAt: '3' });
    expect(s.myTrees()).toEqual([{ id: 'a', title: 'A2', createdAt: '3' }, { id: 'b', title: null, createdAt: '2' }]);
    s.removeMyTree('a');
    expect(s.myTrees().map((t) => t.id)).toEqual(['b']);
  });

  it('deviceId ổn định', async () => {
    const s = await load();
    expect(s.deviceId()).toBe(s.deviceId());
    expect(s.deviceId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('draft và ref khứ hồi; dữ liệu hỏng → null', async () => {
    const s = await load();
    const d = { room, baseVersion: 2, savedAt: 'x' };
    s.setDraft('new', d);
    expect(s.getDraft('new')).toEqual(d);
    s.clearDraft('new');
    expect(s.getDraft('new')).toBeNull();
    localStorage.setItem('draft:x', '{bad');
    expect(s.getDraft('x')).toBeNull();
    expect(s.getRef()).toBeNull();
    s.setRef('abc');
    expect(s.getRef()).toBe('abc');
  });

  it('storage ném lỗi: không ném, myTrees rỗng, deviceId vẫn là UUID ổn định', async () => {
    const boom = new Proxy({}, { get: () => () => { throw new Error('blocked'); } });
    vi.stubGlobal('localStorage', boom);
    vi.stubGlobal('sessionStorage', boom);
    const s = await load();
    expect(s.myTrees()).toEqual([]);
    expect(() => s.addMyTree({ id: 'a', title: null, createdAt: '1' })).not.toThrow();
    expect(() => s.setDraft('new', { room, baseVersion: null, savedAt: 'x' })).not.toThrow();
    expect(() => s.clearDraft('new')).not.toThrow();
    expect(s.getDraft('new')).toBeNull();
    expect(() => s.setRef('a')).not.toThrow();
    expect(s.getRef()).toBeNull();
    const id = s.deviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.deviceId()).toBe(id);
  });
});
