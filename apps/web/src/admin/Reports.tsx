import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../lib/api';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { adminApi, type AdminReport, type ResolveAction } from './adminApi';
import { useAdmin } from './context';
import { fmtDateTime } from './format';

type Tab = 'open' | 'handled';
const RESOLUTION: Record<string, string> = {
  message_deleted: 'Đã xoá lời nhắn',
  tree_deleted: 'Đã xoá phòng',
  device_blocked: 'Đã chặn thiết bị',
  no_action: 'Bỏ qua',
};
const CONFIRM: Partial<Record<ResolveAction, string>> = {
  delete_message: 'Xoá lời nhắn này? Không lấy lại được.',
  delete_tree: 'Xoá cả phòng và mọi lời nhắn? Không lấy lại được.',
};
const NOTE_MAX = 450;

const who = (r: AdminReport) => (r.reporter === 'owner' ? 'Chủ cây' : 'Khách');
const gist = (r: AdminReport) => r.snapshot ?? r.reason ?? 'Báo cáo cả phòng';

/** Hàng đợi báo cáo (đặc tả 6.8.4). */
export function Reports() {
  const { onError, refreshCount } = useAdmin();
  const noteId = useId();
  const [tab, setTab] = useState<Tab>('open');
  const [items, setItems] = useState<AdminReport[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<ResolveAction | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    (t: Tab) =>
      adminApi.reports(t).then(
        (r) => setItems(r.items),
        (e: unknown) => setError(onError(e)),
      ),
    [onError],
  );
  useEffect(() => {
    setItems(null);
    setSel(null);
    void load(tab);
  }, [tab, load]);

  const cur = items?.find((r) => r.id === sel) ?? null;
  const ready = note.trim().length > 0 && !pending;

  const run = async (action: ResolveAction) => {
    if (!cur) return;
    setAsk(null);
    setPending(true);
    setError('');
    try {
      await adminApi.resolve(cur.id, action, note.trim());
      setSel(null);
      setNote('');
      refreshCount();
      // Xoá phòng kéo theo mọi báo cáo khác của phòng đó: tải lại thay vì chỉ bỏ một dòng.
      if (action === 'delete_tree') void load(tab);
      else setItems((list) => list?.filter((r) => r.id !== cur.id) ?? null);
    } catch (e) {
      setError(onError(e));
      // Trạng thái đã đổi ở nơi khác (đã xử lý, lời nhắn / phòng đã bị xoá): tải lại cho đúng.
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        if (e.code === 'already_handled' || e.status === 404) setSel(null);
        void load(tab);
        refreshCount();
      }
    } finally {
      setPending(false);
    }
  };
  const act = (a: ResolveAction) => (CONFIRM[a] ? setAsk(a) : void run(a));

  return (
    <>
      <h1>Báo cáo</h1>
      <div className="row">
        <button type="button" className="chip" aria-pressed={tab === 'open'} onClick={() => setTab('open')}>Đang chờ</button>
        <button type="button" className="chip" aria-pressed={tab === 'handled'} onClick={() => setTab('handled')}>Đã xử lý</button>
      </div>
      {error ? <div className="notice" role="alert">{error}</div> : null}
      {items === null ? <p className="hint">Đang tải…</p> : items.length === 0 ? <p className="hint">Không có báo cáo nào.</p> : (
        <div className="adm-split">
          <div className="adm-list">
            {items.map((r) => (
              <button key={r.id} type="button" className="adm-item" aria-pressed={r.id === sel} onClick={() => { setSel(r.id); setNote(''); setError(''); }}>
                <div className="hint">{`${who(r)} · ${r.treeId} · ${fmtDateTime(r.createdAt)}`}</div>
                <div>{gist(r)}</div>
              </button>
            ))}
          </div>
          {cur ? (
            <section className="adm-detail" aria-label="Chi tiết báo cáo">
              <div className="hint">{`#${cur.id} · ${who(cur)} báo cáo lúc ${fmtDateTime(cur.createdAt)}`}</div>
              <div>Phòng: <Link to={`/quan-tri/phong?id=${encodeURIComponent(cur.treeId)}`}>{cur.treeId}</Link></div>
              {cur.reason ? <div>Lý do: {cur.reason}</div> : null}
              {cur.messageId === null ? <div className="hint">Báo cáo cả phòng (không gắn lời nhắn)</div> : (
                <>
                  <div className="adm-quote">{cur.snapshot ?? ''}</div>
                  {cur.hasPhoto ? <img src={adminApi.reportPhotoUrl(cur.id)} alt="Ảnh kèm lời nhắn bị báo cáo" /> : null}
                  {!cur.messageExists ? <div className="hint">Lời nhắn đã bị xoá</div> : null}
                </>
              )}
              {cur.status === 'open' ? (
                <>
                  <label className="lab" htmlFor={noteId}>Ghi chú</label>
                  <textarea id={noteId} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="row">
                    {cur.messageId !== null ? (
                      <Button disabled={!ready || !cur.messageExists} onClick={() => act('delete_message')}>Xoá lời nhắn</Button>
                    ) : null}
                    <Button disabled={!ready} onClick={() => act('delete_tree')}>Xoá phòng</Button>
                    <Button variant="primary" disabled={!ready} onClick={() => act('dismiss')}>Bỏ qua</Button>
                  </div>
                </>
              ) : (
                <>
                  <div>{`${cur.resolution ? RESOLUTION[cur.resolution] ?? cur.resolution : cur.status}${cur.handledAt ? ` · lúc ${fmtDateTime(cur.handledAt)}` : ''}`}</div>
                  {cur.note ? <div className="adm-quote">{cur.note}</div> : null}
                </>
              )}
            </section>
          ) : null}
        </div>
      )}
      {ask ? (
        <ConfirmDialog
          title={CONFIRM[ask]!}
          confirmLabel="Xoá"
          cancelLabel="Huỷ"
          onConfirm={() => void run(ask)}
          onCancel={() => setAsk(null)}
        />
      ) : null}
    </>
  );
}
