import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { adminApi, type Overview as O } from './adminApi';
import { useAdmin } from './context';
import { fmtBytes, fmtCountdown, fmtDateTime, fmtTime } from './format';

const PHASE: Record<string, string> = {
  BUILD: 'Đang trang trí',
  OPEN: 'Đang mở quà',
  NOTICE: 'Sắp đóng (nhắc tải ảnh)',
  ENDED: 'Đã kết thúc',
};
const NEXT: Record<string, string> = {
  unlockAt: 'Mở quà',
  writeClosesAt: 'Ngừng nhận thay đổi',
  serviceEndsAt: 'Kết thúc dịch vụ',
  purgeAt: 'Xoá dữ liệu',
};
const REFRESH_MS = 60_000;

function Card({ label, big, sub }: { label: string; big: ReactNode; sub?: ReactNode }) {
  return (
    <div className="adm-card">
      <div className="lab">{label}</div>
      <div className="big">{big}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

/** Tổng quan (đặc tả 6.8.3): người dùng + máy chủ, tự tải lại mỗi 60 giây. */
export function Overview() {
  const { onError } = useAdmin();
  const [o, setO] = useState<O | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () =>
      adminApi.overview().then(
        (d) => { if (alive) { setO(d); setError(''); } },
        (e: unknown) => { if (alive) setError(onError(e)); },
      );
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, [onError]);

  if (!o) return <>{error ? <div className="notice" role="alert">{error}</div> : <p className="hint">Đang tải…</p>}</>;
  const { users: u, server: s } = o;
  const fresh = Date.parse(o.now) - Date.parse(s.latencySince) < 59 * 60_000;

  return (
    <>
      <h1>Tổng quan</h1>
      {error ? <div className="notice" role="alert">{error}</div> : null}
      <div className="adm-cards">
        <Card label="Giai đoạn" big={PHASE[o.phase] ?? o.phase} sub={o.next ? `${NEXT[o.next.key]} còn ${fmtCountdown(o.now, o.next.at)}` : undefined} />
        <Card label="Báo cáo đang chờ" big={<Link to="/quan-tri/bao-cao">{u.openReports}</Link>} />
      </div>

      <h2>Người dùng</h2>
      <div className="adm-cards">
        <Card label="Phòng" big={u.trees.total} sub={`+${u.trees.last24h} trong 24 giờ`} />
        <Card label="Lời nhắn" big={u.messages.total} sub={`+${u.messages.last24h} trong 24 giờ`} />
        <Card label="Lượt xem của khách" big={u.views.total} sub={`+${u.views.last24h} trong 24 giờ`} />
        <Card label="Hệ số lan truyền" big={u.viral === null ? '—' : u.viral.toFixed(2).replace('.', ',')} sub="phòng tạo từ lời mời / tổng phòng" />
      </div>

      <h2>Máy chủ</h2>
      <div className="adm-cards">
        <Card
          label="Lỗi 5xx trong 24 giờ"
          big={s.errors24h}
          sub={s.lastError ? `${s.lastError.status} · ${s.lastError.route ?? '(không rõ route)'} · lúc ${fmtDateTime(s.lastError.at)}` : 'Không có lỗi'}
        />
        <Card
          label="Độ chậm p95 (60 phút)"
          big={s.p95Ms === null ? 'chưa có số liệu' : `${Math.round(s.p95Ms)} ms`}
          sub={fresh ? `từ ${fmtTime(s.latencySince)} (lúc khởi động)` : undefined}
        />
        <Card label="Dung lượng CSDL" big={`${fmtBytes(s.dbBytes)} / ${fmtBytes(s.dbQuotaBytes)}`} />
        <Card
          label="Kho ảnh"
          big={`${s.photos.count} ảnh · ${fmtBytes(s.photos.bytes)}`}
          sub={
            <>
              {s.photos.unknown > 0 ? <div>{`${s.photos.unknown} ảnh chưa rõ dung lượng`}</div> : null}
              <div>{`${s.photos.reportSnapshots} ảnh chụp trong báo cáo`}</div>
            </>
          }
        />
      </div>
      {s.azureUrl ? (
        <p><a href={s.azureUrl} target="_blank" rel="noreferrer">Mở Azure Portal (CPU, bộ nhớ, chi phí)</a></p>
      ) : null}
    </>
  );
}
