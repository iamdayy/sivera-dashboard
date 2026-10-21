import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5179'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: process.env.PLAYWRIGHT_HEADED !== '1',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // An external URL is opt-in; otherwise run this checkout on a dedicated port.
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'bun run dev -- --host 127.0.0.1 --port 5179 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
})
