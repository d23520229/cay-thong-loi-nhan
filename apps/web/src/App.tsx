import { Link } from 'react-router';
import type { RouteObject } from 'react-router';
import { CreatePage } from './routes/CreatePage';
import { Home } from './routes/Home';
import { RoomPage } from './routes/RoomPage';

export function NotFound() {
  return (
    <main className="placeholder">
      <h1>Không tìm thấy trang</h1>
      <Link to="/" className="btn btn-primary">Về trang chủ</Link>
    </main>
  );
}

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/tao', element: <CreatePage /> },
  { path: '/c/:id', element: <RoomPage /> },
  // Trang quản trị tải riêng (gói JS khác): khách và chủ cây không phải tải (đặc tả 6.8).
  { path: '/quan-tri/*', lazy: () => import('./admin/AdminApp').then((m) => ({ Component: m.AdminApp })) },
  { path: '*', element: <NotFound /> },
];
