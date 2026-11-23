import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { RoomSchema, validateRoom, type Room } from '@ctln/shared';
import { ApiError, api } from '../lib/api';
import { storage } from '../lib/storage';
import { defaultRoom } from '../room/model';
import { EditorLayout } from '../room/EditorLayout';
import { createEditorStore } from '../room/store';
import { googleName } from '../lib/gis';
import { Button } from '../ui/Button';
import { GoogleButton } from '../ui/GoogleButton';
import { PinInput } from '../ui/PinInput';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

function initialRoom(): Room {
  const draft = storage.getDraft('new');
  if (draft) {
    const parsed = RoomSchema.safeParse(draft.room);
    if (parsed.success && validateRoom(parsed.data).ok) return parsed.data;
    storage.clearDraft('new');
  }
  return defaultRoom();
}

type Created = { id: string; publicUrl: string; privateUrl: string; google: boolean };

function CopyRow({ label, value, show }: { label: string; value: string; show: (m: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      show('Đã sao chép');
    } catch {
      input.current?.select();
      show('Hãy sao chép thủ công');
    }
  };
  return (
    <div className="ed-field">
      <span className="lab">{label}</span>
      <div className="row nowrap">
        <input ref={input} className="input" readOnly value={value} aria-label={label} />
        <Button onClick={() => void copy()}>Sao chép</Button>
      </div>
    </div>
  );
}

export function CreatePage() {
  const navigate = useNavigate();
  const [store] = useState(() => createEditorStore(initialRoom()));
  const [sheet, setSheet] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [title, setTitle] = useState('');
  const [pin, setPin] = useState('');
  const [recovery, setRecovery] = useState<'pin' | 'google'>('pin');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const busy = useRef(false);
  const { toast, show } = useToast();

  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.revision !== prev.revision) {
          storage.setDraft('new', { room: s.room, baseVersion: null, savedAt: new Date().toISOString() });
        }
      }),
    [store],
  );

  const recoveryReady = recovery === 'pin' ? /^\d{6}$/.test(pin) : googleToken !== null;
  const canCreate = ownerName.trim().length > 0 && recoveryReady && !pending;

  const create = async () => {
    if (busy.current || !canCreate) return;
    const room = store.getState().room;
    const v = validateRoom(room);
    if (!v.ok) return setError(v.message);
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const treeTitle = title.trim();
      const res = await api.createTree({
        ownerName: ownerName.trim(),
        title: treeTitle || undefined,
        recovery: recovery === 'google' && googleToken ? { type: 'google', idToken: googleToken } : { type: 'pin', pin },
        room,
        ref: storage.getRef() ?? undefined,
      });
      storage.addMyTree({ id: res.id, title: treeTitle || null, createdAt: new Date().toISOString() });
      storage.clearDraft('new');
      setCreated({ ...res, google: recovery === 'google' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'google_invalid') {
        // idToken hết hạn / sai: bỏ token để hiện lại nút Google.
        setGoogleToken(null);
        setError('Đăng nhập Google chưa thành công, thử lại nhé.');
      } else {
        setError(e instanceof ApiError ? e.message : 'Có lỗi xảy ra, thử lại sau nhé.');
      }
      busy.current = false;
      setPending(false);
    }
  };

  if (created) {
    return (
      <div className="done-page">
        <h1>Cây của bạn đã sẵn sàng! 🎉</h1>
        <div className="ed-field">
          <span className="lab">Mã cây</span>
          <strong className="tree-code">{created.id}</strong>
        </div>
        <CopyRow label="Link gửi bạn bè" value={created.publicUrl} show={show} />
        <CopyRow label="Link riêng của bạn — đừng gửi ai" value={created.privateUrl} show={show} />
        <p className="hint">{created.google ? 'Mở cây trên máy khác bằng Google hoặc link riêng' : 'Ghi lại mã cây và PIN để mở cây trên máy khác'}</p>
        <Button variant="primary" onClick={() => navigate(`/c/${created.id}`)}>Về phòng của tôi</Button>
        {toast}
      </div>
    );
  }

  return (
    <div className="create-page">
      <EditorLayout store={store} topBar={{ doneLabel: 'Hoàn tất', onDone: () => setSheet(true) }} />
      {sheet ? (
        <Sheet title="Sắp xong rồi!" onClose={() => setSheet(false)}>
          <div className="ed-field">
            <label className="lab" htmlFor="owner-name">Tên của bạn</label>
            <input id="owner-name" className="input" maxLength={30} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div className="ed-field">
            <label className="lab" htmlFor="tree-title">Tên cây (không bắt buộc)</label>
            <input id="tree-title" className="input" maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="row">
            <button type="button" className="chip" aria-pressed={recovery === 'pin'} onClick={() => setRecovery('pin')}>Mã PIN 6 số</button>
            <button type="button" className="chip" aria-pressed={recovery === 'google'} onClick={() => setRecovery('google')}>Google</button>
          </div>
          {recovery === 'pin' ? (
            <>
              <PinInput value={pin} onChange={setPin} disabled={pending} />
              <div className="notice">⚠️ Nhớ PIN nhé. Quên PIN và mất link riêng thì không lấy lại được cây.</div>
            </>
          ) : googleToken ? (
            <div className="notice">Đã chọn Google: {googleName(googleToken) ?? 'tài khoản của bạn'}</div>
          ) : (
            <GoogleButton text="continue_with" onToken={(t) => { setGoogleToken(t); setError(''); }} />
          )}
          {error ? <div className="notice" role="alert">{error}</div> : null}
          <Button variant="primary" disabled={!canCreate} onClick={() => void create()}>Tạo cây</Button>
        </Sheet>
      ) : null}
      {toast}
    </div>
  );
}
