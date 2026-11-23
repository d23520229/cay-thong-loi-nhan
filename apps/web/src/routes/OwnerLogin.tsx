import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { authErrorMessage } from '../lib/authError';
import { Button } from '../ui/Button';
import { GoogleButton } from '../ui/GoogleButton';
import { PinInput } from '../ui/PinInput';
import { Sheet } from '../ui/Sheet';

/** Bảng "Chào chủ cây" (đặc tả 6.5 "Chủ cây vào từ máy khác"): đăng nhập bằng PIN hoặc Google (6.8.1). */
export function OwnerLogin({ treeId, onClose, onSuccess }: { treeId: string; onClose: () => void; onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current) return;
    if (pin.length !== 6) return setError('Mã PIN gồm đúng 6 số');
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await api.authPin(treeId, pin);
      onSuccess();
    } catch (e) {
      setError(authErrorMessage(e));
      busy.current = false;
      setPending(false);
    }
  };

  const google = async (idToken: string) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await api.authGoogle(idToken, treeId);
      onSuccess();
    } catch (e) {
      setError(authErrorMessage(e));
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <Sheet title="Chào chủ cây 👋" onClose={onClose}>
      <p className="hint">Nhập mã PIN bạn đã đặt khi tạo cây.</p>
      <PinInput value={pin} onChange={setPin} disabled={pending} />
      {error ? <div className="notice" role="alert">{error}</div> : null}
      <Button variant="primary" disabled={pending} onClick={() => void submit()}>Vào cây</Button>
      <GoogleButton onToken={(t) => void google(t)} />
      <p className="hint">Có link riêng? Mở link đó là vào được ngay.</p>
    </Sheet>
  );
}
