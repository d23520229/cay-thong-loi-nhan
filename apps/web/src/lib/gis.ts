// Google Identity Services: chỉ tải khi có nút Google trên màn (đặc tả 6.8.1).
type GisId = {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, o: { theme: 'outline'; size: 'large'; text: string }): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GisId } };
  }
}

const SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<GisId> | null = null;

export function loadGis(): Promise<GisId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (!loading) {
    loading = new Promise<GisId>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = () => {
        const id = window.google?.accounts?.id;
        if (id) resolve(id);
        else reject(new Error('gis'));
      };
      s.onerror = () => reject(new Error('gis'));
      document.head.appendChild(s);
    }).catch((e: unknown) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

/** Tên hiển thị trong idToken (chỉ để hiện "Đã chọn Google: …"; server mới là nơi xác minh). */
export function googleName(idToken: string): string | null {
  try {
    const part = idToken.split('.')[1];
    if (!part) return null;
    const bin = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const name = (JSON.parse(json) as { name?: unknown }).name;
    return typeof name === 'string' && name ? name : null;
  } catch {
    return null;
  }
}
