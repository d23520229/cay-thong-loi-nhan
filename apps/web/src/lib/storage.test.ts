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

  it('deviceId: không có crypto.randomUUID (trang http trong mạng LAN) → UUID v4 từ getRandomValues', async () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect('randomUUID' in globalThis.crypto).toBe(false);
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = (await load()).deviceId();
    expect(a).toMatch(v4);
    expect(localStorage.getItem('deviceId')).toBe(a);
    localStorage.clear();
    const b = (await load()).deviceId();
    expect(b).toMatch(v4);
    expect(b).not.toBe(a);
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

describe('storage lời nhắn', () => {
  const e = { messageId: '5', editToken: 't', editUntil: '2026-12-01T00:15:00Z' };
  it('msg: lưu/đọc/xoá theo cây và điểm', async () => {
    const s = await load();
    s.setMine('aaaaaaaa', 2, e);
    expect(localStorage.getItem('msg:aaaaaaaa:2')).not.toBeNull();
    expect(s.getMine('aaaaaaaa', 2)).toEqual(e);
    s.clearMine('aaaaaaaa', 2);
    expect(s.getMine('aaaaaaaa', 2)).toBeNull();
  });
  it('listMine chỉ trả khoá của đúng cây', async () => {
    const s = await load();
    s.setMine('aaaaaaaa', 1, e);
    s.setMine('bbbbbbbb', 2, e);
    expect(s.listMine('aaaaaaaa')).toEqual({ 1: e });
  });
  it('getMine trả null khi JSON hỏng hoặc thiếu trường', async () => {
    const s = await load();
    localStorage.setItem('msg:aaaaaaaa:0', '{x');
    localStorage.setItem('msg:aaaaaaaa:1', '{"messageId":"1"}');
    expect(s.getMine('aaaaaaaa', 0)).toBeNull();
    expect(s.getMine('aaaaaaaa', 1)).toBeNull();
    expect(s.listMine('aaaaaaaa')).toEqual({});
  });
  it('lastName mặc định chuỗi rỗng', async () => {
    const s = await load();
    expect(s.getLastName()).toBe('');
    s.setLastName('Lan');
    expect(s.getLastName()).toBe('Lan');
  });
});
