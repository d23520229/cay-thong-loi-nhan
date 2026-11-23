import { sql } from 'drizzle-orm';
import { adminUsers } from '../db/schema.js';
import type { Db } from '../db/client.js';

/** Quản trị viên đầu tiên từ ADMIN_BOOTSTRAP_EMAIL (đặc tả 8.7, 6.8.2); có rồi thì thôi. */
export async function ensureBootstrapAdmin(db: Db, email?: string): Promise<void> {
  if (!email) return;
  await db.execute(sql`
    INSERT INTO admin_users (email, role)
    SELECT ${email}, 'admin'
    WHERE NOT EXISTS (SELECT 1 FROM ${adminUsers} WHERE lower(email) = ${email})
    ON CONFLICT DO NOTHING`);
}
