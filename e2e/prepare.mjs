// Chạy trước `playwright test` (Playwright bật webServer trước globalSetup, nên không dựng CSDL ở đó được).
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import postgres from 'postgres';
import { ADMIN_DB_URL, E2E_DB } from './db.mjs';

const need = ['apps/server/dist/index.js', 'apps/web/dist/index.html'];
for (const f of need) {
  if (!existsSync(f)) {
    console.error(`Thiếu ${f}. Chạy \`pnpm build\` trước.`);
    process.exit(1);
  }
}

const sql = postgres(ADMIN_DB_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });
try {
  await sql`select 1`;
} catch (e) {
  console.error(`Không nối được Postgres (${e.code ?? e.message}). Bật bằng \`pnpm db:up\`.`);
  process.exit(1);
}
await sql.unsafe(`DROP DATABASE IF EXISTS ${E2E_DB} WITH (FORCE)`);
await sql.unsafe(`CREATE DATABASE ${E2E_DB}`);
await sql.end();

rmSync('e2e/.out', { recursive: true, force: true });
mkdirSync('e2e/.out/photos', { recursive: true });
console.log(`e2e: CSDL ${E2E_DB} đã làm mới.`);
