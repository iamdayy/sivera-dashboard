import { test, expect } from '@playwright/test'

test('root CTA opens the dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Estimasi sampah dari kamera')
  await page.getByRole('main').getByRole('link', { name: 'Buka Dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Ringkasan', exact: true })).toBeVisible()
})
