import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke tests. They hit the live Yahoo Finance API through the local FastAPI
 * service, so they run on a schedule / on demand rather than on every push.
 * Set E2E_BASE_URL to point at a deployed frontend instead of starting the dev servers.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'cd api && uv run uvicorn app.main:app --port 8000',
          url: 'http://localhost:8000/health',
          reuseExistingServer: true,
          timeout: 90_000,
        },
        {
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: true,
          timeout: 90_000,
        },
      ],
})
