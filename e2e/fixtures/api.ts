import type { Page } from '@playwright/test'
import type { Camera, CameraDetail, CameraList, Calibration, CalibrationList, GroundReference, GroundReferenceList, HealthStatus } from '../../src/types'

export const apiOrigin = 'http://sivera-ui.test'
export const camera: Camera = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Kamera fixture UI',
  rtsp_url: null,
  rtsp_configured: false,
  stream_enabled: false,
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
  k_original: [[1000, 0, 960], [0, 1000, 540], [0, 0, 1]],
  k_undist: [[1000, 0, 960], [0, 1000, 540], [0, 0, 1]],
  resolution_w: 1920,
  resolution_h: 1080,
  alpha: 0,
  per_view_errors: [0],
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

export const groundRef: GroundReference = {
  id: '33333333-3333-4333-8333-333333333333',
  camera_id: camera.id,
  calibration_id: calibration.id,
  version: 1,
  image_points: [[100, 100], [1820, 100], [1820, 980], [100, 980]],
  world_points: [[0, 0], [2, 0], [2, 2], [0, 2]],
  world_units: 'meter',
  description: 'Referensi fixture UI',
  is_active: true,
  created_at: '2026-10-21T09:00:00Z',
}

export const inactiveGroundRef: GroundReference = {
  ...groundRef,
  id: '44444444-4444-4444-8444-444444444444',
  version: 2,
  is_active: false,
  description: 'Referensi tidak aktif',
  created_at: '2026-10-21T10:00:00Z',
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
    const health: HealthStatus = { status: 'healthy', version: 'fixture', database: 'connected' }
    const list: CameraList = { items, total: items.length, page: 1, page_size: 20, total_pages: items.length ? 1 : 0 }
    const detail: CameraDetail = { ...camera, active_calibration_id: calibration.id, active_calibration_version: 1, active_calibration_rms: 0 }
    const calibrations: CalibrationList = { items: [calibration], total: 1 }
    const references: GroundReferenceList = { items: [], total: 0 }
    const responses: Record<string, unknown> = {
      '/health': health,
      '/api/v1/cameras': list,
      [`/api/v1/cameras/${camera.id}`]: detail,
      [`/api/v1/cameras/${camera.id}/calibrations`]: calibrations,
      [`/api/v1/cameras/${camera.id}/calibrations/active`]: calibration,
      [`/api/v1/cameras/${camera.id}/ground-references`]: references,
      [`/api/v1/cameras/${camera.id}/predict`]: { ...list, items: [], total: 0, total_pages: 0 },
    }
    if (path in responses) await route.fulfill({ json: responses[path] })
    else await route.fulfill({ status: 404, json: { detail: 'Not available in this UI fixture' } })
  })
}

