import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:8787',
  },
  projects: [{ name: 'chromium', use: { channel: 'chromium' } }],
  webServer: {
    command: 'pnpm run preview:front-office',
    url: 'http://localhost:8787',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
