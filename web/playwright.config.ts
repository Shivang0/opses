import { defineConfig, devices } from '@playwright/test'

// OPSES QA — dynamic testing of the built app served by `vite preview` on :4173.
// The preview server is started/stopped by the QA workflow (not webServer here) so
// it can be shared with other stages without Playwright owning its lifecycle.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
