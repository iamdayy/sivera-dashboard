import { expect, test, type Page } from '@playwright/test'
import { apiOrigin, calibration, camera, installApiFixture } from './fixtures/api'
import { captureSession } from './fixtures/capture'
import type { CaptureResponse } from '../src/types'

async function setup(page: Page, session: CaptureResponse = captureSession()) {
  await page.clock.install()
  await installApiFixture(page, true, [{ ...camera, stream_enabled: true }])
  const root = `/api/v1/cameras/${camera.id}/calibration-captures`
  const state = {
    session,
    starts: 0,
    reads: 0,
    computes: [] as { path: string; body: string | null; key: string | undefined }[],
    computeHold: undefined as Promise<void> | undefined,
    computeFailure: null as { status: number; code?: string } | null,
    readStatus: 200,
    resultReady: false,
  }
  await page.route(`${apiOrigin}/api/v1/cameras/**`, async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path.endsWith('/calibrations')) {
      const items = state.resultReady ? [{ ...calibration, is_active: false }] : []
      return route.fulfill({ json: { items, total: items.length } })
    }
    if (path === root && request.method() === 'POST') {
      state.starts++
      return route.fulfill({ status: 202, json: captureSession({ status: 'queued', accepted: 0, captured: 0 }) })
    }
    if (path === `${root}/${session.session_id}/compute`) {
      state.computes.push({ path, body: request.postData(), key: request.headers()['x-api-key'] })
      if (state.computeHold) await state.computeHold
      if (state.computeFailure) return route.fulfill({ status: state.computeFailure.status, json: { detail: { code: state.computeFailure.code } } })
      state.session = { ...state.session, compute_status: 'queued', compute_error_code: null }
      return route.fulfill({ status: 202, json: state.session })
    }
    if (path === `${root}/${session.session_id}/images`) return route.fulfill({ json: { items: [], total: 0 } })
    if (path === `${root}/${session.session_id}`) {
      state.reads++
      if (state.readStatus !== 200) return route.fulfill({ status: state.readStatus, json: {} })
      return route.fulfill({ json: state.session })
    }
    return route.fallback()
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.text().includes('[Vue warn]')) errors.push(message.text()) })
  await page.goto('/dashboard/calibrations')
  await page.getByRole('button', { name: 'Mulai Capture', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Mulai Capture', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(session.session_id)
  await expect.poll(() => state.reads).toBeGreaterThan(0)
  return { state, errors }
}

test.describe('calibration capture compute (mock API)', () => {
  for (const width of [390, 1280]) {
    test(`retries a timed-out compute on the same capture and follows its result at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const { state, errors } = await setup(page)
      const dialog = page.getByRole('dialog')
      const compute = dialog.getByRole('button', { name: 'Mulai Compute', exact: true })
      await expect(compute).toBeDisabled()
      await expect(dialog).toContainText('Tunggu capture selesai')
      state.session.status = 'completed'
      await page.clock.fastForward(2100)
      await expect(compute).toBeEnabled()
      const stoppedReads = state.reads
      await page.clock.fastForward(10_000)
      expect(state.reads).toBe(stoppedReads)
      await compute.click()
      await expect(compute).toBeDisabled()
      await expect(dialog).toContainText('Compute sedang mengantre')
      state.session.compute_status = 'failed'
      state.session.compute_error_code = 'calibration_queue_timeout'
      await page.clock.fastForward(2100)
      const retry = dialog.getByRole('button', { name: 'Coba Compute Lagi', exact: true })
      await expect(retry).toBeEnabled()
      await expect(dialog.getByRole('alert')).toContainText('worker dan antrean calibration')
      const failedReads = state.reads
      await page.clock.fastForward(10_000)
      expect(state.reads).toBe(failedReads)

      let release!: () => void
      state.computeHold = new Promise(resolve => { release = resolve })
      await retry.focus()
      await page.keyboard.press('Enter')
      await expect(dialog.getByRole('button', { name: 'Mengantrekan Compute...' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await expect.poll(() => state.computes.length).toBe(2)
      release()
      await expect(dialog.getByRole('alert')).toBeHidden()
      await expect(dialog).toContainText('Compute sedang mengantre')
      await expect(compute).toBeDisabled()
      state.session.compute_status = 'running'
      await page.clock.fastForward(2100)
      await expect(dialog).toContainText('Compute sedang diproses')
      state.resultReady = true
      state.session = { ...state.session, compute_status: 'done', result_calibration_id: calibration.id }
      await page.clock.fastForward(2100)
      await expect(dialog).toContainText('Kalibrasi hasil compute belum aktif')
      await expect(compute).toBeDisabled()
      const completedReads = state.reads
      await page.clock.fastForward(10_000)
      expect(state.reads).toBe(completedReads)
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(page.getByRole('button', { name: 'Aktifkan kalibrasi v1', exact: true })).toBeEnabled()
      expect(state.starts).toBe(1)
      expect(state.computes).toEqual(Array.from({ length: 2 }, () => ({
        path: `/api/v1/cameras/${camera.id}/calibration-captures/${state.session.session_id}/compute`,
        body: null,
        key: 'ui-fixture-not-a-credential',
      })))
      expect(errors).toEqual([])
    })
  }

  test('shows permission failures without resubmitting, then resumes status reads after explicit refresh', async ({ page }) => {
    const { state, errors } = await setup(page, captureSession({ status: 'completed', compute_status: 'failed', compute_error_code: 'calibration_queue_timeout' }))
    const dialog = page.getByRole('dialog')
    state.computeFailure = { status: 403 }
    await dialog.getByRole('button', { name: 'Coba Compute Lagi' }).click()
    await expect(dialog).toContainText('API Key tidak memiliki izin')
    await page.clock.fastForward(10_000)
    expect(state.computes).toHaveLength(1)
    state.computeFailure = null
    state.readStatus = 403
    await dialog.getByRole('button', { name: 'Coba Compute Lagi' }).click()
    await expect(dialog).toContainText('Pemantauan dijeda')
    const reads = state.reads
    await page.clock.fastForward(10_000)
    expect(state.reads).toBe(reads)
    state.readStatus = 200
    state.session.compute_status = 'running'
    await dialog.getByRole('button', { name: 'Refresh Status' }).click()
    await expect(dialog).toContainText('Compute sedang diproses')
    await expect(dialog.getByRole('alert')).toBeHidden()
    expect(state.computes).toHaveLength(2)
    await page.keyboard.press('Escape')
    const closedReads = state.reads
    await page.clock.fastForward(10_000)
    expect(state.reads).toBe(closedReads)
    expect(errors).toEqual([])
  })

  test('renders the backend image requirement and keeps the existing capture after a rejected compute', async ({ page }) => {
    const { state, errors } = await setup(page, captureSession({ status: 'stopped', accepted: 5 }))
    state.computeFailure = { status: 409, code: 'calibration_insufficient_images' }
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Mulai Compute', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Gambar yang memenuhi syarat belum cukup')
    await expect(dialog).toContainText(state.session.session_id)
    expect(state.starts).toBe(1)
    expect(state.computes).toHaveLength(1)
    expect(errors).toEqual([])
  })
})
