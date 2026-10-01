import { defineConfig, devices } from '@playwright/test';

// Override with SMOKE_PORT when several checkouts run smoke tests at the same time.
const PORT = Number(process.env.SMOKE_PORT ?? 4173);
const BASE_PATH = '/Rexi-s-Revenge/';

// Smoke tests run against the production build served by `vite preview`.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    // Never reuse a running server: it might be serving another checkout's build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
