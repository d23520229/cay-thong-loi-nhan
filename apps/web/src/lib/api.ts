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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'x-device-id': storage.deviceId() };
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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

export const api = {
  getConfig: () => request<AppConfig>('GET', '/api/config'),
  getTree: (id: string) => request<PublicRoom>('GET', tree(id)),
  getOwnerTree: (id: string) => request<OwnerRoom>('GET', `${tree(id)}/owner`),
  createTree: (body: CreateTreeBody) =>
    request<{ id: string; publicUrl: string; privateUrl: string; roomVersion: number }>('POST', '/api/trees', body),
  saveRoom: (id: string, roomVersion: number, room: Room) =>
    request<{ roomVersion: number }>('PUT', `${tree(id)}/room`, { roomVersion, room }),
  authPin: (id: string, pin: string) => request<void>('POST', `${tree(id)}/auth/pin`, { pin }),
  authLink: (id: string, key: string) => request<void>('POST', `${tree(id)}/auth/link`, { key }),
  authGoogle: (idToken: string, treeId?: string) =>
    request<void | { trees: { id: string; title: string | null }[] }>('POST', '/api/auth/google', { idToken, treeId }),
  logout: (id: string) => request<void>('POST', `${tree(id)}/auth/logout`),
};
