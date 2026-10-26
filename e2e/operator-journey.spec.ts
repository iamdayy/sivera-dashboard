import { expect, test } from '@playwright/test'
import { apiOrigin, camera, installApiFixture } from './fixtures/api'
import { secondCamera, setupOverview } from './fixtures/overview'
import { predictionJob } from '../src/__tests__/fixtures/prediction'

test.describe('operator overview journey (mock API)', () => {
  test('missing access leads to settings', async ({ page }) => {
    await installApiFixture(page, false)
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'Buka Pengaturan', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/settings')
  })

  test('an empty camera list leads to camera registration', async ({ page }) => {
    await setupOverview(page, [])
    await page.goto('/dashboard')
    await expect(page.getByText('Belum ada kamera terdaftar')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Metrik utama' })).toBeHidden()
    await page.getByRole('link', { name: 'Tambah Kamera', exact: true }).click()
    await expect(page).toHaveURL('/dashboard/cameras')
  })

  test('walks through missing setup to analysis with the selected camera', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    state.calibration = state.ground = state.depth = false
    await page.goto(`/dashboard?camera=${secondCamera.id}`)
    const next = page.getByRole('region', { name: 'Langkah berikutnya' })
    await expect(next).toContainText(secondCamera.name)
    for (const [label, path, key] of [
      ['Buka Kalibrasi', 'calibrations', 'calibration'],
      ['Buka Referensi Tanah', 'ground-references', 'ground'],
      ['Buka Skala Kedalaman', 'depth-scales', 'depth'],
    ] as const) {
      const action = next.getByRole('link', { name: label, exact: true })
      await expect(action).toHaveAttribute('href', `/dashboard/${path}?camera=${secondCamera.id}`)
      await action.click()
      await expect(page).toHaveURL(`/dashboard/${path}?camera=${secondCamera.id}`)
      state[key] = true
      await page.goBack()
      await expect(page.getByLabel('Pilih kamera', { exact: true })).toHaveValue(secondCamera.id)
    }
    await expect(next).toContainText('Konfigurasi siap untuk upload gambar')
    await expect(next).toContainText('belum memastikan worker tersedia atau kamera online')
    await page.getByText('Detail kamera dan prasyarat', { exact: true }).click()
    await expect(page.getByText('Diaktifkan', { exact: true })).toBeVisible()
    const metrics = page.getByRole('region', { name: 'Metrik utama' })
    await expect(metrics.locator('div').filter({ has: page.getByText('Total Kamera', { exact: true }) }).locator('dd')).toHaveText('2')
    await next.getByRole('link', { name: 'Buka Analisis Sampah' }).click()
    await expect(page).toHaveURL(`/dashboard/predictions?camera=${secondCamera.id}`)
    await expect(page.getByLabel('Pilih Kamera', { exact: true })).toHaveValue(secondCamera.id)
    expect(errors).toEqual([])
  })

  test('changing cameras preserves the query on refresh and rejects a stale readiness response', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    await page.goto(`/dashboard?camera=${camera.id}`)
    const next = page.getByRole('region', { name: 'Langkah berikutnya' })
    await expect(next).toContainText('Konfigurasi siap')
    let release!: () => void
    state.modelHold = new Promise<void>(resolve => { release = resolve })
    state.ground = false
    await page.getByLabel('Pilih kamera', { exact: true }).selectOption(secondCamera.id)
    await expect(next).toContainText('Memeriksa langkah setup berikutnya')
    await expect(next.getByRole('link')).toHaveCount(0)
    await expect.poll(() => state.modelHold === undefined).toBe(true)
    state.ground = true
    await page.getByLabel('Pilih kamera', { exact: true }).selectOption(camera.id)
    await expect(next).toContainText('Konfigurasi siap')
    release()
    await expect(next.getByRole('link', { name: 'Buka Analisis Sampah' })).toHaveAttribute('href', `/dashboard/predictions?camera=${camera.id}`)
    await page.getByLabel('Pilih kamera', { exact: true }).selectOption(secondCamera.id)
    await expect(page).toHaveURL(`/dashboard?camera=${secondCamera.id}`)
    await page.reload()
    await expect(next).toContainText(secondCamera.name)
    await page.getByText('Detail kamera dan prasyarat', { exact: true }).click()
    await page.getByRole('link', { name: 'Periksa Kamera dan Stream' }).click()
    await expect(page).toHaveURL(`/dashboard/cameras?camera=${secondCamera.id}`)
    expect(errors).toEqual([])
  })

  test('healthy backend does not mask readiness access failure and keyboard retry recovers', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    state.readinessStatus = 403
    await page.goto('/dashboard')
    const next = page.getByRole('region', { name: 'Langkah berikutnya' })
    await expect(page.getByText('Backend sehat', { exact: true })).toBeVisible()
    await expect(next.getByRole('alert')).toContainText('API Key tidak memiliki izin')
    await expect(next.getByRole('link', { name: 'Buka Analisis Sampah' })).toBeHidden()
    await next.getByRole('link', { name: 'Buka Pengaturan' }).click()
    await expect(page).toHaveURL('/dashboard/settings')
    await page.goBack()
    const retry = next.getByRole('button', { name: 'Coba Lagi' })
    await page.keyboard.press('Tab')
    await retry.focus()
    expect(await retry.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
    state.readinessStatus = 200
    await page.keyboard.press('Enter')
    await expect(next).toContainText('Konfigurasi siap')
    expect(errors).toEqual([])
  })

  test('camera access failure offers settings rather than camera registration', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    state.camerasStatus = 401
    await page.goto('/dashboard')
    await expect(page.getByRole('alert')).toContainText('API Key')
    await expect(page.getByRole('link', { name: 'Tambah Kamera', exact: true })).toBeHidden()
    state.camerasStatus = 200
    await page.getByRole('button', { name: 'Coba Lagi', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Langkah berikutnya' })).toContainText('Konfigurasi siap')
    expect(errors).toEqual([])
  })

  test('history read failure is recoverable and never called an empty history', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    state.historyStatus = 403
    await page.goto('/dashboard')
    const history = page.getByRole('region', { name: 'Job prediksi terbaru' })
    await expect(history.getByRole('alert')).toContainText('API Key tidak memiliki izin')
    await expect(history).not.toContainText('Belum ada job prediksi')
    const metrics = page.getByRole('region', { name: 'Metrik utama' })
    await expect(metrics.locator('div').filter({ has: page.getByText('Analisis Selesai', { exact: true }) }).locator('dd')).toHaveText('-')
    await expect(metrics).toContainText('Total job belum dapat dimuat')
    state.historyStatus = 200
    await history.getByRole('button', { name: 'Muat Ulang Riwayat' }).click()
    await expect(history).toContainText('Belum ada job prediksi')
    expect(errors).toEqual([])
  })

  test('partial history keeps readable jobs and exposes recovery', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    state.historyStatus = 403
    state.historyFailureCamera = secondCamera.id
    state.jobs = [predictionJob({ status: 'failed', error_msg: 'prediction_worker_timeout' })]
    await page.goto('/dashboard')
    const history = page.getByRole('region', { name: 'Job prediksi terbaru' })
    await expect(history).toContainText('Sebagian job terbaru tidak dapat dimuat')
    const metrics = page.getByRole('region', { name: 'Metrik utama' })
    await expect(metrics).toContainText('Metrik dari 1 kamera tidak dapat dimuat sepenuhnya')
    await expect(metrics).toContainText('Dari 1 total job')
    await expect(metrics.locator('div').filter({ has: page.getByText('Analisis Selesai', { exact: true }) }).locator('dd')).toHaveText('0')
    await expect(history.getByRole('link', { name: 'Detail' })).toHaveAttribute('href', `/dashboard/predictions?camera=${camera.id}&job=${state.jobs[0]!.id}`)
    state.historyStatus = 200
    await history.getByRole('button', { name: 'Muat Ulang Riwayat' }).click()
    await expect(history).not.toContainText('Sebagian job terbaru tidak dapat dimuat')
    await history.getByRole('link', { name: 'Detail' }).click()
    await expect(page.getByRole('dialog')).toContainText(state.jobs[0]!.id)
    await expect(page.getByRole('dialog').getByText('Gagal', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('Pemrosesan melewati batas waktu worker. Periksa worker bersama operator, lalu buat prediksi baru.')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(errors).toEqual([])
  })

  test('detail read failure preserves the listed camera and independent readiness', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    state.detailStatus = 503
    await page.goto('/dashboard')
    await page.getByText('Detail kamera dan prasyarat', { exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Metadata di atas masih mengikuti daftar kamera')
    await expect(page.getByRole('region', { name: 'Langkah berikutnya' })).toContainText('Konfigurasi siap')
    await expect(page.getByLabel('Pilih kamera', { exact: true })).toHaveValue(camera.id)
    expect(errors).toEqual([])
  })

  test('initial readiness renders while unrelated metrics are still loading', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    let releaseMetrics!: () => void
    let releaseReadiness!: () => void
    state.statsHold = new Promise<void>(resolve => { releaseMetrics = resolve })
    state.modelHold = new Promise<void>(resolve => { releaseReadiness = resolve })
    await page.goto('/dashboard')
    const next = page.getByRole('region', { name: 'Langkah berikutnya' })
    await expect(next).toContainText('Memeriksa langkah setup berikutnya')
    await expect(next.getByRole('link')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Metrik utama' })).toContainText('Memuat metrik kamera')
    releaseReadiness()
    await expect(next).toContainText('Konfigurasi siap')
    await expect(page.getByRole('region', { name: 'Metrik utama' })).toContainText('Memuat metrik kamera')
    releaseMetrics()
    await expect(page.getByRole('region', { name: 'Metrik utama' })).toContainText('2 dengan kalibrasi aktif')
    expect(errors).toEqual([])
  })

  test('late camera detail failure cannot replace a newer successful check', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    let release!: () => void
    state.detailHold = new Promise<void>(resolve => { release = resolve })
    state.detailStatus = 503
    await page.goto(`/dashboard?camera=${camera.id}`)
    await expect.poll(() => state.detailHold === undefined).toBe(true)
    await expect(page.getByRole('region', { name: 'Langkah berikutnya' })).toContainText('Konfigurasi siap')
    state.detailStatus = 200
    await page.getByLabel('Pilih kamera', { exact: true }).selectOption(secondCamera.id)
    await expect(page.getByRole('region', { name: 'Langkah berikutnya' })).toContainText('Konfigurasi siap')
    const newDetail = page.waitForResponse(`${apiOrigin}/api/v1/cameras/${camera.id}`)
    await page.getByLabel('Pilih kamera', { exact: true }).selectOption(camera.id)
    await (await newDetail).finished()
    const stale = page.waitForResponse(response => response.url() === `${apiOrigin}/api/v1/cameras/${camera.id}` && response.status() === 503)
    release()
    await (await stale).finished()
    await page.getByText('Detail kamera dan prasyarat', { exact: true }).click()
    await expect(page.getByText('Metadata di atas masih mengikuti daftar kamera', { exact: false })).toBeHidden()
    await expect(page.getByRole('region', { name: 'Langkah berikutnya' })).toContainText('Konfigurasi siap')
    expect(errors).toEqual([])
  })

  test('legacy upload explains the image requirement before opening analysis', async ({ page }) => {
    const { state, errors } = await setupOverview(page)
    state.legacy = true
    await page.goto('/dashboard')
    const next = page.getByRole('region', { name: 'Langkah berikutnya' })
    await expect(next).toContainText('Kalibrasi legacy: gunakan gambar yang sudah undistorted')
    await next.getByRole('link', { name: 'Buka Analisis Sampah' }).click()
    await expect(page).toHaveURL(`/dashboard/predictions?camera=${camera.id}`)
    expect(errors).toEqual([])
  })

  test('overview reflows with 200% text and a short viewport', async ({ page }, testInfo) => {
    const { state, errors } = await setupOverview(page)
    state.depth = false
    await page.setViewportSize({ width: 390, height: 600 })
    await page.goto('/dashboard')
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    const next = page.getByRole('region', { name: 'Langkah berikutnya' })
    const action = next.getByRole('link', { name: 'Buka Skala Kedalaman' })
    await expect(action).toBeVisible()
    await next.getByLabel('Pilih kamera', { exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(action).toBeFocused()
    await expect(action).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('overview-text-200.png'), fullPage: true })
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/dashboard/depth-scales?camera=${camera.id}`)
    expect(errors).toEqual([])
  })

  test('camera disclosure and setup destinations work from the keyboard', async ({ page }) => {
    const { errors } = await setupOverview(page)
    await page.goto(`/dashboard?camera=${secondCamera.id}`)
    const summary = page.getByText('Detail kamera dan prasyarat', { exact: true })
    const detail = page.locator('details').filter({ has: summary })
    await expect(page.getByRole('region', { name: 'Langkah berikutnya' })).toContainText('Konfigurasi siap')
    await summary.focus()
    expect(await summary.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(detail).toHaveAttribute('open', '')
    await page.keyboard.press('Space')
    await expect(detail).not.toHaveAttribute('open', '')
    for (const path of ['calibrations', 'ground-references', 'depth-scales']) {
      await summary.focus()
      await page.keyboard.press('Enter')
      const link = detail.locator(`a[href="/dashboard/${path}?camera=${secondCamera.id}"]`)
      await link.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(`/dashboard/${path}?camera=${secondCamera.id}`)
      await page.goBack()
      await expect(page.getByLabel('Pilih kamera', { exact: true })).toHaveValue(secondCamera.id)
    }
    expect(errors).toEqual([])
  })

  for (const width of [390, 768, 1280]) {
    test(`next action is visible and keyboard usable at ${width}px`, async ({ page }, testInfo) => {
      const { state, errors } = await setupOverview(page)
      state.depth = false
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/dashboard')
      const next = page.getByRole('region', { name: 'Langkah berikutnya' })
      const action = next.getByRole('link', { name: 'Buka Skala Kedalaman' })
      await expect(action).toBeInViewport({ ratio: 1 })
      expect(await action.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
      await next.getByLabel('Pilih kamera', { exact: true }).focus()
      await page.keyboard.press('Tab')
      await expect(action).toBeFocused()
      expect(await action.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`overview-next-${width}.png`), fullPage: true })
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(`/dashboard/depth-scales?camera=${camera.id}`)
      expect(errors).toEqual([])
    })
  }
})
