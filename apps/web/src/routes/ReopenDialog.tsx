import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { authErrorMessage, needsSupport } from '../lib/authError';
import { storage } from '../lib/storage';
import { parseTreeRef } from '../lib/treeRef';
import { Button } from '../ui/Button';
import { GoogleButton } from '../ui/GoogleButton';
import { SupportHint } from '../ui/SupportHint';
import { PinInput } from '../ui/PinInput';
import { Sheet } from '../ui/Sheet';

export function ReopenDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const codeId = useId();
  const [trees, setTrees] = useState(() => storage.myTrees());
  const [code, setCode] = useState(trees[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [stuck, setStuck] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  // Cây ghi nhớ trên máy: phiên còn hiệu lực thì mở thẳng, 404 thì quên cây đó.
  const tryOwner = async (id: string) => {
    try {
      await api.getOwnerTree(id);
      navigate(`/c/${id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        storage.removeMyTree(id);
        setTrees(storage.myTrees());
        setCode((c) => (c === id ? '' : c));
      }
    }
  };

  // Chỉ tự thử khi máy nhớ đúng 1 cây; nhiều cây thì chờ người dùng bấm chọn.
  const only = useRef(trees.length === 1 ? trees[0]?.id : undefined);
  useEffect(() => {
    if (only.current) void tryOwner(only.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: string) => {
    setCode(id);
    setError('');
    setStuck(false);
    void tryOwner(id);
  };

  // Google (đặc tả 6.8.1): hỏi danh sách cây của tài khoản, 1 cây thì vào luôn, nhiều cây thì chọn.
  const [google, setGoogle] = useState<{ token: string; trees: { id: string; title: string | null }[] } | null>(null);

  const googleEnter = async (token: string, t: { id: string; title: string | null }) => {
    await api.authGoogle(token, t.id);
    const known = storage.myTrees().find((x) => x.id === t.id);
    storage.addMyTree({ id: t.id, title: known?.title ?? t.title, createdAt: known?.createdAt ?? new Date().toISOString() });
    navigate(`/c/${t.id}`);
  };

  const runGoogle = async (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setStuck(false);
    try {
      await work();
    } catch (e) {
      setError(authErrorMessage(e));
      setStuck(needsSupport(e));
      // idToken hết hạn khi đang chọn cây: bỏ danh sách để hiện lại nút Google.
      if (e instanceof ApiError && e.code === 'google_invalid') setGoogle(null);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const onGoogleToken = (token: string) =>
    void runGoogle(async () => {
      const res = await api.authGoogle(token);
      const list = res?.trees ?? [];
      if (list.length === 0) {
        setStuck(true);
        return setError('Tài khoản Google này chưa có cây nào');
      }
      if (list.length === 1) return googleEnter(token, list[0]!);
      setGoogle({ token, trees: list });
    });

  const submit = async () => {
    if (busy.current) return;
    const ref = parseTreeRef(code);
    if (!ref) return setError('Mã cây chưa đúng');
    if (!ref.key && pin.length !== 6) return setError('Mã PIN gồm đúng 6 số');
    busy.current = true;
    setPending(true);
    setError('');
    setStuck(false);
    try {
      if (ref.key) await api.authLink(ref.id, ref.key);
      else await api.authPin(ref.id, pin);
      const known = storage.myTrees().find((t) => t.id === ref.id);
      storage.addMyTree({
        id: ref.id,
        title: known?.title ?? null,
        createdAt: known?.createdAt ?? new Date().toISOString(),
      });
      navigate(`/c/${ref.id}`);
    } catch (e) {
      setError(authErrorMessage(e));
      setStuck(needsSupport(e));
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <Sheet title="Mở lại cây của bạn" onClose={onClose}>
      {trees.length > 1 ? (
        <div className="row">
          {trees.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip"
              aria-pressed={code === t.id}
              onClick={() => pick(t.id)}
            >
              {t.title || t.id}
            </button>
          ))}
        </div>
      ) : null}
      <div className="ed-field">
        <label className="lab" htmlFor={codeId}>Mã cây hoặc link cây</label>
        <input
          id={codeId}
          className="input"
          value={code}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
        />
      </div>
      <PinInput value={pin} onChange={setPin} />
      {error ? <div className="notice" role="alert">{error}</div> : null}
      {stuck ? <SupportHint /> : null}
      <Button variant="primary" disabled={pending} onClick={() => void submit()}>Mở cây</Button>
      {google ? (
        <div className="row">
          {google.trees.map((t) => (
            <button key={t.id} type="button" className="chip" disabled={pending} onClick={() => void runGoogle(() => googleEnter(google.token, t))}>
              {t.title || t.id}
            </button>
          ))}
        </div>
      ) : (
        <GoogleButton onToken={onGoogleToken} />
      )}
    </Sheet>
  );
}
