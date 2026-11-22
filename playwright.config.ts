import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5179'

export default defineConfig({
  testDir: './e2e',
  // Sandbox/CI dev-server + mock-API specs can be slow; allow headroom via env.
  timeout: Number(process.env.PLAYWRIGHT_TEST_TIMEOUT_MS || 60_000),
  expect: { timeout: Number(process.env.PLAYWRIGHT_EXPECT_TIMEOUT_MS || 10_000) },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: Number(process.env.PLAYWRIGHT_WORKERS || 2),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: process.env.PLAYWRIGHT_HEADED !== '1',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL } : {}) } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // An external URL is opt-in; otherwise run this checkout on a dedicated port.
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'bun run dev -- --host 127.0.0.1 --port 5179 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
