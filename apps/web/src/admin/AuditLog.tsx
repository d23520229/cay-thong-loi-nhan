import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { adminApi, type AuditItem } from './adminApi';
import { useAdmin } from './context';
import { fmtDateTime } from './format';

const ACTION: Record<string, string> = {
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  report_resolve: 'Xử lý báo cáo',
  tree_delete: 'Xoá phòng',
  sessions_revoke: 'Thu hồi phiên',
  pin_unlock: 'Mở khoá PIN',
};

/** Nhật ký thao tác (đặc tả 6.8.6): mới nhất trước, "Xem thêm" để tải trang sau. */
export function AuditLog() {
  const { onError } = useAdmin();
  const [items, setItems] = useState<AuditItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const load = async (before?: string) => {
    setPending(true);
    try {
      const r = await adminApi.audit(before);
      setItems((cur) => (before && cur ? [...cur, ...r.items] : r.items));
      setNext(r.nextBefore);
    } catch (e) {
      setError(onError(e));
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h1>Nhật ký</h1>
      {error ? <div className="notice" role="alert">{error}</div> : null}
      {items === null ? <p className="hint">Đang tải…</p> : (
        <table className="adm-table">
          <thead>
            <tr><th>Lúc</th><th>Ai</th><th>Việc</th><th>Đối tượng</th><th>Ghi chú</th></tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{fmtDateTime(r.at)}</td>
                <td>{r.email ?? '—'}</td>
                <td>{ACTION[r.action] ?? r.action}</td>
                <td>{r.targetType ? `${r.targetType} ${r.targetId ?? ''}` : '—'}</td>
                <td>{r.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {next ? <Button disabled={pending} onClick={() => void load(next)}>Xem thêm</Button> : null}
    </>
  );
}
