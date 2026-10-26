import type { Page } from '@playwright/test'
import { apiOrigin, camera } from './api'
import { setupOverview } from './overview'
import { predictionJob, volumeEstimate } from '../../src/__tests__/fixtures/prediction'
import type { DetectedInstance, VolumeEstimate } from '../../src/types'

export async function setupResults(page: Page) {
  const overview = await setupOverview(page, [camera])
  const volumes = [volumeEstimate(), volumeEstimate({
    id: '88888888-8888-4888-8888-888888888888', method: 'convex_hull',
    volume_m3: 0.18, volume_liter: 180, footprint_m2: 0.6, cell_m: null, n_cells: null,
  })]
  overview.state.jobs = [predictionJob({
    status: 'done', source_path: 'private/fixture-source.image', source_ts: '2026-10-26T07:59:00Z',
    calibration_id: '12121212-1212-4212-8212-121212121212',
    ground_model_id: '34343434-3434-4434-8434-343434343434',
    depth_scale_id: '56565656-5656-4656-8656-565656565656',
    volume_cell_m: 0.1, volume_min_pts_per_cell: 3, seg_conf: 0,
    result: { volume: { method_grid: volumes[0], method_convex_hull: volumes[1] } },
    completed_at: '2026-10-26T08:01:00Z',
  })]
  const state = { volumes: volumes as VolumeEstimate[], volumeStatus: 200, instances: [] as DetectedInstance[], reads: 0 }
  await page.route(`${apiOrigin}/api/v1/cameras/${camera.id}/predict/**`, async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/volumes')) {
      state.reads++
      return state.volumeStatus === 200 ? route.fulfill({ json: state.volumes }) : route.fulfill({ status: state.volumeStatus, json: { detail: 'Fixture volume access denied' } })
    }
    if (path.endsWith('/instances')) return route.fulfill({ json: state.instances })
    if (path.endsWith('/outputs')) return route.fulfill({ json: { outputs: [] } })
    return route.fallback()
  })
  return { ...overview, result: state }
}
