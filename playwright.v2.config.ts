import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests-v2/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    viewport: { width: 1366, height: 800 },
    headless: true,
  },
  webServer: {
    command: process.env.E2E_WEB_SERVER || 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
