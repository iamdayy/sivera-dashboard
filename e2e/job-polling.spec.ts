import { expect, test, type Page } from '@playwright/test'
import { apiOrigin, camera, calibration, groundModel, groundRef, depthScale, installApiFixture } from './fixtures/api'
import { predictionJob } from '../src/__tests__/fixtures/prediction'
import type { PredictionJob } from '../src/types'

const job = predictionJob()
const otherCamera = { ...camera, id: '99999999-9999-4999-8999-999999999999', name: 'Kamera kedua' }
const image = { name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fkAAAAASUVORK5CYII=', 'base64') }
const volume = { volume: { method_grid: { volume_m3: 0, volume_liter: 0 }, method_convex_hull: null } }
const row = (page: Page, id = job.id) => page.getByRole('row').filter({ hasText: id.substring(0, 8) })

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(yes => { resolve = yes })
  return { promise, resolve }
}

async function setup(page: Page, jobs: PredictionJob[] = [predictionJob()]) {
  await page.clock.install()
  await installApiFixture(page, true, [camera, otherCamera])
  const state = {
    jobs, postCount: 0, postFailure: false, readStatus: 200, reads: 0,
    holdJob: undefined as Promise<void> | undefined,
    holdOutputs: undefined as Promise<void> | undefined,
    outputsRequested: 0,
  }
  await page.route(`${apiOrigin}/api/v1/cameras/**`, async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    const path = new URL(request.url()).pathname
    const cameraId = path.split('/')[4]!
    if (path.endsWith('/calibrations/active')) return route.fulfill({ json: { ...calibration, camera_id: cameraId } })
    if (path.endsWith('/ground-references/active')) return route.fulfill({ json: { ...groundRef, camera_id: cameraId } })
    if (path.endsWith('/ground-models/active')) return route.fulfill({ json: { ...groundModel, camera_id: cameraId } })
    if (path.endsWith('/depth-scales/active')) return route.fulfill({ json: { ...depthScale, camera_id: cameraId } })
    if (path.endsWith('/predict')) {
      if (request.method() === 'POST') {
        state.postCount++
        state.jobs.unshift(predictionJob({ camera_id: cameraId }))
        if (state.postFailure) return route.abort('failed')
        return route.fulfill({ status: 202, json: { job_id: job.id, status: 'pending', message: 'Accepted', estimated_duration_sec: 30 } })
      }
      const items = state.jobs.filter(item => item.camera_id === cameraId)
      return route.fulfill({ json: { items, total: items.length, page: 1, page_size: 20, total_pages: 1 } })
    }
    if (path.includes('/predict/')) {
      if (path.endsWith('/outputs')) {
        state.outputsRequested++
        if (state.holdOutputs) await state.holdOutputs
        return route.fulfill({ json: { outputs: [] } })
      }
      if (path.endsWith('/volumes') || path.endsWith('/instances')) return route.fulfill({ json: [] })
      state.reads++
      const value = state.jobs.find(item => item.id === path.split('/').pop() && item.camera_id === cameraId)
      const snapshot = value ? structuredClone(value) : null
      if (state.holdJob) await state.holdJob
      if (state.readStatus !== 200) return route.fulfill({ status: state.readStatus, json: { detail: 'Fixture status read failure' } })
      return snapshot ? route.fulfill({ json: snapshot }) : route.fulfill({ status: 404, json: { detail: 'Job not found' } })
    }
    return route.fallback()
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.text().includes('[Vue warn]')) errors.push(message.text()) })
  return { state, errors }
}

async function submit(page: Page) {
  await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('#pred-image').setInputFiles(image)
  await dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true }).click()
}

