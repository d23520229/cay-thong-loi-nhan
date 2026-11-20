import type { FastifyInstance } from 'fastify';
import { HttpError } from '../errors.js';
import { renderOg as defaultRender } from '../og/render.js';
import { buildPublicRoom } from './trees.js';

const TREE_ID = /^[a-z2-9]{8}$/;
const CACHE_MAX = 200;

/** Ảnh OG và (Task 7) trang có thẻ OG — đặc tả 6.6.3. */
export async function ogRoutes(app: FastifyInstance) {
  const { db, env } = app.deps;
  const render = app.deps.renderOg ?? defaultRender;
  const cache = new Map<string, Buffer>(); // giữ thứ tự chèn: phần tử đầu là cũ nhất

  app.get<{ Params: { file: string } }>('/og/:file', async (req, reply) => {
    const m = /^([a-z2-9]{8})\.png$/.exec(req.params.file);
    const id = m?.[1];
    const room = id && TREE_ID.test(id) ? await buildPublicRoom(db.db, id) : null;
    if (!id || !room) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
    const key = `${id}:${room.roomVersion}:${room.slots.filter((s) => s.occupied).map((s) => `${s.index}=${s.ornament}`).join(',')}`;
    let png = cache.get(key);
    if (!png) {
      png = await render(room, env.assetDir);
      cache.set(key, png);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    }
    return reply.header('content-type', 'image/png').header('cache-control', 'public, max-age=300').send(png);
  });
}
