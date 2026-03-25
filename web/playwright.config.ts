import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  baseURL: 'http://localhost:3001',
  use: { headless: true },
  webServer: {
    command: 'pnpm dev --port 3001',
    port: 3001,
    reuseExistingServer: true,
  },
});