async function setupGroundReferences(page: Page, items: GroundReference[] = [groundRef, inactiveGroundRef], cameras = [camera]) {
  await installApiFixture(page, true, cameras)
  const state = {
    items: items.map(item => ({ ...item })),
    fail: { camera: false, list: false, create: false, activate: false, model: false, bev: false },
    hold: undefined as Promise<void> | undefined,
    cameraHold: undefined as Promise<void> | undefined,
    listHolds: {} as Record<string, Promise<void> | undefined>,
    loads: [] as string[],
    calls: [] as { method: string; path: string; key: string | undefined; form?: FormData }[],
  }
  await page.route(new RegExp(`^${apiOrigin}/api/v1/cameras(?:\\?|$)`), async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (state.cameraHold) await state.cameraHold
    if (state.fail.camera) return route.fulfill({ status: 503, json: { detail: 'Camera fixture error' } })
    return route.fallback()
  })
  await page.route(new RegExp(`^${apiOrigin}/api/v1/cameras/[^/]+/(ground-references|ground-models|calibrations)(?:/|$)`), async route => {
    const request = route.request()
    const method = request.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204 })
    const path = new URL(request.url()).pathname
    const cameraId = path.split('/')[4]!
    
    if (method === 'GET' && path.endsWith('/calibrations/active')) {
      return route.fulfill({ json: calibration })
    }
    if (method === 'GET' && path.endsWith('/undistort-preview')) {
      return route.fulfill({ json: { preview_url: `${apiOrigin}/files/returned-preview.png`, original_size: [1920, 1080], undistorted_size: [1920, 1080], k_undist: calibration.k_matrix } })
    }
    if (method === 'GET' && path.endsWith('/ground-references')) {
      state.loads.push(cameraId)
      const rows = state.items.filter(item => item.camera_id === cameraId).map(item => ({ ...item }))
      if (state.listHolds[cameraId]) await state.listHolds[cameraId]
      if (state.fail.list) return route.fulfill({ status: 503, json: { detail: 'Ground reference fixture error' } })
      return route.fulfill({ json: { items: rows, total: rows.length } })
    }
    if (method === 'GET' && path.endsWith('/ground-references/active')) {
      const active = state.items.find(item => item.camera_id === cameraId && item.is_active)
      if (!active) return route.fulfill({ status: 404, json: { detail: 'No active ground reference' } })
      return route.fulfill({ json: active })
    }
    if (method === 'GET' && path.includes('/ground-models/active')) {
      if (state.fail.model) return route.fulfill({ status: 404, json: { detail: 'Ground model fixture error' } })
      const activeRef = state.items.find(item => item.camera_id === cameraId && item.is_active)
      if (!activeRef) return route.fulfill({ status: 404, json: { detail: 'No active ground reference' } })
      return route.fulfill({ json: {
        id: '55555555-5555-4555-8555-555555555555',
        camera_id: cameraId,
        calibration_id: calibration.id,
        ground_ref_id: activeRef.id,
        R_matrix: [[1,0,0],[0,1,0],[0,0,1]],
        t_vector: [0,0,5],
        H_i2w: [[1,0,0],[0,1,0],[0,0,1]],
        H_w2i: [[1,0,0],[0,1,0],[0,0,1]],
        cam_height: 5.0,
        pitch_down_deg: 45.0,
        reproj_err_px: 0.15,
        bev_ppm: 200,
        bev_margin_m: 1.0,
        created_at: '2026-10-21T09:00:00Z',
      }})
    }
    if (method === 'POST' && path.endsWith('/ground-references')) {
      const call = { method, path, key: request.headers()['x-api-key'], form: undefined as FormData | undefined }
      state.calls.push(call)
      if (state.hold) await state.hold
      if (state.fail.create) return route.fulfill({ status: 400, json: { detail: 'Need at least 4 point correspondences' } })
      const created = { ...groundRef, camera_id: cameraId, id: '66666666-6666-4666-8666-666666666666', version: 3, is_active: true }
      state.items = state.items.map(item => ({ ...item, is_active: false }))
      state.items.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    if (method === 'POST' && path.endsWith('/activate')) {
      if (state.fail.activate) return route.fulfill({ status: 403, json: { detail: 'Activation fixture error' } })
      const id = path.split('/')[6]
      state.items = state.items.map(item => item.camera_id === cameraId ? { ...item, is_active: item.id === id } : item)
      return route.fulfill({ json: { ...state.items.find(i => i.id === id), is_active: true } })
    }
    if (method === 'GET' && path.includes('/bev-preview')) {
      if (state.fail.bev) return route.fulfill({ status: 404, json: { detail: 'BEV preview fixture error' } })
      return route.fulfill({ json: {
        bev_image_url: `${apiOrigin}/files/returned-bev.png`,
        bev_mask_url: `${apiOrigin}/files/returned-bev-mask.png`,
        bev_overlay_url: `${apiOrigin}/files/returned-bev-overlay.png`,
        bev_info: { width_px: 400, height_px: 400, ppm: 200 },
      }})
    }
    return route.fallback()
  })

  await page.route(`${apiOrigin}/files/returned-preview.png`, route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fkAAAAASUVORK5CYII=', 'base64') }))
  await page.route(`${apiOrigin}/files/returned-bev.png`, route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fkAAAAASUVORK5CYII=', 'base64') }))
  await page.route(`${apiOrigin}/files/returned-bev-mask.png`, route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fkAAAAASUVORK5CYII=', 'base64') }))
  await page.route(`${apiOrigin}/files/returned-bev-overlay.png`, route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fkAAAAASUVORK5CYII=', 'base64') }))

  return state
}

export { setupGroundReferences }
