import { adminAudit } from '../db/schema.js';
import type { Db } from '../db/client.js';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type AuditAction = 'login' | 'logout' | 'report_resolve' | 'tree_delete' | 'sessions_revoke' | 'pin_unlock';
export type AuditTarget = 'tree' | 'message' | 'report' | 'admin';

/** Ghi nhật ký quản trị; gọi với `tx` của chính thao tác để cùng giao dịch (đặc tả 7.4). */
export async function audit(
  tx: Db | Tx,
  adminId: number,
  action: AuditAction,
  targetType: AuditTarget | null,
  targetId: string | null,
  note?: string | null,
): Promise<void> {
  await tx.insert(adminAudit).values({ adminId, action, targetType, targetId, note: note ?? null });
}
