import { defineConfig } from '@playwright/test';
import { SERVERS, e2eDbUrl } from './servers';

const SECRET = 'e2e-'.padEnd(40, 'x');

export default defineConfig({
  testDir: '.',
  outputDir: './.out/results',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-mobile', use: { browserName: 'chromium' } }],
  webServer: Object.values(SERVERS).map((s) => ({
    command: 'node apps/server/dist/index.js',
    cwd: '..',
    url: `http://localhost:${s.port}/api/config`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(s.port),
      FAKE_NOW: s.fakeNow,
      DATABASE_URL: e2eDbUrl(),
      WEB_DIST: 'apps/web/dist',
      BASE_URL: `http://localhost:${s.port}`,
      PHOTO_DIR: 'e2e/.out/photos',
      PEPPER: SECRET,
      BLOCK_IP_KEY: SECRET,
      SUPPORT_EMAIL: 'hotro@e2e.vn',
    },
  })),
});
