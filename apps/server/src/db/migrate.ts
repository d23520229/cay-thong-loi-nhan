import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { connectPostgres, type DbHandle } from './client.js';

const defaultDir = fileURLToPath(new URL('./migrations/', import.meta.url));

/** Chạy các file *.sql chưa chạy (theo tên) trong một giao dịch; trả danh sách file vừa chạy. */
export async function runMigrations(h: DbHandle, dir: string = defaultDir): Promise<string[]> {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  return h.transaction(async (c) => {
    await c.exec(`CREATE SCHEMA IF NOT EXISTS meta;
      CREATE TABLE IF NOT EXISTS meta.migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    await c.query('SELECT pg_advisory_xact_lock(727201)');
    const done = new Set((await c.query<{ name: string }>('SELECT name FROM meta.migrations')).map((r) => r.name));
    const ran: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      await c.exec(readFileSync(join(dir, f), 'utf8'));
      await c.query('INSERT INTO meta.migrations(name) VALUES ($1)', [f]);
      ran.push(f);
    }
    return ran;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL');
  const h = connectPostgres(url);
  try {
    const ran = await runMigrations(h);
    console.log(ran.length ? ran.join('\n') : 'Không có migration mới');
  } finally {
    await h.close();
  }
}
