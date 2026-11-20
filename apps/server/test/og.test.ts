import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
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
