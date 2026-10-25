import { expect, test, type Page } from '@playwright/test'
import {
  apiOrigin,
  calibration,
  camera,
  depthScale,
  groundModel,
  groundRef,
  installApiFixture,
} from './fixtures/api'
import type { Calibration, DepthScale } from '../src/types'
import type { GroundModel } from '../src/services/groundReferences'

const secondCamera = {
  ...camera,
  id: '99999999-9999-4999-8999-999999999999',
  name: 'Kamera kedua fixture UI',
}
const image = {
  name: 'fixture.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSTsAAAAASUVORK5CYII=',
    'base64',
  ),
}

async function setup(page: Page, cameras = [camera]) {
  await installApiFixture(page, true, cameras)
  const state = {
    calibration: { ...calibration } as Calibration | null,
    model: { ...groundModel } as GroundModel | null,
    scale: { ...depthScale } as DepthScale | null,
    modelFailure: 0,
    acceptPosts: false,
    posts: [] as string[],
    reads: [] as string[],
    nextModelHold: undefined as
      { promise: Promise<void>; response: GroundModel | null } | undefined,
  }
  await page.route(`${apiOrigin}/api/v1/cameras/**`, async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    const path = new URL(request.url()).pathname
    const cameraId = path.split('/')[4]!
    if (request.method() === 'POST') {
      state.posts.push(path)
      if (state.acceptPosts && path.endsWith('/predict'))
        return route.fulfill({
          status: 202,
          json: {
            job_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            status: 'pending',
            message: 'Fixture queued job',
            estimated_duration_sec: 10,
          },
        })
    }
    if (request.method() !== 'GET') return route.fallback()
    state.reads.push(path)
    if (path.endsWith('/calibrations/active')) {
      if (!state.calibration)
        return route.fulfill({ status: 404, json: { detail: 'No active calibration' } })
      return route.fulfill({ json: { ...state.calibration, camera_id: cameraId } })
    }
    if (path.endsWith('/ground-references/active'))
      return route.fulfill({ json: { ...groundRef, camera_id: cameraId } })
    if (path.endsWith('/ground-models/active')) {
      const hold = state.nextModelHold
      state.nextModelHold = undefined
      const model = hold ? hold.response : state.model
      if (hold) await hold.promise
      if (state.modelFailure)
        return route.fulfill({
          status: state.modelFailure,
          json: { detail: 'Fixture permission/service error' },
        })
      if (!model) return route.fulfill({ status: 404, json: { detail: 'No active ground model' } })
      return route.fulfill({ json: { ...model, camera_id: cameraId } })
    }
    if (path.endsWith('/depth-scales/active')) {
      if (!state.scale)
        return route.fulfill({ status: 404, json: { detail: 'No active depth scale' } })
      return route.fulfill({ json: { ...state.scale, camera_id: cameraId } })
    }
    return route.fallback()
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if ((message.type() === 'error' && !message.text().includes('Failed to load resource')) || message.text().includes('[Vue warn]'))
      errors.push(message.text())
  })
  return { state, errors }
}