test.describe('persisted prediction jobs (mock API)', () => {
  test('submits once, retains the accepted ID on reload, and follows pending → processing → done', async ({ page }) => {
    const { state, errors } = await setup(page, [])
    await page.goto('/dashboard/predictions')
    await submit(page)
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`tracking=${job.id}`))
    await expect(row(page)).toContainText('Menunggu')
    await page.reload()
    await expect(page.getByText('Job diterima backend', { exact: true })).toBeVisible()
    await expect.poll(() => state.reads).toBeGreaterThan(0)
    state.jobs[0]!.status = 'processing'
    await page.clock.fastForward(3100)
    await expect(row(page)).toContainText('Memproses')
    state.jobs[0] = { ...state.jobs[0]!, status: 'done', result: volume }
    await page.clock.fastForward(3100)
    await expect(row(page)).toContainText('Selesai')
    await expect(row(page)).not.toContainText('Hasil parsial')
    await expect(page.getByText('Prediksi selesai', { exact: true })).toBeVisible()
    expect(state.postCount).toBe(1)
    expect(errors).toEqual([])
  })

  test('preserves processing on transient read failure and recovers automatically', async ({ page }) => {
    const { state, errors } = await setup(page, [predictionJob({ status: 'processing' })])
    state.readStatus = 503
    await page.goto('/dashboard/predictions')
    await expect(page.getByText('Pemeriksaan akan dicoba lagi otomatis.', { exact: false })).toBeVisible()
    await expect(row(page)).toContainText('Memproses')
    await expect(row(page)).not.toContainText('Gagal')
    state.readStatus = 200
    state.jobs[0] = { ...state.jobs[0]!, status: 'done', result: volume }
    await page.clock.fastForward(3100)
    await expect(row(page)).toContainText('Selesai')
    await expect(page.getByRole('button', { name: 'Periksa Status Lagi' })).toBeHidden()
    expect(errors).toEqual([])
  })

  for (const status of [401, 403]) {
    test(`pauses on ${status} and offers keyboard retry without marking the job failed`, async ({ page }) => {
      const { state, errors } = await setup(page)
      state.readStatus = status
      await page.goto('/dashboard/predictions')
      await expect(page.getByText('Pemeriksaan otomatis dijeda.', { exact: false })).toBeVisible()
      const count = state.reads
      await page.clock.fastForward(60_000)
      expect(state.reads).toBe(count)
      await expect(row(page)).toContainText('Menunggu')
      await expect(page.getByRole('link', { name: 'Buka Pengaturan', exact: true })).toBeVisible()
      state.readStatus = 200
      const retry = page.getByRole('button', { name: 'Periksa Status Lagi' })
      await retry.focus()
      await page.keyboard.press('Enter')
      await expect(retry).toBeHidden()
      expect(errors).toEqual([])
    })
  }

  test('tracks multiple jobs independently and shows worker failure as an error', async ({ page }) => {
    const second = predictionJob({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', status: 'processing' })
    const { state, errors } = await setup(page, [predictionJob(), second])
    await page.goto('/dashboard/predictions')
    await expect.poll(() => state.reads).toBe(2)
    state.jobs[0] = { ...job, status: 'failed', error_msg: 'prediction_worker_timeout' }
    state.jobs[1] = { ...second, status: 'done', result: volume }
    await page.clock.fastForward(3100)
    await expect(row(page)).toContainText('Gagal')
    await expect(row(page, second.id)).toContainText('Selesai')
    await row(page).getByRole('button', { name: 'Detail', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Pemrosesan melewati batas waktu worker')
    await expect(page.getByRole('dialog')).toContainText('buat prediksi baru')
    expect(errors).toEqual([])
  })

  test('refresh replaces a cached partial result with complete detail and list data', async ({ page }) => {
    const { state, errors } = await setup(page)
    await page.goto('/dashboard/predictions')
    await expect.poll(() => state.reads).toBeGreaterThan(0)
    state.jobs[0]!.status = 'done'
    await page.clock.fastForward(3100)
    await expect(row(page)).toContainText('Hasil parsial')
    await expect(page.getByText('Prediksi selesai', { exact: true })).toBeHidden()
    await row(page).getByRole('button', { name: 'Detail', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('hasil volume belum lengkap')
    state.jobs[0]!.result = volume
    await dialog.getByRole('button', { name: 'Muat Ulang Detail' }).click()
    await expect(dialog).toContainText('hasil volume tersedia')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(row(page)).not.toContainText('Hasil parsial')
    expect(errors).toEqual([])
  })

  test('a closed loading detail stays closed when its response arrives', async ({ page }) => {
    const { state, errors } = await setup(page, [predictionJob({ status: 'done', result: volume })])
    const held = deferred()
    state.holdOutputs = held.promise
    await page.goto('/dashboard/predictions')
    await row(page).getByRole('button', { name: 'Detail', exact: true }).click()
    await expect.poll(() => state.outputsRequested).toBe(1)
    await expect(page.getByRole('dialog')).toContainText('Memuat detail job')
    await page.keyboard.press('Escape')
    held.resolve()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page).not.toHaveURL(/job=/)
    expect(errors).toEqual([])
  })

  test('history refresh accepts a complete result after polling cached a partial result', async ({ page }) => {
    const { state, errors } = await setup(page)
    await page.goto('/dashboard/predictions')
    await expect.poll(() => state.reads).toBeGreaterThan(0)
    state.jobs[0]!.status = 'done'
    await page.clock.fastForward(3100)
    await expect(row(page)).toContainText('Hasil parsial')
    state.jobs[0]!.result = volume
    await page.getByRole('button', { name: 'Muat ulang riwayat prediksi' }).click()
    await expect(row(page)).not.toContainText('Hasil parsial')
    await expect(row(page)).toContainText('Selesai')
    expect(errors).toEqual([])
  })

  test('an open detail shows completion inline without a covering toast', async ({ page }) => {
    const { state, errors } = await setup(page)
    await page.goto('/dashboard/predictions')
    await row(page).getByRole('button', { name: 'Detail', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('Menunggu')
    state.jobs[0] = { ...state.jobs[0]!, status: 'done', result: volume }
    await page.clock.fastForward(3100)
    await expect(page.getByRole('dialog')).toContainText('hasil volume tersedia')
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('allows retrying a detail read failure', async ({ page }) => {
    const { state, errors } = await setup(page, [predictionJob({ status: 'done', result: volume })])
    state.readStatus = 403
    await page.goto('/dashboard/predictions')
    await row(page).getByRole('button', { name: 'Detail', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('alert')).toContainText('tidak memiliki izin')
    state.readStatus = 200
    await dialog.getByRole('button', { name: 'Muat Ulang Detail' }).click()
    await expect(dialog).toContainText('hasil volume tersedia')
    expect(errors).toEqual([])
  })

  test('old camera polling cannot change the new camera context', async ({ page }) => {
    const { state, errors } = await setup(page)
    const held = deferred()
    state.holdJob = held.promise
    await page.goto(`/dashboard/predictions?camera=${camera.id}&tracking=${job.id}`)
    await expect.poll(() => state.reads).toBeGreaterThan(0)
    await page.getByLabel('Pilih Kamera', { exact: true }).selectOption(otherCamera.id)
    await expect(page).toHaveURL(new RegExp(`camera=${otherCamera.id}`))
    held.resolve()
    await expect(row(page)).toBeHidden()
    await expect(page.getByText('Job diterima backend', { exact: true })).toBeHidden()
    await expect(page.getByText('Prediksi selesai', { exact: true })).toBeHidden()
    expect(errors).toEqual([])
  })

  test('an ambiguous POST keeps recovery visible and does not resubmit automatically', async ({ page }) => {
    const { state, errors } = await setup(page, [])
    state.postFailure = true
    await page.goto('/dashboard/predictions')
    await submit(page)
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('alert')).toContainText('Job mungkin sudah tersimpan')
    await expect(dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Periksa Riwayat' }).click()
    await expect(dialog).toBeHidden()
    await expect(row(page)).toContainText('Menunggu')
    expect(state.postCount).toBe(1)
    expect(errors).toEqual([])
  })

  for (const width of [390, 768, 1280]) {
    test(`polling recovery and partial detail remain usable at ${width}px`, async ({ page }, testInfo) => {
      const { state, errors } = await setup(page)
      await page.setViewportSize({ width, height: 900 })
      state.readStatus = 403
      await page.goto('/dashboard/predictions')
      await expect(page.getByRole('button', { name: 'Periksa Status Lagi' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Periksa Status Lagi' })).toHaveCSS('min-height', '44px')
      await row(page).scrollIntoViewIfNeeded()
      await expect(row(page).getByText('Menunggu', { exact: true })).toBeInViewport()
      await page.evaluate(() => scrollTo(0, 0))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`polling-recovery-${width}.png`), fullPage: true })
      state.readStatus = 200
      state.jobs[0]!.status = 'done'
      await page.getByRole('button', { name: 'Periksa Status Lagi' }).click()
      await expect(row(page)).toContainText('Hasil parsial')
      await row(page).getByRole('button', { name: 'Detail', exact: true }).click()
      await expect(page.getByRole('dialog')).toContainText('hasil volume belum lengkap')
      await page.clock.fastForward(400)
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath(`partial-detail-${width}.png`), fullPage: true })
      expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
      await page.getByRole('dialog').getByRole('button', { name: 'Tutup dialog' }).click()
      await expect(page.getByRole('dialog')).toBeHidden()
      expect(errors).toEqual([])
    })
  }
})
