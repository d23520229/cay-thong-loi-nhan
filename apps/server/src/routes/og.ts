import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { HttpError } from '../errors.js';
import { renderOg as defaultRender } from '../og/render.js';
import { buildPublicRoom } from './trees.js';

const TREE_ID = /^[a-z2-9]{8}$/;
const CACHE_MAX = 200;

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!);

const pageTitle = (m: { ownerName: string; title: string | null }) => m.title || `Cây thông của ${m.ownerName}`;

/** Thẻ OG cho `/c/:id` (đặc tả 6.6.3); mọi giá trị đã thoát HTML. */
export function ogTags(m: { id: string; ownerName: string; title: string | null }, baseUrl: string): string {
  const e = escapeHtml;
  const page = `${baseUrl}/c/${m.id}`;
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${e(pageTitle(m))}">`,
    `<meta property="og:description" content="${e(`Treo một lời nhắn Giáng sinh lên cây của ${m.ownerName} — mở vào đêm 24/12.`)}">`,
    `<meta property="og:image" content="${e(`${baseUrl}/og/${m.id}.png`)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:url" content="${e(page)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('');
}

/** `index.html` của bản build (đọc một lần). */
export function indexHtml(webDist: string): string {
  let html = indexCache.get(webDist);
  if (html === undefined) indexCache.set(webDist, (html = readFileSync(join(webDist, 'index.html'), 'utf8')));
  return html;
}
const indexCache = new Map<string, string>();

/** Ảnh OG và (Task 7) trang có thẻ OG — đặc tả 6.6.3. */
export async function ogRoutes(app: FastifyInstance) {
  const { db, env } = app.deps;
  const render = app.deps.renderOg ?? defaultRender;
  const cache = new Map<string, Promise<Buffer>>(); // giữ thứ tự chèn: phần tử đầu là lâu chưa dùng nhất

  app.get<{ Params: { file: string } }>('/og/:file', async (req, reply) => {
    const m = /^([a-z2-9]{8})\.png$/.exec(req.params.file);
    const id = m?.[1];
    const room = id && TREE_ID.test(id) ? await buildPublicRoom(db.db, id) : null;
    if (!id || !room) throw new HttpError(404, 'not_found', 'Không tìm thấy cây này.');
    const key = `${id}:${room.roomVersion}:${room.slots.filter((s) => s.occupied).map((s) => `${s.index}=${s.ornament}`).join(',')}`;
    // Đệm cả lời hứa đang vẽ: nhiều trình đọc link cùng lúc chỉ vẽ một lần. Dùng lại thì dời xuống cuối (LRU).
    let job = cache.get(key);
    if (job) cache.delete(key);
    else {
      job = render(room, env.assetDir);
      job.catch(() => cache.delete(key));
    }
    cache.set(key, job);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    const png = await job;
    return reply.header('content-type', 'image/png').header('cache-control', 'public, max-age=300').send(png);
  });

  // Bản build web: file tĩnh + trang (các đường dẫn khác rơi vào setNotFoundHandler ở app.ts → index.html).
  if (!env.webDist) return;
  const webDist = env.webDist;
  await app.register(fastifyStatic, { root: webDist, wildcard: false, index: ['index.html'] });

  app.get<{ Params: { id: string } }>('/c/:id', async (req, reply) => {
    const base = indexHtml(webDist);
    const meta = TREE_ID.test(req.params.id) ? await buildPublicRoom(db.db, req.params.id) : null;
    reply.type('text/html; charset=utf-8').header('cache-control', 'no-cache');
    if (!meta) return reply.code(404).send(base);
    const html = base
      // Hàm thay thế: chuỗi thay thế thường sẽ hiểu `$&`, `$1`… trong tên người dùng.
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(pageTitle(meta))}</title>`)
      .replace('</head>', () => `${ogTags(meta, env.baseUrl)}</head>`);
    return reply.send(html);
  });
}
