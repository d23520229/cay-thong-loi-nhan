import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestApp, deviceHeaders, seedTree } from './helpers.js';
import { clientIp, assertNotPaused, assertNotGloballyBlocked, assertWritable, requireDeviceId, requireOwner, setOwnerCookie, getOwnerSession } from '../src/guards.js';
import { HttpError } from '../src/errors.js';
import { messages, ownerSessions, siteSettings, globalBlocks, events } from '../src/db/schema.js';
import { deviceHash, hmac } from '../src/security.js';
import { logEvent } from '../src/events.js';
import { buildApp } from '../src/app.js';
import { connectPglite } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv } from '../src/env.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T;
afterEach(async () => { await t.app.close(); await t.h.close(); });

const JSON_CT = { 'content-type': 'application/json' };

describe('app', () => {
  it('/api/config ở BUILD', async () => {
    t = await makeTestApp();
    const r = await t.app.inject('/api/config');
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.phase).toBe('BUILD');
    expect(j.catalogVersion).toBe(1);
    expect(j.limits.maxItems).toBe(25);
    expect(j.unlockAt).toBe('2026-12-23T17:00:00.000Z');
  });
  it('/api/config ở ENDED vẫn 200, route khác 410', async () => {
    t = await makeTestApp({ at: '2027-01-01T00:00:00+07:00' });
    expect((await t.app.inject('/api/config')).json().phase).toBe('ENDED');
    const r = await t.app.inject('/api/trees/abc');
    expect(r.statusCode).toBe(410);
    expect(r.json().error.code).toBe('service_ended');
  });
  it('JSON sai cú pháp → 400 tiếng Việt, không stack', async () => {
    t = await makeTestApp();
    t.app.post('/api/echo', async (req) => req.body);
    const r = await t.app.inject({ method: 'POST', url: '/api/echo', headers: JSON_CT, payload: '{bad' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toEqual({ code: 'invalid_body', message: 'Dữ liệu chưa hợp lệ.' });
    expect(r.body).not.toContain('stack');
  });
  it('body 70 KB → 413', async () => {
    t = await makeTestApp();
    t.app.post('/api/echo', async (req) => req.body);
    const r = await t.app.inject({ method: 'POST', url: '/api/echo', headers: JSON_CT, payload: JSON.stringify({ a: 'x'.repeat(70000) }) });
    expect(r.statusCode).toBe(413);
    expect(r.json().error.code).toBe('body_too_large');
  });
  it('text/plain → 415', async () => {
    t = await makeTestApp();
    t.app.post('/api/echo', async (req) => req.body);
    const r = await t.app.inject({ method: 'POST', url: '/api/echo', headers: { 'content-type': 'text/plain' }, payload: 'hi' });
    expect(r.statusCode).toBe(415);
    expect(r.json().error.code).toBe('json_required');
  });
  it('POST không body không bị 415', async () => {
    t = await makeTestApp();
    t.app.post('/api/ping', async () => ({ ok: true }));
    expect((await t.app.inject({ method: 'POST', url: '/api/ping' })).statusCode).toBe(200);
  });
  it('lỗi bất ngờ → 500 chung', async () => {
    t = await makeTestApp();
    t.app.get('/api/boom', async () => { throw new Error('secret'); });
    const r = await t.app.inject('/api/boom');
    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({ error: { code: 'internal', message: 'Có lỗi xảy ra, thử lại sau nhé.' } });
  });
  it('route không có → 404 thống nhất', async () => {
    t = await makeTestApp();
    const r = await t.app.inject('/api/nope');
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe('not_found');
  });
});

describe('guards', () => {
  it('clientIp bỏ hậu tố :port của IPv4 và [IPv6]:port', async () => {
    t = await makeTestApp();
    expect(clientIp({ ip: '1.2.3.4:5678' } as never)).toBe('1.2.3.4');
    expect(clientIp({ ip: '1.2.3.4' } as never)).toBe('1.2.3.4');
    expect(clientIp({ ip: '2001:db8::1' } as never)).toBe('2001:db8::1');
    expect(clientIp({ ip: '[2001:db8::1]:5678' } as never)).toBe('2001:db8::1');
    expect(clientIp({ ip: '[2001:db8::1]' } as never)).toBe('2001:db8::1');
  });
  it('assertWritable theo giai đoạn', async () => {
    t = await makeTestApp();
    expect(() => assertWritable(t.app)).not.toThrow();
    t.clock.set('2026-12-26T00:00:00+07:00');
    expect(() => assertWritable(t.app)).toThrow(HttpError);
  });
  it('requireDeviceId', async () => {
    t = await makeTestApp();
    const id = '123e4567-e89b-42d3-a456-426614174000';
    expect(requireDeviceId({ headers: deviceHeaders(id) } as never)).toBe(id);
    expect(() => requireDeviceId({ headers: { 'x-device-id': 'nope' } } as never)).toThrow(HttpError);
    expect(() => requireDeviceId({ headers: {} } as never)).toThrow(HttpError);
  });
  it('assertNotPaused đọc site_settings, đệm 30 giây', async () => {
    t = await makeTestApp();
    await expect(assertNotPaused(t.app, 'pause_create')).resolves.toBeUndefined();
    await t.h.db.insert(siteSettings).values({ key: 'pause_create', value: 'true' });
    await expect(assertNotPaused(t.app, 'pause_create')).resolves.toBeUndefined(); // còn đệm
    t.clock.set('2026-12-01T10:00:31+07:00');
    await expect(assertNotPaused(t.app, 'pause_create')).rejects.toMatchObject({ status: 503, code: 'paused' });
    await expect(assertNotPaused(t.app, 'pause_messages')).resolves.toBeUndefined();
  });
  it('assertNotGloballyBlocked: thiết bị bị chặn, hết hạn thì không', async () => {
    t = await makeTestApp();
    const dev = '123e4567-e89b-42d3-a456-426614174000';
    await t.h.db.insert(globalBlocks).values({
      kind: 'device',
      valueHash: deviceHash(t.app.deps.env, dev),
      expiresAt: new Date('2026-12-02T00:00:00+07:00'),
    });
    const req = { ip: '1.2.3.4' } as never;
    await expect(assertNotGloballyBlocked(t.app, req, dev)).rejects.toMatchObject({ status: 403, code: 'blocked' });
    await expect(assertNotGloballyBlocked(t.app, req, '223e4567-e89b-42d3-a456-426614174000')).resolves.toBeUndefined();
    t.clock.set('2026-12-03T00:00:00+07:00');
    await expect(assertNotGloballyBlocked(t.app, req, dev)).resolves.toBeUndefined();
  });
  it('phiên chủ cây: cookie, thu hồi, sai cây', async () => {
    t = await makeTestApp();
    await seedTree(t.h, 'abcd2345');
    await seedTree(t.h, 'zzzz2345');
    t.app.post('/api/t/:id/login', async (req, reply) => {
      await setOwnerCookie(t.app, reply, (req.params as { id: string }).id, 'create');
      return { ok: true };
    });
    t.app.get('/api/t/:id/me', async (req) => {
      const s = await requireOwner(t.app, req, (req.params as { id: string }).id);
      return { sessionId: s.sessionId };
    });
    const login = await t.app.inject({ method: 'POST', url: '/api/t/abcd2345/login' });
    const sc = String(login.headers['set-cookie']);
    expect(sc).toMatch(/^ctln_owner_abcd2345=[A-Za-z0-9_-]{43};/);
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain('SameSite=Lax');
    expect(sc).toContain('Path=/');
    expect(sc).not.toContain('Secure');
    expect(sc).toContain('Expires=Wed, 06 Jan 2027 17:00:00 GMT');
    const token = login.cookies[0]!.value;
    const [row] = await t.h.db.select().from(ownerSessions);
    expect(row!.tokenHash).toBe(hmac(t.app.deps.env, 'session', token));
    expect(row!.expiresAt.toISOString()).toBe('2027-01-06T17:00:00.000Z');
    expect(row!.lastSeenAt).toBeNull();

    const cookies = { ctln_owner_abcd2345: token };
    expect((await t.app.inject({ url: '/api/t/abcd2345/me', cookies })).statusCode).toBe(200);
    expect((await t.h.db.select().from(ownerSessions))[0]!.lastSeenAt).not.toBeNull();
    const other = await t.app.inject({ url: '/api/t/zzzz2345/me', cookies: { ctln_owner_zzzz2345: token } });
    expect(other.statusCode).toBe(401);
    expect(other.json().error.code).toBe('owner_required');
    expect((await t.app.inject('/api/t/abcd2345/me')).statusCode).toBe(401);
    await t.h.db.update(ownerSessions).set({ revokedAt: new Date() }).where(eq(ownerSessions.id, row!.id));
    expect((await t.app.inject({ url: '/api/t/abcd2345/me', cookies })).statusCode).toBe(401);
  });
  it('phiên hết hạn → null', async () => {
    t = await makeTestApp();
    await seedTree(t.h, 'abcd2345');
    t.app.post('/api/t/login', async (_req, reply) => { await setOwnerCookie(t.app, reply, 'abcd2345', 'pin'); return {}; });
    const token = (await t.app.inject({ method: 'POST', url: '/api/t/login' })).cookies[0]!.value;
    const req = { cookies: { ctln_owner_abcd2345: token } } as never;
    expect(await getOwnerSession(t.app, req, 'abcd2345')).not.toBeNull();
    t.clock.set('2027-01-07T00:00:01+07:00');
    expect(await getOwnerSession(t.app, req, 'abcd2345')).toBeNull();
  });
  it('logEvent ghi sự kiện', async () => {
    t = await makeTestApp();
    await logEvent(t.h.db, 'tree_created', 'abcd2345');
    await logEvent(t.h.db, 'cta_clicked');
    const rows = await t.h.db.select().from(events);
    expect(rows.map((r) => [r.type, r.treeId])).toEqual([['tree_created', 'abcd2345'], ['cta_clicked', null]]);
  });
});

describe('log request', () => {
  it('lỗi CSDL 500 không ghi nội dung người dùng vào log', async () => {
    const lines: string[] = [];
    const h = await connectPglite();
    await runMigrations(h);
    const app = await buildApp(
      { db: h, env: loadEnv({}), now: () => new Date('2026-12-01T10:00:00+07:00'), google: null },
      { logStream: { write: (m) => void lines.push(m) } },
    );
    t = { app, h } as T;
    app.get('/api/leak', async () => {
      await h.db.insert(messages).values({
        treeId: 'khongco01', slotIndex: 0, ornament: 'ball', isAnonymous: false, authorName: 'TÁC GIẢ xyz',
        content: 'BÍ MẬT xyz', deviceHash: 'd', editTokenHash: 'e', editUntil: new Date(), readAt: null,
      } as never);
      return {};
    });
    const r = await app.inject('/api/leak');
    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({ error: { code: 'internal', message: 'Có lỗi xảy ra, thử lại sau nhé.' } });
    const out = lines.join('');
    expect(out).toContain('"level":50');
    expect(out).not.toContain('BÍ MẬT xyz');
    expect(out).not.toContain('TÁC GIẢ xyz');
  });
  it('log của Fastify không chứa IP khách', async () => {
    const lines: string[] = [];
    const h = await connectPglite();
    await runMigrations(h);
    const app = await buildApp(
      { db: h, env: loadEnv({}), now: () => new Date('2026-12-01T10:00:00+07:00'), google: null },
      { logStream: { write: (m) => void lines.push(m) } },
    );
    t = { app, h } as T; // afterEach đóng app + db
    await app.inject({ url: '/api/config?x=1', remoteAddress: '203.0.113.7', headers: { 'x-forwarded-for': '203.0.113.7' } });
    const out = lines.join('');
    expect(out).toContain('/api/config');
    expect(out).not.toContain('203.0.113.7');
    expect(out).not.toContain('x=1');
  });
});

describe('/api/config googleClientId', () => {
  const cfg = async (envSrc: Record<string, string>) => {
    const h = await connectPglite();
    await runMigrations(h);
    const app = await buildApp({ db: h, env: loadEnv(envSrc), now: () => new Date('2026-12-01T10:00:00+07:00'), google: null });
    t = { app, h } as T; // afterEach đóng app + db
    return (await app.inject('/api/config')).json();
  };
  it('null khi không cấu hình', async () => {
    expect((await cfg({})).googleClientId).toBeNull();
  });
  it('trả giá trị khi có env.googleClientId', async () => {
    expect((await cfg({ GOOGLE_CLIENT_ID: 'abc.apps.googleusercontent.com' })).googleClientId).toBe('abc.apps.googleusercontent.com');
  });
});
