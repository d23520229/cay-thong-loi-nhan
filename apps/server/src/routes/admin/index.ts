import type { FastifyInstance } from 'fastify';
import { adminAuthRoutes } from './auth.js';

/** Nhóm `/api/admin/*` (đặc tả 8.7, 6.8). */
export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminAuthRoutes);
}
