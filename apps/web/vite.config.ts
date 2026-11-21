import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi phát triển: Vite chạy ở cổng 5173, chuyển /api, /og sang server Fastify (cổng 3000).
// Khi triển khai: server phục vụ luôn thư mục dist của web (một tên miền).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000', '/og': 'http://localhost:3000' },
  },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
