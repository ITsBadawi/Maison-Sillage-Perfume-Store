import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: process.env.RUN_SUPABASE_E2E === '1' ? 3 : undefined,
  use: {baseURL: 'http://127.0.0.1:3000', ...devices['Desktop Chrome']},
  webServer: {command: 'npm run dev', url: 'http://127.0.0.1:3000/ar', reuseExistingServer: !process.env.CI, timeout: 120_000},
});
