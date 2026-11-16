// Điểm vào React. Bộ định tuyến và các màn hình sẽ được thêm ở mốc M2 (xem docs/dac-ta-v3.md).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/amatic-sc/vietnamese-700.css';
import '@fontsource/amatic-sc/latin-700.css';
import '@fontsource/mynerve/vietnamese-400.css';
import '@fontsource/mynerve/latin-400.css';
import '@fontsource/grape-nuts/vietnamese-400.css';
import '@fontsource/grape-nuts/latin-400.css';
import './styles/base.css';
import './styles/room-animations.css';

function Placeholder() {
  return (
    <main className="placeholder">
      <h1>Cây Thông Lời Nhắn</h1>
      <p>Đang xây dựng. Bản thiết kế nằm trong tools/design-canvas.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Placeholder />
  </StrictMode>,
);
