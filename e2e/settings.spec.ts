import { test, expect } from '@playwright/test'
import { apiOrigin, installApiFixture } from './fixtures/api'

test.beforeEach(async ({ page }) => {
  await installApiFixture(page)
})

test('Settings labels, masking, pending and success keep a single submit', async ({ page }) => {
  let calls = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(`${apiOrigin}/api/v1/cameras?**`, async (route) => {
    calls++
    await pending
    await route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 1, total_pages: 0 } })
  })
  await page.goto('/dashboard/settings')
  const key = page.getByLabel('API Key', { exact: true })
  await key.fill('ui-fixture-not-a-credential')
  await expect(key).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Tampilkan', exact: true }).click()
  await expect(key).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Sembunyikan', exact: true }).click()
  await expect(key).toHaveAttribute('type', 'password')
  await key.press('Enter')
  const button = page.getByRole('button', { name: 'Memvalidasi konfigurasi...' })
  await expect(button).toBeDisabled()
  await key.press('Enter')
  expect(calls).toBe(1)
  finish()
  await expect(page.getByRole('alert')).toContainText('Akses API terverifikasi')
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(1)
})

test('Settings reports authorization failure without claiming connected', async ({ page }) => {
  await page.route(`${apiOrigin}/api/v1/cameras?**`, (route) =>
    route.fulfill({ status: 403, json: { detail: 'Forbidden' } }),
  )
  await page.goto('/dashboard/settings')
  await page.getByLabel('API Key', { exact: true }).fill('ui-fixture-not-a-credential')
  await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Scope camera:read dan izin kamera diperlukan')
  await expect(page.getByRole('button', { name: 'Simpan Konfigurasi' })).toBeEnabled()
})

test('Settings migrates the legacy prefix visibly and sends it exactly once', async ({ page }) => {
  await page.addInitScript(origin => { localStorage.setItem('api_base_url', `${origin}/api/v1/`) }, apiOrigin)
  let target = ''
  await page.route(`${apiOrigin}/api/v1/cameras?**`, route => {
    target = route.request().url()
    return route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 1, total_pages: 0 } })
  })
  await page.goto('/dashboard/settings')
  await expect(page.getByText('dipisahkan', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Base URL API')).toHaveValue(apiOrigin)
  await page.getByLabel('API Key', { exact: true }).fill('ui-fixture-not-a-credential')
  await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Akses API terverifikasi')
  expect(target).toBe(`${apiOrigin}/api/v1/cameras?page=1&page_size=1`)
  expect(await page.evaluate(() => localStorage.getItem('api_base_url'))).toBe(apiOrigin)
})

test('Settings rejects arbitrary URL paths without saving or sending credentials', async ({ page }) => {
  const targets: string[] = []
  page.on('request', request => { if (request.url().startsWith(apiOrigin)) targets.push(request.url()) })
  await page.goto('/dashboard/settings')
  await page.getByLabel('Base URL API').fill(`${apiOrigin}/unexpected-path`)
  await page.getByLabel('API Key', { exact: true }).fill('not-to-be-sent-fixture')
  await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Gunakan origin HTTP/HTTPS')
  expect(targets).not.toContain(`${apiOrigin}/unexpected-path`)
  expect(targets.filter(url => !url.includes('/health')).length).toBe(0)
  expect(await page.evaluate(() => localStorage.getItem('api_key'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('api_base_url'))).toBe(apiOrigin)
})

test('a degraded health response is not key verification and carries no API key', async ({ page }) => {
  let key: string | undefined
  await page.route(`${apiOrigin}/health`, route => {
    key = route.request().headers()['x-api-key']
    return route.fulfill({ json: { status: 'degraded', database: 'disconnected', version: 'fixture' } })
  })
  await page.goto('/dashboard/settings')
  await page.getByRole('button', { name: 'Periksa Backend' }).click()
  await expect(page.getByRole('status')).toContainText('kesehatan backend menurun')
  await expect(page.getByText('Akses kamera terverifikasi')).not.toBeVisible()
  expect(key).toBeUndefined()
})

test('changing the saved origin clears a late health result and updates the docs link', async ({ page }) => {
  let started!: () => void
  const healthStarted = new Promise<void>(resolve => { started = resolve })
  let finish!: () => void
  const held = new Promise<void>(resolve => { finish = resolve })
  await page.route(`${apiOrigin}/health`, async route => {
    started()
    await held
    await route.fulfill({ json: { status: 'healthy', database: 'connected', version: 'old-backend' } }).catch(() => {})
  })
  await page.goto('/dashboard/settings')
  await page.getByRole('button', { name: 'Periksa Backend' }).click()
  await healthStarted
  await page.getByLabel('Base URL API').fill('http://new-sivera-ui.test')
  await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
  await expect(page.getByRole('alert')).toContainText('API Key belum disetel')
  finish()
  await expect(page.getByText('old-backend', { exact: false })).not.toBeVisible()
  await expect(page.getByRole('link', { name: '/docs (Swagger UI)' })).toHaveAttribute('href', 'http://new-sivera-ui.test/docs')
  await expect(page.getByRole('status')).not.toBeVisible()
})

test('logout clears the Settings key draft and preserves an invalid origin without a dead docs link', async ({ page }) => {
  const invalidOrigin = `${apiOrigin}/unexpected-path`
  await page.addInitScript(origin => {
    localStorage.setItem('api_base_url', origin)
    localStorage.setItem('api_key', 'ui-fixture-not-a-credential')
  }, invalidOrigin)
  const targets: string[] = []
  page.on('request', request => {
    if (/sivera-ui\.test|localhost:8000/.test(request.url())) targets.push(request.url())
  })
  await page.goto('/dashboard/settings')
  await expect(page.getByText('Gunakan origin HTTP/HTTPS', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dokumentasi API', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '/docs (Swagger UI)' })).toHaveCount(0)
  const key = page.getByLabel('API Key', { exact: true })
  await expect(key).toHaveValue('ui-fixture-not-a-credential')
  await page.getByRole('button', { name: 'Tampilkan', exact: true }).click()
  await page.getByRole('button', { name: 'Keluar', exact: true }).click()
  await expect(key).toHaveValue('')
  await expect(key).toHaveAttribute('type', 'password')
  await expect(page.getByText('Gunakan origin HTTP/HTTPS', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: /Atur API Key/i }).first()).toHaveAttribute('href', '/dashboard/settings')
  expect(await page.evaluate(() => localStorage.getItem('api_base_url'))).toBe(invalidOrigin)
  expect(await page.evaluate(() => localStorage.getItem('api_key'))).toBeNull()
  expect(targets).toEqual([])
})

for (const width of [390, 768, 1440]) {
  test(`Settings reflows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard/settings')
    await expect(page.getByLabel('Base URL API')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `/tmp/opencode/sivera-settings-${width}.png`, fullPage: true })
  })
}
