import type { Room } from '@ctln/shared';

export type MyTree = { id: string; title: string | null; createdAt: string };
export type Draft = { room: Room; baseVersion: number | null; savedAt: string };

type Area = 'localStorage' | 'sessionStorage';

// localStorage/sessionStorage có thể ném lỗi (trình duyệt trong Zalo/Messenger, chế độ riêng tư).
const read = (area: Area, key: string): string | null => {
  try {
    return window[area].getItem(key);
  } catch {
    return null;
  }
};
const write = (area: Area, key: string, value: string) => {
  try {
    window[area].setItem(key, value);
  } catch {
    /* bỏ qua */
  }
};
const remove = (area: Area, key: string) => {
  try {
    window[area].removeItem(key);
  } catch {
    /* bỏ qua */
  }
};
const parse = <T>(s: string | null): T | null => {
  if (s === null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

// crypto.randomUUID chỉ có trên HTTPS/localhost; mở qua http trong mạng LAN thì tự dựng UUID v4.
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Cookie dự phòng khi localStorage hỏng/không lưu được (đặc tả 7.6).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const readDidCookie = (): string | null => {
  try {
    const m = document.cookie.match(/(?:^|;\s*)ctln_did=([^;]*)/);
    return m && UUID_RE.test(m[1]!) ? m[1]! : null;
  } catch {
    return null;
  }
};
const writeDidCookie = (id: string) => {
  try {
    document.cookie = `ctln_did=${id}; max-age=31536000; path=/; samesite=lax`;
  } catch {
    /* bỏ qua */
  }
};

let memoryDeviceId: string | null = null;

export const storage = {
  deviceId(): string {
    if (memoryDeviceId) return memoryDeviceId;
    let id = read('localStorage', 'deviceId') ?? readDidCookie();
    if (!id) id = uuid();
    write('localStorage', 'deviceId', id);
    if (read('localStorage', 'deviceId') !== id) writeDidCookie(id);
    memoryDeviceId = id;
    return id;
  },
  myTrees(): MyTree[] {
    const v = parse<MyTree[]>(read('localStorage', 'myTrees'));
    return Array.isArray(v) ? v : [];
  },
  addMyTree(t: MyTree) {
    write('localStorage', 'myTrees', JSON.stringify([t, ...this.myTrees().filter((x) => x.id !== t.id)]));
  },
  removeMyTree(id: string) {
    write('localStorage', 'myTrees', JSON.stringify(this.myTrees().filter((x) => x.id !== id)));
  },
  getDraft: (key: string): Draft | null => parse<Draft>(read('localStorage', 'draft:' + key)),
  setDraft: (key: string, d: Draft) => write('localStorage', 'draft:' + key, JSON.stringify(d)),
  clearDraft: (key: string) => remove('localStorage', 'draft:' + key),
  getRef: (): string | null => read('sessionStorage', 'ref'),
  setRef: (id: string) => write('sessionStorage', 'ref', id),
};
