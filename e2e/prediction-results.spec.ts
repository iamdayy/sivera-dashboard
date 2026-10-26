import { expect, test, type Locator, type Page } from '@playwright/test'
import { apiOrigin, calibration, camera, depthScale, groundModel } from './fixtures/api'
import { setupResults } from './fixtures/results'
import { predictionJob, volumeEstimate } from '../src/__tests__/fixtures/prediction'

const detailUrl = `/dashboard/predictions?camera=${camera.id}&job=${predictionJob().id}`
const value = (scope: Locator, label: string) => scope.locator('dl > div').filter({ has: scope.page().getByText(label, { exact: true }) }).locator('dd')
const method = (page: Page, name: string) => page.getByRole('region', { name: 'Estimasi volume', exact: true }).locator(':scope > div').filter({ has: page.getByRole('heading', { name, exact: true }) })

test.describe('prediction result review (mock API)', () => {
  test('separate methods lead the result with units and historical configuration', async ({ page }) => {
    const { state, errors } = await setupResults(page)
    const job = state.jobs[0]!
    await page.goto(detailUrl)
    const dialog = page.getByRole('dialog')
    const grid = method(page, 'Grid/Voxel')
    const hull = method(page, 'Convex Hull 2D')
    await expect(value(grid, 'Volume (m³)')).toHaveText('0,125')
    await expect(value(grid, 'Volume (L)')).toHaveText('125')
    await expect(value(hull, 'Volume (m³)')).toHaveText('0,180')
    await expect(value(hull, 'Volume (L)')).toHaveText('180')
    await expect(dialog).not.toContainText('0,305')
    await expect(dialog).toContainText('akurasi fisik belum diverifikasi')
    expect((await grid.boundingBox())!.y).toBeLessThan((await dialog.getByText('Job ID', { exact: true }).boundingBox())!.y)
    await grid.locator('summary').click()
    await expect(grid).toContainText('sel batas tetap memakai luas sel penuh')
    await expect(value(grid, 'Sel dengan data tinggi')).toHaveText('50')
    await expect(value(grid, 'Ukuran sel hasil (m)')).toHaveText('0,100')
    await hull.locator('summary').click()
    await expect(hull).toContainText('bukan volume convex hull 3D')
    await expect(value(hull, 'Luas footprint (m²)')).toHaveText('0,600')
    const context = dialog.locator('details').filter({ hasText: 'Konfigurasi job tersimpan' })
    await context.locator('summary').click()
    await expect(value(context, 'Kalibrasi ID')).toHaveText(job.calibration_id)
    await expect(value(context, 'Model ground ID')).toHaveText(job.ground_model_id)
    await expect(value(context, 'Skala kedalaman ID')).toHaveText(job.depth_scale_id)
    for (const id of [calibration.id, groundModel.id, depthScale.id]) await expect(context).not.toContainText(id)
    await expect(value(context, 'Ambang confidence segmentasi')).toHaveText('0,0%')
    await expect(value(context, 'Minimum titik per sel')).toHaveText('3')
    await expect(context).toContainText('bukan tingkat akurasi volume')
    expect(errors).toEqual([])
  })

  for (const source of ['upload', 'latest_rtsp', 'rtsp_frame']) {
    test(`${source} describes source time in UTC and treats its private key as text`, async ({ page }) => {
      const { state, errors } = await setupResults(page)
      const job = state.jobs[0]!
      job.source_type = source
      job.source_ts = '2026-10-26T14:59:00+07:00'
      job.source_path = 'private/<img src=x onerror=alert(1)>/fixture.image'
      const privateRequests: string[] = []
      page.on('request', request => { if (request.url().includes('/private/')) privateRequests.push(request.url()) })
      await page.goto(detailUrl)
      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText(job.source_path)
      await expect(dialog).toContainText('07.59.00 UTC')
      await expect(dialog).toContainText(source === 'upload' ? 'Waktu sumber dari pengunggah' : 'Waktu penerimaan frame oleh worker')
      if (source !== 'upload') await expect(dialog).toContainText('bukan waktu sensor kamera')
      await expect(dialog.locator('img, a')).toHaveCount(0)
      await dialog.locator('summary').filter({ hasText: 'Konfigurasi job tersimpan' }).click()
      if (source !== 'upload') await expect(value(dialog, 'Batas usia frame (detik)')).toHaveText('30')
      expect(privateRequests).toEqual([])
      expect(errors).toEqual([])
    })
  }

  test('zero and subprecision values stay distinct from missing, negative and nonnumeric results', async ({ page }) => {
    const { errors } = await setupResults(page)
    await page.route(`${apiOrigin}/api/v1/cameras/${camera.id}/predict/*/volumes`, route => route.fulfill({ json: [
      volumeEstimate({ volume_m3: 0, volume_liter: 0, height_mean_m: null }),
      volumeEstimate({ id: 'tiny', method: 'convex_hull', volume_m3: 0.00001, volume_liter: 0.01 }),
      { ...volumeEstimate({ id: 'malformed', method: 'unknown-method' }), volume_m3: '0.5', volume_liter: -10, n_points: null },
    ] }))
    await page.goto(detailUrl)
    const grid = method(page, 'Grid/Voxel')
    await expect(value(grid, 'Volume (m³)')).toHaveText('0,000')
    await expect(value(grid, 'Volume (L)')).toHaveText('0')
    await grid.locator('summary').click()
    await expect(value(grid, 'Tinggi rata-rata titik (m)')).toHaveText('-')
    await expect(value(method(page, 'Convex Hull 2D'), 'Volume (m³)')).toHaveText('< 0,001')
    await expect(value(method(page, 'Convex Hull 2D'), 'Volume (L)')).toHaveText('< 1')
    const invalid = method(page, 'unknown-method')
    await expect(value(invalid, 'Volume (m³)')).toHaveText('-')
    await expect(value(invalid, 'Volume (L)')).toHaveText('-')
    await invalid.locator('summary').click()
    await expect(invalid).toContainText('definisinya belum tersedia')
    expect(errors).toEqual([])
  })

  test('a missing method is not substituted or summed with the available method', async ({ page }) => {
    const { state, result, errors } = await setupResults(page)
    result.volumes = [result.volumes[1]!]
    state.jobs[0]!.result = { volume: { method_grid: null, method_convex_hull: result.volumes[0] } }
    await page.goto(detailUrl)
    await expect(value(method(page, 'Convex Hull 2D'), 'Volume (L)')).toHaveText('180')
    await expect(page.getByRole('heading', { name: 'Grid/Voxel', exact: true })).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('partial completion remains partial until detail reload returns saved results', async ({ page }) => {
    const { state, result, errors } = await setupResults(page)
    const volumes = result.volumes
    const complete = state.jobs[0]!.result
    result.volumes = []
    state.jobs[0]!.result = null
    state.jobs[0]!.source_ts = null
    await page.goto(detailUrl)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('hasil volume belum lengkap')
    await expect(dialog).toContainText('Rincian volume belum tersedia')
    await expect(dialog).not.toContainText('0,000')
    result.volumes = volumes
    state.jobs[0]!.result = complete
    await dialog.getByRole('button', { name: 'Muat Ulang Detail' }).click()
    await expect(value(method(page, 'Grid/Voxel'), 'Volume (L)')).toHaveText('125')
    await expect(dialog).not.toContainText('hasil volume belum lengkap')
    expect(result.reads).toBe(2)
    expect(errors).toEqual([])
  })

  test('volume access failure preserves job identity and recovers through a GET reload', async ({ page }) => {
    const { result, errors } = await setupResults(page)
    result.volumeStatus = 403
    let submissions = 0
    page.on('request', request => { if (request.method() === 'POST') submissions++ })
    await page.goto(detailUrl)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Sebagian detail tidak dapat dimuat')
    await expect(dialog).toContainText('Periksa izin predict:read bersama administrator')
    await expect(dialog).toContainText(predictionJob().id)
    await expect(dialog).toContainText('Rincian volume belum tersedia')
    result.volumeStatus = 200
    await dialog.getByRole('button', { name: 'Muat Ulang Detail' }).click()
    await expect(value(method(page, 'Grid/Voxel'), 'Volume (L)')).toHaveText('125')
    await expect(dialog).not.toContainText('Sebagian detail tidak dapat dimuat')
    expect(submissions).toBe(0)
    expect(errors).toEqual([])
  })

  test('instance numbers use the same unavailable and confidence semantics', async ({ page }) => {
    const { result, errors } = await setupResults(page)
    result.instances = [{
      id: '99999999-9999-4999-8999-999999999999', job_id: predictionJob().id,
      cls_name: 'Kelas fixture', confidence: 0, polygon_px: [], polygon_world: null,
      volume_m3: null, footprint_m2: 0, height_mean_m: -1, height_max_m: null, n_pixels: 0,
      created_at: '2026-10-26T08:01:00Z',
    }]
    await page.goto(detailUrl)
    const table = page.getByRole('table', { name: 'Instance terdeteksi' })
    await expect(table.locator('tbody td')).toHaveText(['Kelas fixture', '0,0%', '-', '0,000', '-'])
    expect(errors).toEqual([])
  })

  test('Tab reaches every disclosure and wraps within the dialog in both directions', async ({ page }) => {
    const { errors } = await setupResults(page)
    await page.goto(`/dashboard/predictions?camera=${camera.id}`)
    const trigger = page.getByRole('button', { name: 'Detail', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Estimasi volume')
    await dialog.getByRole('button', { name: 'Muat Ulang Detail' }).focus()
    for (const name of ['Rincian Grid/Voxel', 'Rincian Convex Hull 2D', 'Konfigurasi job tersimpan']) {
      await page.keyboard.press('Tab')
      const summary = dialog.locator('summary').filter({ hasText: name })
      await expect(summary).toBeFocused()
      expect(await summary.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
      await page.keyboard.press('Enter')
      await expect(summary.locator('..')).toHaveAttribute('open', '')
      await page.keyboard.press('Space')
      await expect(summary.locator('..')).not.toHaveAttribute('open', '')
    }
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Tutup dialog' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.locator('summary').last()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(errors).toEqual([])
  })

  for (const width of [390, 768, 1280]) {
    test(`detail fits ${width}px with reachable disclosures and 200% text`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 700 })
      const { errors } = await setupResults(page)
      await page.goto(detailUrl)
      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('Estimasi volume')
      const summaries = dialog.locator('summary')
      const reload = dialog.getByRole('button', { name: 'Muat Ulang Detail' })
      const reloadSize = await reload.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
      const originalSizes = await summaries.evaluateAll(elements => elements.map(el => parseFloat(getComputedStyle(el).fontSize)))
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
      const enlargedSizes = await summaries.evaluateAll(elements => elements.map(el => parseFloat(getComputedStyle(el).fontSize)))
      for (const [index, size] of enlargedSizes.entries()) expect(size).toBeCloseTo(originalSizes[index]! * 2)
      expect(await reload.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(reloadSize * 2)
      const scrollArea = dialog.locator('.overflow-y-auto')
      expect((await scrollArea.boundingBox())!.height).toBeGreaterThan((await dialog.boundingBox())!.height / 2)
      await page.screenshot({ path: testInfo.outputPath('result-text-200-top.png'), animations: 'disabled' })
      for (const summary of await summaries.all()) {
        await summary.scrollIntoViewIfNeeded()
        await summary.click()
        const box = await summary.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      }
      const context = summaries.last()
      await context.focus()
      await expect(context).toBeInViewport({ ratio: 1 })
      await page.keyboard.press('Space')
      await expect(context.locator('..')).not.toHaveAttribute('open', '')
      await page.keyboard.press('Enter')
      await expect(context.locator('..')).toHaveAttribute('open', '')
      await dialog.getByText('Confidence segmentasi adalah ambang deteksi, bukan tingkat akurasi volume.', { exact: true }).scrollIntoViewIfNeeded()
      await expect(dialog.getByText('Confidence segmentasi adalah ambang deteksi, bukan tingkat akurasi volume.', { exact: true })).toBeInViewport({ ratio: 1 })
      await context.scrollIntoViewIfNeeded()
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect(await scrollArea.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('result-text-200.png'), animations: 'disabled' })
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      expect(errors).toEqual([])
    })
  }
})
