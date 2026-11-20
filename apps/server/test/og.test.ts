import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalog } from '@ctln/shared';
import { makeTestApp } from './helpers.js';
import { renderOg } from '../src/og/render.js';
import { loadEnv } from '../src/env.js';

type T = Awaited<ReturnType<typeof makeTestApp>>;
let t: T | undefined;
afterEach(async () => {
  if (t) { await t.app.close(); await t.h.close(); }
  t = undefined;
});

const JSON_CT = { 'content-type': 'application/json' };
const room = () => ({
  ...structuredClone(catalog.defaultRoom),
  items: catalog.defaultRoom.items.map((it: object, i: number) => ({ ...it, clientId: `i${i}` })),
});

async function create(name = 'Lan') {
  const r = await t!.app.inject({
    method: 'POST', url: '/api/trees', headers: JSON_CT,
    payload: { ownerName: name, recovery: { type: 'pin', pin: '123456' }, room: room() },
  });
  const id = r.json().id as string;
  const token = /ctln_owner_[a-z2-9]+=([^;]+)/.exec(String(r.headers['set-cookie']))![1]!;
  return { id, cookies: { [`ctln_owner_${id}`]: token } };
}

describe('GET /og/:id.png', () => {
  it('PNG 1200×630, có lưu đệm và Cache-Control', async () => {
    t = await makeTestApp();
    const { id } = await create();
    const r = await t!.app.inject({ method: 'GET', url: `/og/${id}.png` });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('image/png');
    expect(String(r.headers['cache-control'])).toContain('max-age=300');
    const meta = await sharp(r.rawPayload).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 1200, 630]);
  }, 60_000);

  it('không có cây → 404', async () => {
    t = await makeTestApp();
    const r = await t!.app.inject({ method: 'GET', url: '/og/zzzzzzzz.png' });
    expect(r.statusCode).toBe(404);
    expect((await t!.app.inject({ method: 'GET', url: '/og/..%2Fx.png' })).statusCode).toBe(404);
  });

  it('gọi lại dùng bản đệm; đổi phòng hoặc có lời nhắn mới thì vẽ lại', async () => {
    const render = vi.fn(async () => Buffer.from('png'));
    t = await makeTestApp({ renderOg: render });
    const { id, cookies } = await create();
    await t!.app.inject({ method: 'GET', url: `/og/${id}.png` });
    await t!.app.inject({ method: 'GET', url: `/og/${id}.png` });
    expect(render).toHaveBeenCalledTimes(1);
    const rm = room();
    rm.background = 'wood';
    const put = await t!.app.inject({ method: 'PUT', url: `/api/trees/${id}/room`, headers: JSON_CT, cookies, payload: { roomVersion: 1, room: rm } });
    expect(put.statusCode).toBe(200);
    await t!.app.inject({ method: 'GET', url: `/og/${id}.png` });
    expect(render).toHaveBeenCalledTimes(2);
    const msg = await t!.app.inject({
      method: 'POST', url: `/api/trees/${id}/messages`, headers: { ...JSON_CT, 'x-device-id': '11111111-1111-4111-8111-111111111111' },
      payload: { slotIndex: 0, ornament: 'bell', anonymous: true, content: 'hi', website: '' },
    });
    expect(msg.statusCode).toBe(201);
    await t!.app.inject({ method: 'GET', url: `/og/${id}.png` });
    expect(render).toHaveBeenCalledTimes(3);
  });
});

describe('renderOg', () => {
  it('vẽ được phòng có cây lật, thu nhỏ và phụ kiện đã treo', async () => {
    const rm = room();
    rm.items = rm.items.map((i: { type: string }) => (i.type === 'tree' ? { ...i, flip: true, scale: 0.5 } : i));
    const slots = Array.from({ length: 12 }, (_, index) => (index < 3 ? { index, occupied: true, ornament: 'bell' } : { index, occupied: false }));
    const buf = await renderOg({ ...rm, slots }, loadEnv({}).assetDir);
    const meta = await sharp(buf).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  }, 60_000);
});

