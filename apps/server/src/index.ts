// Khung server Fastify — các route sẽ được thêm ở mốc M1 (xem docs/dac-ta-v3.md, mục 8).
import Fastify from 'fastify';
import { currentPhase } from './phase.js';

const app = Fastify({ logger: true });

app.get('/healthz', async () => ({ ok: true }));
app.get('/api/config', async () => {
  const p = currentPhase();
  return { now: p.now.toISOString(), phase: p.phase, ...p.milestones };
});

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
