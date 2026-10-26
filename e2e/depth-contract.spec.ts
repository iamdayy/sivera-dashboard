import { expect, test } from '@playwright/test'
import { apiOrigin, camera, depthScale, groundModel, groundRef, installApiFixture } from './fixtures/api'

for (const width of [390, 768, 1280]) {
  test(`uploaded depth image is sent with its measurements at ${width}px (mock API)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await installApiFixture(page, true, [camera])
    const prefix = `/api/v1/cameras/${camera.id}/ground-models/${groundModel.id}/depth-scales`
    const source = `cameras/${camera.id}/depth-scale-images/${groundModel.id}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/source.image`
    let preview = Buffer.alloc(0)
    const bodies: unknown[] = []
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(`${apiOrigin}/api/v1/cameras/**`, async route => {
      const request = route.request()
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
      const path = new URL(request.url()).pathname
      if (path.endsWith('/ground-models/active')) return route.fulfill({ json: groundModel })
      if (path.endsWith('/ground-references/active')) return route.fulfill({ json: groundRef })
      if (path === prefix + '/active') return route.fulfill({ json: depthScale })
      if (path === prefix && request.method() === 'GET') return route.fulfill({ json: { items: [depthScale], total: 1 } })
      if (path === prefix && request.method() === 'POST') {
        bodies.push(request.postDataJSON())
        return route.fulfill({ status: 201, json: depthScale })
      }
      if (path === prefix + '/test-images') return route.fulfill({ status: 201, json: {
        image_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', test_image: source,
        image_url: apiOrigin + prefix + '/test-images/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/image',
        width: 1920, height: 1080, coordinate_system: 'undistorted_pixels', distance_type: 'camera_axis_z_m',
      } })
      if (path.endsWith('/image') && path.includes('/test-images/')) {
        expect(request.headers()['x-api-key']).toBeTruthy()
        return route.fulfill({ contentType: 'image/png', body: preview })
      }
      return route.fallback()
    })
    await page.goto(`/dashboard/depth-scales?camera=${camera.id}`)
    const data = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      canvas.getContext('2d')!.fillRect(0, 0, 1920, 1080)
      return canvas.toDataURL('image/png').split(',')[1]!
    })
    preview = Buffer.from(data, 'base64')
    await page.getByRole('button', { name: 'Buat Skala Baru', exact: true }).click()
    const submit = page.getByRole('button', { name: 'Hitung dan Aktifkan', exact: true })
    await expect(submit).toBeDisabled()
    await page.locator('#depth-image').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: preview })
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: 'Tambah Titik Manual' }).click()
      await page.getByLabel(`X titik ${i} (pixel)`, { exact: true }).fill(String(i * 10))
      await page.getByLabel(`Y titik ${i} (pixel)`, { exact: true }).fill('20')
      await page.getByLabel(`Kedalaman Z titik ${i} (m)`, { exact: true }).fill(String(i))
    }
    await expect(submit).toBeEnabled()
    await expect(submit).toHaveCSS('background-color', 'rgb(22, 101, 52)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`depth-form-${width}.png`), fullPage: true })
    await submit.click()
    await expect.poll(() => bodies.length).toBe(1)
    expect(bodies[0]).toEqual({ test_image: source, known_distances: [1, 2, 3].map(i => ({ x: i * 10, y: 20, distance_m: i })) })
    await expect(page.getByRole('heading', { name: 'Buat Skala Kedalaman', exact: true })).toBeHidden()
    await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Close toast' }).click()
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`depth-created-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}
