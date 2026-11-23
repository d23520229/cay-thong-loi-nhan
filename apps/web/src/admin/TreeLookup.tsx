import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { ApiError } from '../lib/api';
import { parseTreeRef } from '../lib/treeRef';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { adminApi, type AdminTree } from './adminApi';
import { useAdmin } from './context';
import { fmtDateTime } from './format';

type Action = 'unlock' | 'revoke' | 'delete';
const CONFIRM: Record<Action, string> = {
  unlock: 'Mở khoá PIN của phòng này?',
  revoke: 'Đăng xuất phòng này trên mọi máy?',
  delete: 'Xoá cả phòng và mọi lời nhắn? Không lấy lại được.',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <tr><th scope="row">{label}</th><td>{children}</td></tr>;
}

/** Tra cứu phòng (đặc tả 6.8.5): chỉ số liệu, không có nội dung lời nhắn. */
export function TreeLookup() {
  const { onError } = useAdmin();
  const inputId = useId();
  const noteId = useId();
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const [text, setText] = useState(id ?? '');
  const [tree, setTree] = useState<AdminTree | null>(null);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const load = useCallback(
    async (treeId: string) => {
      setError('');
      try {
        setTree(await adminApi.tree(treeId));
      } catch (e) {
        setTree(null);
        setError(e instanceof ApiError && e.status === 404 ? 'Không tìm thấy cây này' : onError(e));
      }
    },
    [onError],
  );

  useEffect(() => {
    if (id) void load(id);
  }, [id, load]);

  const submit = () => {
    // Chỉ lấy mã cây: phần #k= của link riêng không lên server, không vào địa chỉ trang.
    const ref = parseTreeRef(text);
    setDone('');
    if (!ref) {
      setTree(null);
      return setError('Mã cây chưa đúng');
    }
    setText(ref.id);
    if (ref.id === id) void load(ref.id);
    else setParams({ id: ref.id });
  };

  const run = async (a: Action) => {
    if (!tree) return;
    setAsk(null);
    setPending(true);
    setError('');
    setDone('');
    const n = note.trim();
    try {
      if (a === 'unlock') {
        await adminApi.unlockPin(tree.id, n || undefined);
        setDone('Đã mở khoá PIN');
        await load(tree.id);
      } else if (a === 'revoke') {
        const r = await adminApi.revokeSessions(tree.id, n || undefined);
        setDone(`Đã thu hồi ${r.revoked} phiên`);
        await load(tree.id);
      } else {
        await adminApi.deleteTree(tree.id, n);
        setDone(`Đã xoá phòng ${tree.id}`);
        setTree(null);
      }
      setNote('');
    } catch (e) {
      setError(onError(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <h1>Tra cứu phòng</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="lab" htmlFor={inputId}>Mã cây hoặc link</label>
        <input id={inputId} className="input" value={text} autoComplete="off" spellCheck={false} onChange={(e) => setText(e.target.value)} />
        <Button variant="primary" type="submit">Tra cứu</Button>
      </form>
      {error ? <div className="notice" role="alert">{error}</div> : null}
      {done ? <div className="notice" role="status">{done}</div> : null}
      {tree ? (
        <div className="adm-split">
          <img className="adm-room" src={adminApi.roomImageUrl(tree.id)} alt={`Ảnh phòng ${tree.id}`} />
          <div className="adm-detail">
            <table className="adm-table">
              <tbody>
                <Row label="Chủ cây">{tree.ownerName}</Row>
                <Row label="Tên cây">{tree.title ?? '—'}</Row>
                <Row label="Ngày tạo">{fmtDateTime(tree.createdAt)}</Row>
                <Row label="Chủ cây vào gần nhất">{tree.lastOwnerVisitAt ? fmtDateTime(tree.lastOwnerVisitAt) : '—'}</Row>
                <Row label="Số món">{tree.itemCount}</Row>
                <Row label="Lời nhắn">{`${tree.messages.opened} đã mở · ${tree.messages.unopened} chưa mở`}</Row>
                <Row label="Cách khôi phục">{[tree.recovery.pin && 'PIN', tree.recovery.google && 'Google', 'link riêng'].filter(Boolean).join(', ')}</Row>
                <Row label="Phiên đang mở">{tree.activeSessions}</Row>
                <Row label="Báo cáo">{`${tree.reports.open} đang chờ / ${tree.reports.total}`}</Row>
                <Row label="PIN sai hôm nay">
                  {tree.pin.failsToday}
                  {tree.pin.lockedUntil ? <div>{`PIN đang bị khoá đến ${fmtDateTime(tree.pin.lockedUntil)}`}</div> : null}
                </Row>
              </tbody>
            </table>
            <label className="lab" htmlFor={noteId}>Ghi chú</label>
            <textarea id={noteId} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row">
              <Button disabled={pending} onClick={() => setAsk('unlock')}>Mở khoá PIN</Button>
              <Button disabled={pending} onClick={() => setAsk('revoke')}>Thu hồi mọi phiên</Button>
              <Button disabled={pending || !note.trim()} onClick={() => setAsk('delete')}>Xoá phòng</Button>
            </div>
            <p className="hint">Xoá phòng theo yêu cầu qua email: chỉ làm khi người gửi đã chứng minh là chủ cây.</p>
          </div>
        </div>
      ) : null}
      {ask ? (
        <ConfirmDialog title={CONFIRM[ask]} confirmLabel="Đồng ý" cancelLabel="Huỷ" onConfirm={() => void run(ask)} onCancel={() => setAsk(null)} />
      ) : null}
    </>
  );
}
