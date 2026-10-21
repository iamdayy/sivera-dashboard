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
  await page.route(`${apiOrigin}/cameras?**`, async (route) => {
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
  await page.route(`${apiOrigin}/cameras?**`, (route) =>
    route.fulfill({ status: 403, json: { detail: 'Forbidden' } }),
  )
  await page.goto('/dashboard/settings')
  await page.getByLabel('API Key', { exact: true }).fill('ui-fixture-not-a-credential')
  await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
  await expect(page.getByRole('alert')).toContainText('scope camera:read diperlukan')
  await expect(page.getByRole('button', { name: 'Simpan Konfigurasi' })).toBeEnabled()
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
