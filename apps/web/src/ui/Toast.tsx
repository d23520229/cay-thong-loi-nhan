import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** Thông báo ngắn ở đáy màn hình, tự tắt sau 2,5 giây. */
export function useToast(): { toast: ReactNode; show: (message: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((m: string) => {
    clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), 2500);
  }, []);
  const toast = message ? <div className="toast" role="status">{message}</div> : null;
  return { toast, show };
}
