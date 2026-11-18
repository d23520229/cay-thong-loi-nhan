import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { authErrorMessage } from '../lib/authError';
import { storage } from '../lib/storage';
import { parseTreeRef } from '../lib/treeRef';
import { Button } from '../ui/Button';
import { PinInput } from '../ui/PinInput';
import { Sheet } from '../ui/Sheet';

export function ReopenDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const codeId = useId();
  const [trees, setTrees] = useState(() => storage.myTrees());
  const [code, setCode] = useState(trees[0]?.id ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
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

  const first = useRef(trees[0]?.id);
  useEffect(() => {
    if (first.current) void tryOwner(first.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (id: string) => {
    setCode(id);
    setError('');
    void tryOwner(id);
  };

  const submit = async () => {
    if (busy.current) return;
    const ref = parseTreeRef(code);
    if (!ref) return setError('Mã cây chưa đúng');
    if (!ref.key && pin.length !== 6) return setError('Mã PIN gồm đúng 6 số');
    busy.current = true;
    setPending(true);
    setError('');
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
      <Button variant="primary" disabled={pending} onClick={() => void submit()}>Mở cây</Button>
      <Button disabled>Đăng nhập bằng Google <small>sắp có</small></Button>
    </Sheet>
  );
}
