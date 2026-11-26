import { Link, Outlet } from 'react-router';
import type { RouteObject } from 'react-router';
import { useConfig } from './lib/config';
import { useServiceEnded } from './lib/ended';
import { CreatePage } from './routes/CreatePage';
import { EndedPage } from './routes/EndedPage';
import { Home } from './routes/Home';
import { RoomPage } from './routes/RoomPage';
import { PhaseBanner } from './ui/PhaseBanner';

export function NotFound() {
  return (
    <main className="placeholder">
      <h1>Không tìm thấy trang</h1>
      <Link to="/" className="btn btn-primary">Về trang chủ</Link>
    </main>
  );
}

/** Khung các trang công khai: biểu ngữ ở NOTICE, cả trang thành trang kết thúc ở ENDED (đặc tả 6.9.1). */
function AppShell() {
  const config = useConfig();
  const ended = useServiceEnded();
  if (ended || config?.phase === 'ENDED') return <EndedPage />;
  return (
    <>
      <PhaseBanner />
      <Outlet />
    </>
  );
}

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/tao', element: <CreatePage /> },
      { path: '/c/:id', element: <RoomPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  // Chính sách: gói riêng, vẫn đọc được sau ENDED (trang kết thúc có link tới đây — đặc tả 6.9.2).
  { path: '/chinh-sach', lazy: () => import('./routes/PolicyPage').then((m) => ({ Component: m.PolicyPage })) },
  // Trang quản trị tải riêng (gói JS khác): khách và chủ cây không phải tải (đặc tả 6.8); vẫn chạy sau ENDED.
  { path: '/quan-tri/*', lazy: () => import('./admin/AdminApp').then((m) => ({ Component: m.AdminApp })) },
];
