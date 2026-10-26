import type { Page } from '@playwright/test'
import { apiOrigin, calibration, camera, depthScale, groundModel, groundRef, installApiFixture } from './api'
import type { Camera, PredictionJob } from '../../src/types'

export const secondCamera: Camera = {
  ...camera, id: '99999999-9999-4999-8999-999999999999', name: 'Kamera kedua fixture UI',
  rtsp_configured: true, stream_enabled: true,
}

export async function setupOverview(page: Page, cameras: Camera[] = [camera, secondCamera]) {
  await installApiFixture(page, true, cameras)
  const state = {
    calibration: true, ground: true, depth: true, legacy: false, readinessStatus: 200,
    camerasStatus: 200, detailStatus: 200, historyStatus: 200,
    historyFailureCamera: '', jobs: [] as PredictionJob[],
    modelHold: undefined as Promise<void> | undefined,
    statsHold: undefined as Promise<void> | undefined,
    detailHold: undefined as Promise<void> | undefined,
    reads: [] as string[],
  }
  await page.route(`${apiOrigin}/api/v1/**`, async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (request.method() !== 'GET') return route.fallback()
    const url = new URL(request.url())
    const path = url.pathname
    state.reads.push(path)
    const id = path.split('/')[4]
    if (!id) {
      if (state.camerasStatus !== 200) return route.fulfill({ status: state.camerasStatus, json: { detail: 'Fixture access denial' } })
      return route.fallback()
    }
    const selected = cameras.find(item => item.id === id)
    const missing = () => route.fulfill({ status: 404, json: { detail: 'No active resource in fixture' } })
    if (path.endsWith('/calibrations/active')) return state.calibration ? route.fulfill({ json: { ...calibration, camera_id: id, k_original: state.legacy ? null : calibration.k_original } }) : missing()
    if (path.endsWith('/ground-references/active')) return state.ground ? route.fulfill({ json: { ...groundRef, camera_id: id } }) : missing()
    if (path.endsWith('/ground-models/active')) {
      const present = state.ground
      const hold = state.modelHold
      state.modelHold = undefined
      if (hold) await hold
      if (state.readinessStatus !== 200) return route.fulfill({ status: state.readinessStatus, json: { detail: 'Fixture readiness denial' } })
      return present ? route.fulfill({ json: { ...groundModel, camera_id: id } }) : missing()
    }
    if (path.endsWith('/depth-scales/active')) return state.depth ? route.fulfill({ json: { ...depthScale, camera_id: id } }) : missing()
    if (path.endsWith('/calibrations')) {
      if (state.statsHold) await state.statsHold
      return route.fulfill({ json: { items: state.calibration ? [{ ...calibration, camera_id: id }] : [], total: Number(state.calibration) } })
    }
    if (path.endsWith('/ground-references')) return route.fulfill({ json: { items: state.ground ? [{ ...groundRef, camera_id: id }] : [], total: Number(state.ground) } })
    if (path.endsWith('/predict')) {
      if (state.historyStatus !== 200 && (!state.historyFailureCamera || state.historyFailureCamera === id)) return route.fulfill({ status: state.historyStatus, json: { detail: 'Fixture history denial' } })
      const items = state.jobs.filter(job => job.camera_id === id && (!url.searchParams.get('status') || job.status === url.searchParams.get('status')))
      return route.fulfill({ json: { items, page: 1, page_size: 20, total: items.length, total_pages: items.length ? 1 : 0 } })
    }
    if (selected && path === `/api/v1/cameras/${id}`) {
      const status = state.detailStatus
      const hold = state.detailHold
      state.detailHold = undefined
      if (hold) await hold
      if (status !== 200) return route.fulfill({ status, json: { detail: 'Fixture detail failure' } })
      return route.fulfill({ json: { ...selected, active_calibration_id: state.calibration ? calibration.id : null, active_calibration_version: state.calibration ? 1 : null, active_calibration_rms: state.calibration ? 0 : null } })
    }
    const job = state.jobs.find(item => item.camera_id === id && path === `/api/v1/cameras/${id}/predict/${item.id}`)
    if (job) return route.fulfill({ json: job })
    return route.fallback()
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.text().includes('[Vue warn]')) errors.push(message.text()) })
  return { state, errors }
}
