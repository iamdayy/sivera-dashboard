import { test, expect, type Page } from '@playwright/test'
import { installApiFixture } from './fixtures/api'

async function checkTargets(page: Page, selector = 'header a, header button') {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations()
      .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map(animation => animation.finished.catch(() => {})))
  })
  const targets = await page.locator(selector).evaluateAll(elements =>
    elements.map(element => {
      const box = element.getBoundingClientRect()
      let clipped = { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      let parent = element.parentElement
      while (parent) {
        const style = getComputedStyle(parent)
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) {
          const parentBox = parent.getBoundingClientRect()
          clipped = {
            left: Math.max(clipped.left, parentBox.left),
            right: Math.min(clipped.right, parentBox.right),
            top: Math.max(clipped.top, parentBox.top),
            bottom: Math.min(clipped.bottom, parentBox.bottom),
          }
        }
        parent = parent.parentElement
      }
      return {
        label: element.getAttribute('aria-label') || element.textContent?.trim(),
        ...clipped,
        width: clipped.right - clipped.left,
        height: clipped.bottom - clipped.top,
      }
    }).filter(target => target.width > 0 && target.height > 0),
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

async function expectDrawerClosed(page: Page) {
  const sidebar = page.locator('#sidebar')
  await expect(sidebar).toHaveAttribute('aria-hidden', 'true')
  expect(await sidebar.evaluate(element => (element as HTMLElement).inert)).toBe(true)
}

async function expectDrawerOpen(page: Page) {
  const sidebar = page.locator('#sidebar')
  await expect(sidebar).toBeVisible()
  await expect(sidebar).not.toHaveAttribute('aria-hidden', 'true')
  expect(await sidebar.evaluate(element => (element as HTMLElement).inert)).toBe(false)
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

    if (width < 1024) {
      await expectDrawerClosed(page)
      await page.getByRole('button', { name: 'Buka menu navigasi' }).click()
      await expectDrawerOpen(page)
      await expect(page.locator('#sidebar').getByRole('link', { name: 'Ringkasan', exact: true })).toBeVisible()
      await checkTargets(page, '#sidebar a[href], #sidebar button')
      await page.keyboard.press('Escape')
      await expectDrawerClosed(page)
    }

    await page.locator('header').getByRole('button', { name: 'Keluar', exact: true }).click()
    await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('')
    await checkTargets(page)
    await expect(page.locator('header').getByRole('link', { name: 'Atur API Key', exact: true })).toHaveAttribute('href', '/dashboard/settings')
  })
}

test('mobile drawer traps focus, closes with Escape and restores the trigger', async ({ page }) => {
  await installApiFixture(page, true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')

  const trigger = page.getByRole('button', { name: 'Buka menu navigasi' })
  const sidebar = page.locator('#sidebar')
  const close = page.getByRole('button', { name: 'Tutup menu navigasi' })
  const lastLink = sidebar.getByRole('link', { name: 'Kelola API Key' })

  await expectDrawerClosed(page)
  await trigger.focus()
  await trigger.press('Enter')
  await expectDrawerOpen(page)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(close).toBeFocused()

  await page.keyboard.press('Shift+Tab')
  await expect(lastLink).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()

  await page.keyboard.press('Escape')
  await expectDrawerClosed(page)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
})

test('mobile drawer navigation uses real routes, closes and restores focus', async ({ page }) => {
  await installApiFixture(page, true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')

  const trigger = page.getByRole('button', { name: 'Buka menu navigasi' })
  const sidebar = page.locator('#sidebar')

  await trigger.click()
  await expectDrawerOpen(page)
  await sidebar.getByRole('link', { name: 'Pengaturan', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/settings$/)
  await expectDrawerClosed(page)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expectDrawerOpen(page)
  await sidebar.getByRole('link', { name: 'Ringkasan', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expectDrawerClosed(page)
  await expect(trigger).toBeFocused()
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
    if (width < 1024) {
      await page.getByRole('button', { name: 'Buka menu navigasi' }).click()
      await expectDrawerOpen(page)
      await checkTargets(page, '#sidebar a[href], #sidebar button')
    }
  })
}
