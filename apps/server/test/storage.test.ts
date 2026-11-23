import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fsStore } from '../src/storage/fs.js';
import { memoryStore } from '../src/storage/memory.js';

const dir = mkdtempSync(join(tmpdir(), 'ctln-photos-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe.each([
  ['memoryStore', () => memoryStore()],
  ['fsStore', () => fsStore(join(dir, String(Math.random())))],
])('%s', (_name, make) => {
  it('put rồi get ra đúng nội dung (khoá có dấu /)', async () => {
    const s = make();
    await s.put('m/t1/1-abc.webp', Buffer.from('xin chao'));
    expect((await s.get('m/t1/1-abc.webp'))?.toString()).toBe('xin chao');
  });
  it('get khoá không có → null', async () => {
    expect(await make().get('m/none.webp')).toBeNull();
  });
  it('delete hai lần không lỗi', async () => {
    const s = make();
    await s.put('r/a.webp', Buffer.from('x'));
    await s.delete('r/a.webp');
    await s.delete('r/a.webp');
    expect(await s.get('r/a.webp')).toBeNull();
  });
  it('copy giữ bản gốc', async () => {
    const s = make();
    await s.put('m/a.webp', Buffer.from('abc'));
    await s.copy('m/a.webp', 'r/b.webp');
    expect((await s.get('r/b.webp'))?.toString()).toBe('abc');
    expect((await s.get('m/a.webp'))?.toString()).toBe('abc');
  });
});

describe('fsStore an toàn đường dẫn', () => {
  it('từ chối khoá có .. hoặc bắt đầu bằng / hay \\', async () => {
    const s = fsStore(join(dir, 'safe'));
    for (const k of ['../x', 'a/../../x', '/etc/x', '\\x']) {
      await expect(s.put(k, Buffer.from('x'))).rejects.toThrow();
      await expect(s.get(k)).rejects.toThrow();
    }
  });
});
