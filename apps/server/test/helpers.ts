import { randomUUID } from 'node:crypto';
import { buildApp, type AppDeps, type GoogleVerifier } from '../src/app.js';
import { connectPglite } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv } from '../src/env.js';
import { memoryStore } from '../src/storage/memory.js';

/** `ok:SUB` → { sub }; `ok:SUB:EMAIL` → có email đã xác minh; `unverified:SUB:EMAIL` → email chưa xác minh. */
export const FakeGoogle: GoogleVerifier = async (token) => {
  const [kind, sub, email] = token.split(':');
  if (kind === 'ok' && sub && email === undefined) return { sub };
  if ((kind === 'ok' || kind === 'unverified') && sub && email) return { sub, email, emailVerified: kind === 'ok' };
  throw new Error('invalid token');
};

export const deviceHeaders = (id: string = randomUUID()) => ({ 'x-device-id': id });

export async function makeTestApp(opts: { at?: string; google?: GoogleVerifier | null; renderOg?: AppDeps['renderOg']; renderRoomImage?: AppDeps['renderRoomImage']; env?: Record<string, string> } = {}) {
  let t = new Date(opts.at ?? '2026-12-01T10:00:00+07:00');
  const clock = { set(iso: string) { t = new Date(iso); } };
  const h = await connectPglite();
  await runMigrations(h);
  const google = opts.google === undefined ? FakeGoogle : opts.google;
  const photos = memoryStore();
  const app = await buildApp({ db: h, photos, env: loadEnv(opts.env ?? {}), now: () => t, google, renderOg: opts.renderOg, renderRoomImage: opts.renderRoomImage });
  return { app, h, clock, google, photos };
}

export async function seedTree(h: { db: import('../src/db/client.js').Db }, id: string) {
  const { trees } = await import('../src/db/schema.js');
  await h.db.insert(trees).values({ id, ownerName: 'Chủ cây', privateKeyHash: 'x', pinHash: 'x' });
}
