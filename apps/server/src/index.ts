// Khởi động server. DB thật được nối đầy đủ ở Task 10 (kết nối lười nên chưa cần DATABASE_URL để chạy /api/config).
import { buildApp } from './app.js';
import { connectPostgres } from './db/client.js';
import { loadEnv } from './env.js';
import { now } from './phase.js';

const env = loadEnv();
const db = connectPostgres(process.env.DATABASE_URL ?? 'postgres://localhost:5432/ctln');
const app = await buildApp({ db, env, now, google: null });

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
