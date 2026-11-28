import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { routes } from './App';
// Dùng file theo độ đậm (có unicode-range cho từng bộ chữ). File theo bộ chữ
// (vietnamese-400.css…) không có unicode-range nên bộ latin đè bộ vietnamese.
import '@fontsource/amatic-sc/700.css';
import '@fontsource/mynerve/400.css';
import '@fontsource/grape-nuts/400.css';
import './styles/base.css';
import './styles/room-animations.css';
import './styles/app.css';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
