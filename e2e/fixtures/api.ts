import type { Page } from '@playwright/test'
import type { Camera, CameraDetail, CameraList, Calibration, CalibrationList, GroundReferenceList, HealthStatus } from '../../src/types'

export const apiOrigin = 'http://sivera-ui.test'
export const camera: Camera = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Kamera fixture UI',
  rtsp_url: null,
  latitude: null,
  longitude: null,
  resolution_w: 1920,
  resolution_h: 1080,
  fps: 15,
  roi_polygon: null,
  metadata: {},
  created_at: '2026-10-21T08:00:00Z',
  updated_at: '2026-10-21T08:00:00Z',
}

export const calibration: Calibration = {
  id: '22222222-2222-4222-8222-222222222222',
  camera_id: camera.id,
  version: 1,
  k_matrix: [[1000, 0, 960], [0, 1000, 540], [0, 0, 1]],
  dist_coeffs: [0, 0, 0, 0, 0],
  rms_reproj: 0,
  coverage_w: null,
  coverage_h: null,
  chessboard_cols: 9,
  chessboard_rows: 6,
  square_m: 0.025,
  calib_images: null,
  notes: null,
  is_active: true,
  created_at: camera.created_at,
}

export async function installApiFixture(page: Page, authenticated = false, items: Camera[] = []) {
  await page.addInitScript(({ origin, authenticated }) => {
    localStorage.setItem('api_base_url', origin)
    if (authenticated) localStorage.setItem('api_key', 'ui-fixture-not-a-credential')
    else localStorage.removeItem('api_key')
  }, { origin: apiOrigin, authenticated })

  await page.route(`${apiOrigin}/**`, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204 })
      return
    }
    if (request.method() !== 'GET') {
      await route.fulfill({ status: 501, json: { detail: 'Mutation not configured by this UI test' } })
      return
    }
    const health: HealthStatus = { status: 'ok', version: 'fixture', database: 'ok' }
    const list: CameraList = { items, total: items.length, page: 1, page_size: 20, total_pages: items.length ? 1 : 0 }
    const detail: CameraDetail = { ...camera, active_calibration_id: calibration.id, active_calibration_version: 1, active_calibration_rms: 0 }
    const calibrations: CalibrationList = { items: [calibration], total: 1 }
    const references: GroundReferenceList = { items: [], total: 0 }
    const responses: Record<string, unknown> = {
      '/health': health,
      '/cameras': list,
      [`/cameras/${camera.id}`]: detail,
      [`/cameras/${camera.id}/calibrations`]: calibrations,
      [`/cameras/${camera.id}/calibrations/active`]: calibration,
      [`/cameras/${camera.id}/ground-references`]: references,
      [`/cameras/${camera.id}/predict`]: { ...list, items: [], total: 0, total_pages: 0 },
    }
    if (path in responses) await route.fulfill({ json: responses[path] })
    else await route.fulfill({ status: 404, json: { detail: 'Not available in this UI fixture' } })
  })
}
