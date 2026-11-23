import { describe, it, expect } from 'vitest';
import { connectPglite } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv } from '../src/env.js';
import { eq } from 'drizzle-orm';
import { rateCounters } from '../src/db/schema.js';
import { hashPin, verifyPin, newTreeId, ipHash, deviceHash, ipBlockHash, hmac, randomToken, rateLimit } from '../src/security.js';

const env = loadEnv({});

describe('env', () => {
  it('production thiếu hoặc PEPPER ngắn thì ném lỗi', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow();
    expect(() => loadEnv({ NODE_ENV: 'production', PEPPER: 'short' })).toThrow();
    expect(() => loadEnv({ NODE_ENV: 'production', PEPPER: 'x'.repeat(32) })).toThrow();
    expect(() => loadEnv({ NODE_ENV: 'production', PEPPER: 'x'.repeat(32), BLOCK_IP_KEY: 'short' })).toThrow();
    const ok = loadEnv({ NODE_ENV: 'production', PEPPER: 'x'.repeat(32), BLOCK_IP_KEY: 'y'.repeat(32), AZURE_STORAGE_CONNECTION_STRING: 'cs' });
    expect(ok.pepper).toBe('x'.repeat(32));
    expect(ok.blockIpKey).toBe('y'.repeat(32));
  });
  it('production thiếu AZURE_STORAGE_CONNECTION_STRING thì ném lỗi (không lặng lẽ ghi đĩa)', () => {
    const base = { NODE_ENV: 'production', PEPPER: 'x'.repeat(32), BLOCK_IP_KEY: 'y'.repeat(32) };
    expect(() => loadEnv(base)).toThrow(/AZURE_STORAGE_CONNECTION_STRING/);
    expect(() => loadEnv({ ...base, AZURE_STORAGE_CONNECTION_STRING: 'cs' })).not.toThrow();
  });
  it('TRUST_PROXY_HOPS mặc định 1, đọc từ env, từ chối giá trị sai', () => {
    expect(loadEnv({}).trustProxyHops).toBe(1);
    expect(loadEnv({ TRUST_PROXY_HOPS: '2' }).trustProxyHops).toBe(2);
    expect(() => loadEnv({ TRUST_PROXY_HOPS: 'abc' })).toThrow();
  });
  it('production không cho đặt FAKE_NOW', () => {
    const base = { NODE_ENV: 'production', PEPPER: 'x'.repeat(32), BLOCK_IP_KEY: 'y'.repeat(32), AZURE_STORAGE_CONNECTION_STRING: 'cs' };
    expect(() => loadEnv({ ...base, FAKE_NOW: '2026-12-24T00:00:00+07:00' })).toThrow(/FAKE_NOW/);
    expect(() => loadEnv(base)).not.toThrow();
    expect(() => loadEnv({ FAKE_NOW: '2026-12-24T00:00:00+07:00' })).not.toThrow();
  });
  it('dev dùng giá trị cố định', () => {
    expect(env.pepper).toBe('dev-pepper-dev-pepper-dev-pepper!');
    expect(env.production).toBe(false);
  });
});

describe('security', () => {
  it('newTreeId khớp mẫu', () => {
    for (let i = 0; i < 1000; i++) expect(newTreeId()).toMatch(/^[a-z2-9]{8}$/);
  });
  it('randomToken là base64url', () => {
    expect(randomToken(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('PIN', async () => {
    const h = await hashPin('123456');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPin('123456', h)).toBe(true);
    expect(await verifyPin('654321', h)).toBe(false);
    expect(await hashPin('123456')).not.toBe(h);
  });
  it('ipHash đổi theo ngày Việt Nam', () => {
    const a = ipHash(env, '1.2.3.4', new Date('2026-12-23T16:59:00Z'));
    const b = ipHash(env, '1.2.3.4', new Date('2026-12-23T17:01:00Z'));
    expect(a).not.toBe(b);
    expect(ipHash(env, '1.2.3.4', new Date('2026-12-23T10:00:00Z'))).toBe(ipHash(env, '1.2.3.4', new Date('2026-12-23T16:00:00Z')));
  });
  it('hmac theo mục đích, deviceHash, ipBlockHash', () => {
    expect(hmac(env, 'link', 'x')).not.toBe(hmac(env, 'edit', 'x'));
    expect(deviceHash(env, 'd')).toBe(hmac(env, 'device', 'd'));
    expect(ipBlockHash(env, '1.2.3.4')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('rateLimit', () => {
  it('đếm theo giờ', async () => {
    const h = await connectPglite();
    await runMigrations(h);
    const at = new Date('2026-12-01T10:15:00Z');
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await rateLimit(h.db, 't', 3, at));
    expect(r).toEqual([true, true, true, false]);
    expect(await rateLimit(h.db, 't', 3, new Date('2026-12-01T11:00:00Z'))).toBe(true);
    await h.close();
  });
  it('rateLimit với windowMs 15 phút: khung tính theo bội của 15 phút', async () => {
    const h = await connectPglite();
    await runMigrations(h);
    const W = 15 * 60_000;
    expect(await rateLimit(h.db, 'q', 2, new Date('2026-12-01T10:15:00Z'), W)).toBe(true);
    expect(await rateLimit(h.db, 'q', 2, new Date('2026-12-01T10:29:59Z'), W)).toBe(true);
    expect(await rateLimit(h.db, 'q', 2, new Date('2026-12-01T10:20:00Z'), W)).toBe(false);
    expect(await rateLimit(h.db, 'q', 2, new Date('2026-12-01T10:30:00Z'), W)).toBe(true);
    const rows = await h.db.select().from(rateCounters).where(eq(rateCounters.bucket, 'q'));
    expect(rows.map((r) => [r.windowStart.toISOString(), r.hits]).sort()).toEqual([
      ['2026-12-01T10:15:00.000Z', 3],
      ['2026-12-01T10:30:00.000Z', 1],
    ]);
    await h.close();
  });
  it('song song đúng limit', async () => {
    const h = await connectPglite();
    await runMigrations(h);
    const at = new Date('2026-12-01T10:15:00Z');
    const r = await Promise.all(Array.from({ length: 10 }, () => rateLimit(h.db, 'p', 5, at)));
    expect(r.filter(Boolean)).toHaveLength(5);
    await h.close();
  });
});
