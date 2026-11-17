import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Xử lý CSS trong src/styles để test đọc được nội dung qua `?raw`.
  test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'], css: { include: [/src\/styles\/.*\.css/] } },
});
