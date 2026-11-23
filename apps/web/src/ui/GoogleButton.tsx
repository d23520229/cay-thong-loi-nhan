import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../lib/config';
import { loadGis } from '../lib/gis';
import { Button } from './Button';

type Props = { onToken: (idToken: string) => void; text?: 'signin_with' | 'continue_with' };

/** Nút Google dùng chung cho chủ cây và trang quản trị: trả idToken, server xác minh. */
export function GoogleButton({ onToken, text = 'signin_with' }: Props) {
  const config = useConfig();
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const [failed, setFailed] = useState(false);
  const clientId = config?.googleClientId ?? null;

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    loadGis().then(
      (id) => {
        if (!alive || !box.current) return;
        id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        id.renderButton(box.current, { theme: 'outline', size: 'large', text });
      },
      () => { if (alive) setFailed(true); },
    );
    return () => { alive = false; };
  }, [clientId, text]);

  if (!config) return null;
  if (!clientId || failed) return <Button disabled>Đăng nhập Google tạm thời chưa dùng được</Button>;
  return <div ref={box} className="google-btn" />;
}
