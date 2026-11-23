import { ApiError, request } from '../lib/api';

// Kiểu dữ liệu khớp API server (đặc tả 6.8.3–6.8.6).
export type Me = { email: string; csrfToken: string };
type Count = { total: number; last24h: number };
export type Overview = {
  now: string;
  phase: string;
  next: { key: 'unlockAt' | 'writeClosesAt' | 'serviceEndsAt' | 'purgeAt'; at: string } | null;
  users: { trees: Count; messages: Count; views: Count; openReports: number; viral: number | null };
  server: {
    errors24h: number;
    lastError: { at: string; route: string | null; status: number } | null;
    p95Ms: number | null;
    latencySince: string;
    dbBytes: number;
    dbQuotaBytes: number;
    photos: { count: number; bytes: number; unknown: number; reportSnapshots: number };
    azureUrl: string | null;
  };
};
export type AdminReport = {
  id: string;
  createdAt: string;
  reporter: 'owner' | 'guest';
  reason: string | null;
  treeId: string;
  messageId: string | null;
  snapshot: string | null;
  hasPhoto: boolean;
  messageExists: boolean;
  status: 'open' | 'resolved' | 'dismissed';
  resolution: string | null;
  handledAt: string | null;
  note: string | null;
};
export type ResolveAction = 'delete_message' | 'delete_tree' | 'dismiss';
export type AdminTree = {
  id: string;
  ownerName: string;
  title: string | null;
  createdAt: string;
  lastOwnerVisitAt: string | null;
  itemCount: number;
  messages: { opened: number; unopened: number };
  recovery: { pin: boolean; google: boolean };
  activeSessions: number;
  reports: { open: number; total: number };
  pin: { failsToday: number; lockedUntil: string | null };
};
export type AuditItem = {
  id: string;
  at: string;
  email: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  note: string | null;
};

const BASE = '/api/admin';
const enc = encodeURIComponent;
// Token CSRF chỉ giữ trong bộ nhớ; lấy từ login / me.
let csrf = '';

async function me(): Promise<Me> {
  const r = await request<Me>('GET', `${BASE}/me`);
  csrf = r.csrfToken;
  return r;
}

/** Lệnh ghi: gửi X-CSRF-Token; 403 `csrf` → lấy lại token bằng me() rồi thử lại đúng một lần. */
async function write<T>(method: string, path: string, body?: unknown): Promise<T> {
  const send = () => request<T>(method, path, body ?? {}, { headers: { 'x-csrf-token': csrf } });
  try {
    return await send();
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 403 && e.code === 'csrf')) throw e;
    await me();
    return send();
  }
}

export const adminApi = {
  me,
  login: async (idToken: string): Promise<Me> => {
    const r = await request<Me>('POST', `${BASE}/auth/google`, { idToken });
    csrf = r.csrfToken;
    return r;
  },
  logout: () => write<void>('POST', `${BASE}/auth/logout`),
  overview: () => request<Overview>('GET', `${BASE}/overview`),
  reports: (status: 'open' | 'handled') => request<{ items: AdminReport[] }>('GET', `${BASE}/reports?status=${status}`),
  reportPhotoUrl: (rid: string) => `${BASE}/reports/${enc(rid)}/photo`,
  resolve: (rid: string, action: ResolveAction, note: string) =>
    write<{ ok: true }>('POST', `${BASE}/reports/${enc(rid)}/resolve`, { action, note }),
  tree: (id: string) => request<AdminTree>('GET', `${BASE}/trees/${enc(id)}`),
  /** Ảnh phòng cho quản trị: không tính lượt tải ảnh, vẫn xem được sau khi dịch vụ kết thúc. */
  roomImageUrl: (id: string) => `${BASE}/trees/${enc(id)}/room.png`,
  unlockPin: (id: string, note?: string) => write<void>('POST', `${BASE}/trees/${enc(id)}/unlock-pin`, note ? { note } : {}),
  revokeSessions: (id: string, note?: string) =>
    write<{ revoked: number }>('POST', `${BASE}/trees/${enc(id)}/revoke-sessions`, note ? { note } : {}),
  deleteTree: (id: string, note: string) => write<void>('DELETE', `${BASE}/trees/${enc(id)}`, { note }),
  audit: (before?: string) =>
    request<{ items: AuditItem[]; nextBefore: string | null }>('GET', `${BASE}/audit${before ? `?before=${enc(before)}` : ''}`),
};
