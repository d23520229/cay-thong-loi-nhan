import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { routes } from './App';
import '@fontsource/amatic-sc/vietnamese-700.css';
import '@fontsource/amatic-sc/latin-700.css';
import '@fontsource/mynerve/vietnamese-400.css';
import '@fontsource/mynerve/latin-400.css';
import '@fontsource/grape-nuts/vietnamese-400.css';
import '@fontsource/grape-nuts/latin-400.css';
import './styles/base.css';
import './styles/room-animations.css';
import './styles/app.css';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
