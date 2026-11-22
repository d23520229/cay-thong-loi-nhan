import { randomUUID } from 'node:crypto';
import { buildApp, type AppDeps, type GoogleVerifier } from '../src/app.js';
import { connectPglite } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv } from '../src/env.js';

export const FakeGoogle: GoogleVerifier = async (token) => {
  if (token.startsWith('ok:')) return { sub: token.slice(3) };
  throw new Error('invalid token');
};

export const deviceHeaders = (id: string = randomUUID()) => ({ 'x-device-id': id });

export async function makeTestApp(opts: { at?: string; google?: GoogleVerifier | null; renderOg?: AppDeps['renderOg']; renderRoomImage?: AppDeps['renderRoomImage']; env?: Record<string, string> } = {}) {
  let t = new Date(opts.at ?? '2026-12-01T10:00:00+07:00');
  const clock = { set(iso: string) { t = new Date(iso); } };
  const h = await connectPglite();
  await runMigrations(h);
  const google = opts.google === undefined ? FakeGoogle : opts.google;
  const app = await buildApp({ db: h, env: loadEnv(opts.env ?? {}), now: () => t, google, renderOg: opts.renderOg, renderRoomImage: opts.renderRoomImage });
  return { app, h, clock, google };
}

export async function seedTree(h: { db: import('../src/db/client.js').Db }, id: string) {
  const { trees } = await import('../src/db/schema.js');
  await h.db.insert(trees).values({ id, ownerName: 'Chủ cây', privateKeyHash: 'x', pinHash: 'x' });
}
