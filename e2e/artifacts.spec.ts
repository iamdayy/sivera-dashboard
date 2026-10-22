import { test, expect } from '@playwright/test'
import { apiOrigin, calibration, camera, installApiFixture } from './fixtures/api'

const previewPath = `${apiOrigin}/api/v1/cameras/${camera.id}/calibrations/${calibration.id}/undistort-preview`
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fkAAAAASUVORK5CYII=', 'base64')

test.beforeEach(async ({ page }) => {
  await installApiFixture(page, true, [camera])
  await page.route(previewPath, route => route.fulfill({ json: {
    preview_url: `${apiOrigin}/files/authenticated-preview.png`,
    original_size: [1920, 1080], undistorted_size: [1920, 1080], k_undist: calibration.k_matrix,
  } }))
})

test('calibration previews fetch with a header key and expose only a decoded object URL', async ({ page }) => {
  let key: string | undefined
  await page.route(`${apiOrigin}/files/authenticated-preview.png`, route => {
    key = route.request().headers()['x-api-key']
    return route.fulfill({ contentType: 'image/png', body: image })
  })
  await page.goto('/dashboard/calibrations')
  await page.evaluate(() => { window.open = () => null })
  await page.getByRole('button', { name: 'Preview kalibrasi v1', exact: true }).click()
  const link = page.getByRole('link', { name: 'Buka Preview v1', exact: true })
  await expect(link).toHaveAttribute('href', /^blob:/)
  expect(key).toBe('ui-fixture-not-a-credential')
  expect(await link.evaluate(async (element: HTMLAnchorElement) => {
    const img = new Image()
    img.src = element.href
    await img.decode()
    return img.naturalWidth > 0 && img.naturalHeight > 0
  })).toBe(true)
})

test('a redirect cannot forward the API key or produce a successful preview', async ({ page }) => {
  const external: string[] = []
  await page.route('http://untrusted-artifact.test/**', route => {
    external.push(route.request().url())
    return route.fulfill({ contentType: 'image/png', body: image })
  })
  await page.route(`${apiOrigin}/files/authenticated-preview.png`, route => route.fulfill({
    status: 302, headers: { Location: 'http://untrusted-artifact.test/image.png' },
  }))
  await page.goto('/dashboard/calibrations')
  await page.getByRole('button', { name: 'Preview kalibrasi v1', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Gagal memuat preview')
  await expect(page.getByRole('link', { name: 'Buka Preview v1', exact: true })).not.toBeVisible()
  expect(external).toEqual([])
})

test('binary JSON errors retain the machine-specific message and never become preview URLs', async ({ page }) => {
  await page.route(`${apiOrigin}/files/authenticated-preview.png`, route => route.fulfill({ status: 409, json: { detail: { code: 'calibration_intrinsics_missing' } } }))
  await page.goto('/dashboard/calibrations')
  await page.getByRole('button', { name: 'Preview kalibrasi v1', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Lakukan kalibrasi ulang')
  await expect(page.getByRole('link', { name: 'Buka Preview v1', exact: true })).not.toBeVisible()
})
