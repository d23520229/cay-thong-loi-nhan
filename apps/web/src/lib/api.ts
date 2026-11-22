import type { CreateTreeBody, Room, RoomItem, TreeConfig } from '@ctln/shared';
import type { Catalog } from './catalog';
import { storage } from './storage';

export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export type PublicRoom = {
  id: string;
  ownerName: string;
  title: string | null;
  background: string;
  tree: TreeConfig;
  items: RoomItem[];
  slots: { index: number; occupied: boolean; ornament?: string }[];
  roomVersion: number;
  phase: string;
};

export type OwnerSlot = PublicRoom['slots'][number] & { messageId?: string; unread?: boolean; locked: boolean };

export type OwnerRoom = Omit<PublicRoom, 'slots'> & {
  slots: OwnerSlot[];
  messageCount: number;
  newSinceLastVisit: number;
  showMessageCount: boolean;
};

export type AppConfig = {
  now: string;
  phase: string;
  unlockAt: string;
  writeClosesAt: string;
  serviceEndsAt: string;
  catalogVersion: number;
  limits: Catalog['limits'];
  googleClientId: string | null;
};

export type MessageInput = { ornament: string; anonymous: boolean; authorName?: string; content: string };

export type MyMessage = {
  messageId: string;
  slotIndex: number;
  ornament: string;
  anonymous: boolean;
  authorName: string | null;
  content: string;
  editUntil: string;
};

export type OpenedMessage = {
  messageId: string;
  slotIndex: number;
  ornament: string;
  anonymous: boolean;
  authorName: string | null;
  content: string;
  createdAt: string;
};

type RequestOpts = { keepalive?: boolean; headers?: Record<string, string> };

async function request<T>(method: string, path: string, body?: unknown, opts?: RequestOpts): Promise<T> {
  const headers: Record<string, string> = { 'x-device-id': storage.deviceId(), ...opts?.headers };
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(opts?.keepalive ? { keepalive: true } : {}),
    });
  } catch {
    throw new ApiError(0, 'network', 'Không kết nối được, kiểm tra mạng rồi thử lại nhé.');
  }
  if (!res.ok) {
    let err: { code?: string; message?: string; [k: string]: unknown } = {};
    try {
      err = (await res.json()).error ?? {};
    } catch {
      /* không phải JSON */
    }
    const { code, message, ...extra } = err;
    throw new ApiError(res.status, code ?? 'unknown', message ?? 'Có lỗi xảy ra, thử lại sau nhé.', extra);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const tree = (id: string) => `/api/trees/${encodeURIComponent(id)}`;
const message = (mid: string) => `/api/messages/${encodeURIComponent(mid)}`;
const token = (t: string): RequestOpts => ({ headers: { 'x-edit-token': t } });

export const api = {
  getConfig: () => request<AppConfig>('GET', '/api/config'),
  getTree: (id: string) => request<PublicRoom>('GET', tree(id)),
  getOwnerTree: (id: string) => request<OwnerRoom>('GET', `${tree(id)}/owner`),
  createTree: (body: CreateTreeBody) =>
    request<{ id: string; publicUrl: string; privateUrl: string; roomVersion: number }>('POST', '/api/trees', body),
  saveRoom: (id: string, roomVersion: number, room: Room, opts?: { keepalive?: boolean }) =>
    request<{ roomVersion: number }>('PUT', `${tree(id)}/room`, { roomVersion, room }, opts),
  authPin: (id: string, pin: string) => request<void>('POST', `${tree(id)}/auth/pin`, { pin }),
  ownerVisit: (id: string) => request<void>('POST', `${tree(id)}/owner/visit`),
  authLink: (id: string, key: string) => request<void>('POST', `${tree(id)}/auth/link`, { key }),
  authGoogle: (idToken: string, treeId?: string) =>
    request<void | { trees: { id: string; title: string | null }[] }>('POST', '/api/auth/google', { idToken, treeId }),
  logout: (id: string) => request<void>('POST', `${tree(id)}/auth/logout`),
  postMessage: (id: string, body: MessageInput & { slotIndex: number; website: string }) =>
    request<{ messageId: string; editToken: string; editUntil: string }>('POST', `${tree(id)}/messages`, body),
  getMine: (mid: string, t: string) => request<MyMessage>('GET', `${message(mid)}/mine`, undefined, token(t)),
  editMessage: (mid: string, t: string, body: MessageInput) => request<{ ok: true }>('PUT', message(mid), body, token(t)),
  deleteMessage: (mid: string, t: string) => request<void>('DELETE', message(mid), undefined, token(t)),
  // Chủ cây (đặc tả 8.5)
  openMessage: (id: string, mid: string) => request<OpenedMessage>('POST', `${tree(id)}/messages/${encodeURIComponent(mid)}/open`),
  ownerDeleteMessage: (id: string, mid: string) => request<void>('DELETE', `${tree(id)}/messages/${encodeURIComponent(mid)}`),
  blockSender: (id: string, mid: string) => request<void>('POST', `${tree(id)}/block`, { messageId: mid }),
  report: (id: string, body: { messageId?: string; reason?: string }) =>
    request<{ reportId: string }>('POST', `${tree(id)}/reports`, body),
  setShowCount: (id: string, show: boolean) =>
    request<{ showMessageCount: boolean }>('PUT', `${tree(id)}/settings`, { showMessageCount: show }),
  deleteTree: (id: string) => request<void>('DELETE', tree(id)),
};