test.describe('readiness workflows with mocked API responses', () => {
  for (const path of ['/dashboard', '/dashboard/predictions']) {
    test(`${path}: missing scale has an actionable destination with camera context`, async ({
      page,
    }) => {
      const { state, errors } = await setup(page)
      state.scale = null
      await page.goto(path)
      await expect(
        page.getByText(
          'Skala kedalaman aktif belum tersedia untuk model ground ini. Buat dan aktifkan skala.',
        ),
      ).toBeVisible()
      const recovery = page.getByRole('link', { name: 'Buka Skala Kedalaman', exact: true })
      await expect(recovery).toHaveAttribute('href', `/dashboard/depth-scales?camera=${camera.id}`)
      await recovery.click()
      await expect(page).toHaveURL(`/dashboard/depth-scales?camera=${camera.id}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Skala Kedalaman')
      expect(errors).toEqual([])
    })
  }

  for (const resource of ['calibration', 'model'] as const) {
    test(`missing ${resource}: recovery opens setup and returning refreshes readiness`, async ({ page }) => {
      const { state, errors } = await setup(page)
      state[resource] = null
      await page.goto(`/dashboard/predictions?camera=${camera.id}`)
      await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
      const destination = resource === 'calibration' ? 'Kalibrasi' : 'Referensi Tanah'
      const path = resource === 'calibration' ? 'calibrations' : 'ground-references'
      const recovery = page.getByRole('dialog').getByRole('link', { name: `Buka ${destination}`, exact: true })
      await expect(page.getByRole('dialog').locator('#pred-source-type')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(recovery).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(`/dashboard/${path}?camera=${camera.id}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        resource === 'calibration' ? 'Manajemen Kalibrasi' : destination,
      )
      if (resource === 'calibration') state.calibration = { ...calibration }
      else state.model = { ...groundModel }
      await page.goBack()
      await expect(page.getByLabel('Pilih Kamera', { exact: true })).toHaveValue(camera.id)
      await expect(page.getByText('Model cocok dengan kalibrasi dan referensi tanah aktif.')).toBeVisible()
      await expect(page.getByText('Konfigurasi belum siap untuk prediksi')).not.toBeVisible()
      expect(state.posts).toEqual([])
      expect(errors).toEqual([])
    })
  }

  test('configuration mismatch is not labeled as a missing model', async ({ page }) => {
    const { state, errors } = await setup(page)
    state.model = { ...groundModel, calibration_id: secondCamera.id }
    await page.goto('/dashboard/predictions')
    await expect(
      page.getByText('Model ground tidak cocok dengan kalibrasi aktif. Periksa Referensi Tanah.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true }),
    ).toBeDisabled()
    await expect(
      dialog.getByRole('link', { name: 'Buka Referensi Tanah', exact: true }),
    ).toHaveAttribute('href', `/dashboard/ground-references?camera=${camera.id}`)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    expect(state.posts).toEqual([])
    expect(errors).toEqual([])
  })

  for (const source of ['rtsp_frame', 'latest_rtsp']) {
    test(`legacy upload remains available but ${source} waits for compatible intrinsics`, async ({
      page,
    }) => {
      const { state, errors } = await setup(page, [
        { ...camera, rtsp_configured: true, stream_enabled: true },
      ])
      state.calibration = {
        ...calibration,
        k_original: null,
        resolution_w: null,
        resolution_h: null,
      }
      await page.goto('/dashboard/predictions')
      await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
      const dialog = page.getByRole('dialog')
      const submit = dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true })
      await dialog.locator('#pred-image').setInputFiles(image)
      await expect(submit).toBeEnabled()
      await expect(dialog.getByText('Kalibrasi legacy:', { exact: false })).toBeVisible()
      let release!: () => void
      state.nextModelHold = {
        promise: new Promise<void>((resolve) => {
          release = resolve
        }),
        response: groundModel,
      }
      await dialog.locator('#pred-source-type').selectOption(source)
      await expect(submit).toBeDisabled()
      await expect(dialog.getByText('Tunggu pemeriksaan prasyarat selesai.')).toBeVisible()
      release()
      await expect(
        dialog.getByText(
          'Sumber RTSP memerlukan intrinsics asli dan dimensi kalibrasi. Lakukan kalibrasi ulang.',
        ),
      ).toBeVisible()
      await expect(submit).toBeDisabled()
      await dialog.locator('#pred-source-type').selectOption('upload')
      await expect(submit).toBeEnabled()
      expect(state.posts).toEqual([])
      await page.keyboard.press('Escape')
      expect(errors).toEqual([])
    })
  }

  test('submission rechecks current setup and does not POST a stale ready configuration', async ({
    page,
  }) => {
    const { state, errors } = await setup(page)
    await page.goto('/dashboard/predictions')
    await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#pred-image').setInputFiles(image)
    const submit = dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true })
    await expect(submit).toBeEnabled()
    const readsBefore = state.reads.filter((path) => path.endsWith('/ground-models/active')).length
    state.model = null
    await submit.click()
    await expect(
      dialog
        .getByText('Model ground untuk konfigurasi aktif belum tersedia. Periksa Referensi Tanah.')
        .first(),
    ).toBeVisible()
    await expect(submit).toBeDisabled()
    expect(
      state.reads.filter((path) => path.endsWith('/ground-models/active')).length,
    ).toBeGreaterThan(readsBefore)
    expect(state.posts).toEqual([])
    await expect(dialog.locator('#pred-image')).not.toHaveValue('')
    expect(errors).toEqual([])
  })

  test('compatible configuration is submitted once after fresh preflight and remains a queued job', async ({
    page,
  }) => {
    const { state, errors } = await setup(page)
    state.acceptPosts = true
    await page.goto('/dashboard/predictions')
    await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#pred-image').setInputFiles(image)
    const submit = dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true })
    await expect(submit).toBeEnabled()
    let release!: () => void
    state.nextModelHold = {
      promise: new Promise<void>((resolve) => {
        release = resolve
      }),
      response: groundModel,
    }
    await submit.click()
    await expect(dialog.getByRole('button', { name: 'Memproses...', exact: true })).toBeDisabled()
    expect(state.posts).toEqual([])
    release()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Prediksi berhasil dikirim')).toBeVisible()
    await expect(page.getByText('Prediksi selesai', { exact: true })).not.toBeVisible()
    expect(state.posts).toEqual([`/api/v1/cameras/${camera.id}/predict`])
    expect(errors).toEqual([])
  })

  test('denied prerequisite access is recoverable and does not look like missing configuration', async ({
    page,
  }) => {
    const { state, errors } = await setup(page)
    state.modelFailure = 403
    await page.goto('/dashboard/predictions')
    await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('alert')).toContainText('API Key tidak memiliki izin')
    await expect(dialog.getByText('Konfigurasi belum siap untuk prediksi')).not.toBeVisible()
    await dialog.locator('#pred-image').setInputFiles(image)
    await expect(
      dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true }),
    ).toBeDisabled()
    state.modelFailure = 0
    await dialog.getByRole('button', { name: 'Coba Lagi', exact: true }).click()
    await expect(
      dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true }),
    ).toBeEnabled()
    expect(errors).toEqual([])
  })

  test('camera A to B to A does not publish the first A response after a newer check', async ({
    page,
  }) => {
    const { state, errors } = await setup(page, [camera, secondCamera])
    let release!: () => void
    state.nextModelHold = {
      promise: new Promise<void>((resolve) => {
        release = resolve
      }),
      response: null,
    }
    const oldRequest = page.waitForRequest((request) =>
      request.url().includes(`/${camera.id}/ground-models/active`),
    )
    await page.goto('/dashboard/predictions')
    await oldRequest
    await page.getByRole('combobox').first().selectOption(secondCamera.id)
    await expect(
      page.getByText('Model cocok dengan kalibrasi dan referensi tanah aktif.'),
    ).toBeVisible()
    await page.getByRole('combobox').first().selectOption(camera.id)
    await expect(
      page.getByText('Model cocok dengan kalibrasi dan referensi tanah aktif.'),
    ).toBeVisible()
    const lateResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/${camera.id}/ground-models/active`) && response.status() === 404,
    )
    release()
    await (await lateResponse).finished()
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    )
    await expect(
      page.getByText('Model cocok dengan kalibrasi dan referensi tanah aktif.'),
    ).toBeVisible()
    await expect(page.getByText('Konfigurasi belum siap untuk prediksi')).not.toBeVisible()
    await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#pred-image').setInputFiles(image)
    await expect(
      dialog.getByRole('button', { name: 'Jalankan Prediksi', exact: true }),
    ).toBeEnabled()
    expect(errors).toEqual([])
  })

  for (const width of [390, 768, 1440]) {
    test(`readiness recovery remains usable at ${width}px`, async ({ page }, testInfo) => {
      const { state, errors } = await setup(page)
      state.scale = null
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/dashboard/predictions')
      await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
      const dialog = page.getByRole('dialog')
      const recovery = dialog.getByRole('link', { name: 'Buka Skala Kedalaman', exact: true })
      await expect(recovery).toBeVisible()
      await expect(dialog.locator('#pred-source-type')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(recovery).toBeFocused()
      expect(await recovery.evaluate((element) => {
        const style = getComputedStyle(element)
        return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2
      })).toBe(true)
      await expect(recovery).toBeInViewport({ ratio: 1 })
      expect(
        await recovery.evaluate((element) => element.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      )
      await expect(page.locator('.dialog-enter-active')).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath(`readiness-${width}.png`) })
      await page.setViewportSize({ width, height: 420 })
      await recovery.focus()
      await expect(recovery).toBeInViewport({ ratio: 1 })
      await dialog.locator('#pred-image').focus()
      await expect(dialog.locator('#pred-image')).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath(`readiness-short-${width}.png`) })
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
      await dialog.getByRole('button', { name: 'Batal', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      expect(errors).toEqual([])
    })
  }

  test('readiness recovery reflows with 200% text in a short viewport', async ({ page }, testInfo) => {
    const { state, errors } = await setup(page)
    state.scale = null
    await page.setViewportSize({ width: 720, height: 450 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard/predictions')
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    await page.getByRole('button', { name: 'Jalankan Prediksi Baru', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const recovery = dialog.getByRole('link', { name: 'Buka Skala Kedalaman', exact: true })
    await recovery.focus()
    await expect(recovery).toBeInViewport({ ratio: 1 })
    await dialog.locator('#pred-image').focus()
    await expect(dialog.locator('#pred-image')).toBeInViewport({ ratio: 1 })
    await dialog.getByRole('button', { name: 'Batal', exact: true }).focus()
    await expect(dialog.getByRole('button', { name: 'Batal', exact: true })).toBeInViewport({ ratio: 1 })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('readiness-text-200.png') })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    expect(errors).toEqual([])
  })
})
