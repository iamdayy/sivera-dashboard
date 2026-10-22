import { test, expect, type Page } from '@playwright/test'
import { installApiFixture } from './fixtures/api'

async function checkTargets(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations()
      .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map(animation => animation.finished.catch(() => {})))
  })
  const targets = await page.locator('header a, header button').evaluateAll(elements =>
    elements.filter(element => element.getBoundingClientRect().width > 0).map(element => {
      const box = element.getBoundingClientRect()
      return {
        label: element.getAttribute('aria-label') || element.textContent?.trim(),
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      }
    }),
  )
  const width = page.viewportSize()!.width
  for (const target of targets) {
    expect(target.width, `${target.label}: touch width`).toBeGreaterThanOrEqual(44)
    expect(target.height, `${target.label}: touch height`).toBeGreaterThanOrEqual(44)
    expect(target.left, `${target.label}: left edge`).toBeGreaterThanOrEqual(0)
    expect(target.right, `${target.label}: right edge`).toBeLessThanOrEqual(width)
  }
  for (let i = 0; i < targets.length; i++) {
    for (const other of targets.slice(i + 1)) {
      const target = targets[i]!
      const overlaps = Math.min(target.right, other.right) > Math.max(target.left, other.left)
        && Math.min(target.bottom, other.bottom) > Math.max(target.top, other.top)
      expect(overlaps, `${target.label} overlaps ${other.label}`).toBe(false)
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

for (const width of [320, 390, 600, 768, 1024, 1440]) {
  test(`header targets fit with stored, verified and cleared keys at ${width}px`, async ({ page }) => {
    await installApiFixture(page, true)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard/settings')
    await checkTargets(page)
    await page.getByRole('button', { name: 'Simpan Konfigurasi' }).click()
    await expect(page.getByRole('alert')).toContainText('Akses camera:read terverifikasi')
    await checkTargets(page)
    if (width < 768) {
      await page.getByRole('button', { name: 'Buka menu navigasi' }).click()
      await expect(page.getByRole('menuitem', { name: 'Dashboard', exact: true })).toBeVisible()
      await checkTargets(page)
      await page.keyboard.press('Escape')
      await expect(page.locator('#mobile-menu')).not.toBeVisible()
    }
    await page.locator('header').getByRole('button', { name: 'Keluar', exact: true }).click()
    await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('')
    await checkTargets(page)
    await expect(page.getByRole('link', { name: 'Masuk / Atur API Key' })).toHaveAttribute('href', '/dashboard/settings')
  })
}

test('mobile menu supports keyboard navigation, same-route dismissal and logout focus', async ({ page }) => {
  await installApiFixture(page, true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard/settings')
  const trigger = page.getByRole('button', { name: 'Buka menu navigasi' })
  const menu = page.locator('#mobile-menu')
  await trigger.focus()
  await trigger.press('Space')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const home = page.getByRole('menuitem', { name: 'Beranda', exact: true })
  const dashboard = page.getByRole('menuitem', { name: 'Dashboard', exact: true })
  await expect(menu).toHaveAttribute('aria-activedescendant', await home.getAttribute('id') as string)
  await page.keyboard.press('ArrowDown')
  await expect(menu).toHaveAttribute('aria-activedescendant', await dashboard.getAttribute('id') as string)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await dashboard.click()
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.press('Enter')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.press('Space')
  await expect(menu).toBeVisible()
  await page.keyboard.press('End')
  const logout = page.getByRole('menuitem', { name: 'Keluar', exact: true })
  await expect(menu).toHaveAttribute('aria-activedescendant', await logout.getAttribute('id') as string)
  await page.keyboard.press('Enter')
  await expect(menu).not.toBeVisible()
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => localStorage.getItem('api_key'))).toBeNull()
  await page.getByRole('link', { name: 'Masuk / Atur API Key' }).press('Enter')
  await expect(page).toHaveURL(/\/dashboard\/settings$/)
})

for (const width of [390, 768, 1280]) {
  test(`header reflows with 200% text at ${width}px`, async ({ page }) => {
    await installApiFixture(page, true)
    await page.setViewportSize({ width, height: 600 })
    await page.goto('/dashboard/settings')
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    await checkTargets(page)
    await page.locator('header').getByRole('button', { name: 'Keluar', exact: true }).click()
    await checkTargets(page)
  })
}
