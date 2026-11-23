import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { ApiError } from '../lib/api';
import { adminApi, type Me } from './adminApi';
import { AdminLogin } from './AdminLogin';
import { AdminContext, type AdminCtx } from './context';
import { Overview } from './Overview';
import { Reports } from './Reports';
import { TreeLookup } from './TreeLookup';
import { AuditLog } from './AuditLog';
import './admin.css';

/** Trang quản trị `/quan-tri/*` (đặc tả 6.8): tải riêng (lazy), chỉ chủ dự án dùng. */
export function AdminApp() {
  // undefined = đang hỏi phiên; null = chưa đăng nhập.
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [openReports, setOpenReports] = useState<number | null>(null);

  // Trang quản trị không cho máy tìm kiếm lập chỉ mục.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let alive = true;
    adminApi.me().then(
      (m) => { if (alive) setMe(m); },
      () => { if (alive) setMe(null); },
    );
    return () => { alive = false; };
  }, []);

  const onError = useCallback((e: unknown): string => {
    if (e instanceof ApiError && e.status === 401) {
      setMe(null);
      return 'Phiên đăng nhập đã hết, đăng nhập lại nhé.';
    }
    return e instanceof ApiError ? e.message : 'Có lỗi xảy ra, thử lại sau nhé.';
  }, []);

  const refreshCount = useCallback(() => {
    adminApi.overview().then((o) => setOpenReports(o.users.openReports), onError);
  }, [onError]);

  useEffect(() => {
    if (me) refreshCount();
  }, [me, refreshCount]);

  const ctx = useMemo<AdminCtx | null>(() => (me ? { email: me.email, onError, refreshCount } : null), [me, onError, refreshCount]);

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {
      /* phiên đã hết thì cũng coi như đã đăng xuất */
    }
    setMe(null);
  };

  if (me === undefined) return <main className="adm-login"><p className="hint">Đang tải…</p></main>;
  if (me === null || !ctx) return <AdminLogin onLoggedIn={setMe} />;

  return (
    <AdminContext.Provider value={ctx}>
      <div className="adm">
        <nav className="adm-nav" aria-label="Quản trị">
          <NavLink to="/quan-tri" end>Tổng quan</NavLink>
          <NavLink to="/quan-tri/bao-cao">
            Báo cáo{openReports ? <span className="adm-badge"> {openReports}</span> : null}
          </NavLink>
          <NavLink to="/quan-tri/phong">Tra cứu phòng</NavLink>
          <NavLink to="/quan-tri/nhat-ky">Nhật ký</NavLink>
          <div className="adm-who">
            <span>{me.email}</span>
            <button type="button" className="linkbtn" onClick={() => void logout()}>Đăng xuất</button>
          </div>
        </nav>
        <main className="adm-main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="bao-cao" element={<Reports />} />
            <Route path="phong" element={<TreeLookup />} />
            <Route path="nhat-ky" element={<AuditLog />} />
          </Routes>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
