import type { FastifyInstance } from 'fastify';
import { adminAuthRoutes } from './auth.js';
import { adminOverviewRoutes } from './overview.js';
import { adminReportsRoutes } from './reports.js';
import { adminTreesRoutes } from './trees.js';
import { adminAuditRoutes } from './audit.js';

/** Nhóm `/api/admin/*` (đặc tả 8.7, 6.8). */
export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminAuthRoutes);
  await app.register(adminOverviewRoutes);
  await app.register(adminReportsRoutes);
  await app.register(adminTreesRoutes);
  await app.register(adminAuditRoutes);
}
