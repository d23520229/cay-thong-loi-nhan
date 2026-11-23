// Khởi động server: nạp env → nối PostgreSQL → chạy migration → lắng nghe.
import { buildApp } from './app.js';
import { connectPostgres } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { loadEnv } from './env.js';
import { makeGoogleVerifier } from './google.js';
import { now } from './phase.js';
import { makePhotoStore } from './storage/index.js';

const env = loadEnv();
const databaseUrl = process.env.DATABASE_URL;
if (env.production && !databaseUrl) throw new Error('DATABASE_URL là bắt buộc khi chạy production');

const db = connectPostgres(databaseUrl || 'postgres://ctln:ctln_dev@localhost:5432/caythong');
const ran = await runMigrations(db);
const app = await buildApp({ db, env, now: () => now(), google: makeGoogleVerifier(env.googleClientId), photos: makePhotoStore(env) });
if (ran.length) app.log.info({ migrations: ran }, 'đã chạy migration');
if (env.webDistProblem) app.log.warn(env.webDistProblem);

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