describe('trang web + thẻ OG', () => {
  const dist = () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctln-dist-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Cây Thông Lời Nhắn</title></head><body><div id="root"></div></body></html>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'x.js'), 'console.log(1)');
    return dir;
  };
  const withDist = () => makeTestApp({ env: { WEB_DIST: dist(), BASE_URL: 'https://ex.test' } });

  it('/c/{id} có đủ thẻ OG', async () => {
    t = await withDist();
    const { id } = await create();
    const r = await t!.app.inject({ method: 'GET', url: `/c/${id}` });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    const html = r.body;
    expect(html).toContain('<meta property="og:title" content="Cây thông của Lan">');
    expect(html).toContain('<meta property="og:description" content="Treo một lời nhắn Giáng sinh lên cây của Lan — mở vào đêm 24/12.">');
    expect(html).toContain(`<meta property="og:image" content="https://ex.test/og/${id}.png">`);
    expect(html).toContain(`<meta property="og:url" content="https://ex.test/c/${id}">`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<title>Cây thông của Lan</title>');
    expect(html).toContain('<div id="root"></div>');
  });

  it('tên có ký tự HTML được thoát', async () => {
    t = await withDist();
    const { id } = await create('A"<b>&\'');
    const html = (await t!.app.inject({ method: 'GET', url: `/c/${id}` })).body;
    expect(html).toContain('content="Cây thông của A&quot;&lt;b&gt;&amp;&#39;"');
    expect(html).not.toContain('<b>');
  });

  it('tên có $& không bị String.replace hiểu thành mẫu', async () => {
    t = await withDist();
    const { id } = await create('A$&B');
    const html = (await t!.app.inject({ method: 'GET', url: `/c/${id}` })).body;
    expect(html).toContain('<title>Cây thông của A$&amp;B</title>');
    expect(html).toContain('content="Cây thông của A$&amp;B"');
  });

  it('cây không có → 404 với trang gốc; /tao → index.html; file tĩnh; /api vẫn JSON', async () => {
    t = await withDist();
    const nf = await t!.app.inject({ method: 'GET', url: '/c/zzzzzzzz' });
    expect(nf.statusCode).toBe(404);
    expect(nf.body).toContain('<title>Cây Thông Lời Nhắn</title>');
    expect(nf.body).not.toContain('og:title');
    const page = await t!.app.inject({ method: 'GET', url: '/tao' });
    expect([page.statusCode, page.body.includes('id="root"')]).toEqual([200, true]);
    const js = await t!.app.inject({ method: 'GET', url: '/assets/x.js' });
    expect([js.statusCode, js.body]).toEqual([200, 'console.log(1)']);
    const api = await t!.app.inject({ method: 'GET', url: '/api/khong-co' });
    expect(api.statusCode).toBe(404);
    expect(api.json().error.code).toBe('not_found');
    const og = await t!.app.inject({ method: 'GET', url: '/og/zzzzzzzz.png' });
    expect(og.statusCode).toBe(404);
  });

  it('không có bản build: trang trả 404 JSON, API vẫn chạy', async () => {
    t = await makeTestApp();
    expect((await t!.app.inject({ method: 'GET', url: '/tao' })).statusCode).toBe(404);
    expect((await t!.app.inject({ method: 'GET', url: '/api/config' })).statusCode).toBe(200);
  });
});

describe('sửa sau lượt soát phần 2–3', () => {
  const dist = () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctln-dist-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><title>Cây Thông Lời Nhắn</title></head><body><div id="root"></div></body></html>');
    return dir;
  };

  it('WEB_DIST đặt sai thì env báo lỗi để server ghi cảnh báo', () => {
    expect(loadEnv({ WEB_DIST: join(tmpdir(), 'khong-co-thu-muc-nay') }).webDistProblem).toMatch(/index\.html/);
    expect(loadEnv({}).webDistProblem).toBeUndefined();
  });

  it('khi chưa production: CSP không có upgrade-insecure-requests (thử qua http trong mạng LAN)', async () => {
    t = await makeTestApp();
    const r = await t!.app.inject({ method: 'GET', url: '/api/config' });
    expect(String(r.headers['content-security-policy'])).not.toContain('upgrade-insecure-requests');
  });

  it('đường dẫn có đuôi file hoặc /api trần không rơi vào trang; HEAD trang trả 200', async () => {
    t = await makeTestApp({ env: { WEB_DIST: dist() } });
    expect((await t!.app.inject({ method: 'GET', url: '/assets/cu-da-xoa.js' })).statusCode).toBe(404);
    expect((await t!.app.inject({ method: 'GET', url: '/api' })).statusCode).toBe(404);
    expect((await t!.app.inject({ method: 'HEAD', url: '/tao' })).statusCode).toBe(200);
  });

  it('nhiều request cùng lúc chỉ vẽ một lần', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const render = vi.fn(async () => { await gate; return Buffer.from('png'); });
    t = await makeTestApp({ renderOg: render });
    const { id } = await create();
    const reqs = [1, 2, 3].map(() => t!.app.inject({ method: 'GET', url: `/og/${id}.png` }));
    await new Promise((r) => setTimeout(r, 50));
    release();
    const res = await Promise.all(reqs);
    expect(res.map((r) => r.statusCode)).toEqual([200, 200, 200]);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('renderOg bỏ qua món không có trong danh mục; ảnh nhỏ hơn 400 KB', async () => {
    const rm = room();
    rm.items.push({ clientId: 'x', type: 'khong-co', variant: 'v', x: 100, y: 900, scale: 1, flip: false } as never);
    const buf = await renderOg({ ...rm, slots: [] }, loadEnv({}).assetDir);
    expect((await sharp(buf).metadata()).width).toBe(1200);
    expect(buf.length).toBeLessThan(400_000);
  }, 60_000);
});
