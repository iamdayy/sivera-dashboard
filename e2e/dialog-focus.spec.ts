import { expect, test, type Locator } from '@playwright/test'
import { camera, installApiFixture } from './fixtures/api'

async function expectFocusRingVisible(target: Locator) {
  await expect(target).toBeFocused()
  await expect(target).toBeInViewport({ ratio: 1 })
  await expect.poll(() => target.evaluate(element => {
    const style = getComputedStyle(element)
    const ring = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset))
    if (style.outlineStyle === 'none' || ring < 2) return false
    const box = element.getBoundingClientRect()
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (!['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(ancestor).overflowY)) continue
      const bounds = ancestor.getBoundingClientRect()
      if (box.top - ring < bounds.top || box.bottom + ring > bounds.bottom) return false
    }
    return true
  })).toBe(true)
}

for (const width of [390, 768, 1440]) {
  for (const domain of ['cameras', 'calibrations'] as const) {
    test(`setup ${domain} keeps the focused field and footer ring visible at ${width}px (mock API)`, async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => {
        if (['error', 'warning'].includes(message.type())) errors.push(message.text())
      })
      await installApiFixture(page, true, [camera])
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`/dashboard/${domain}`)
      const trigger = page.getByRole('main').getByRole('button', { name: domain === 'cameras' ? 'Tambah Kamera' : 'Buat Kalibrasi Baru', exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByLabel(domain === 'cameras' ? 'Nama Kamera' : 'Chessboard Cols', { exact: true })).toBeFocused()
      await page.keyboard.press('Tab')
      const field = dialog.getByLabel(domain === 'cameras' ? 'Longitude' : 'Gambar chessboard', { exact: true })
      const save = dialog.getByRole('button', { name: domain === 'cameras' ? 'Tambah Kamera' : 'Buat Kalibrasi', exact: true })
      for (const textScale of [100, 200]) {
        await page.setViewportSize({ width, height: 900 })
        await page.addStyleTag({ content: `html { font-size: ${textScale}%; }` })
        await dialog.getByLabel(domain === 'cameras' ? 'Nama Kamera' : 'Chessboard Cols', { exact: true }).focus()
        await page.setViewportSize({ width, height: 420 })
        await field.focus()
        await expectFocusRingVisible(field)
        await page.screenshot({ path: testInfo.outputPath(`field-${textScale}.png`) })
        await save.focus()
        await expectFocusRingVisible(save)
        await page.screenshot({ path: testInfo.outputPath(`footer-${textScale}.png`) })
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      expect(errors).toEqual([])
    })
  }
}
