import type { FastifyInstance } from 'fastify';
import { catalog } from '@ctln/shared';
import { phaseOf } from '../guards.js';

export async function configRoutes(app: FastifyInstance) {
  app.get('/api/config', async () => {
    const p = phaseOf(app);
    const { unlockAt, writeClosesAt, serviceEndsAt, purgeAt } = p.milestones;
    return {
      now: p.now.toISOString(),
      phase: p.phase,
      unlockAt,
      writeClosesAt,
      serviceEndsAt,
      purgeAt,
      catalogVersion: catalog.version,
      limits: catalog.limits,
      googleClientId: app.deps.env.googleClientId ?? null,
      supportEmail: app.deps.env.supportEmail ?? null,
    };
  });
}
