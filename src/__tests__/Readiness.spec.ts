import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, cameraPath, setConnection } from '@/services/api'
import {
  checkReadiness,
  getMissingPrerequisiteLabels,
  getPrerequisiteRecoveryPath,
} from '@/services/readiness'
import { checkPredictionPrerequisites } from '@/services/predictions'
import { getDepthScaleContext } from '@/services/depthScales'
import type { Calibration, DepthScale, GroundReference, PredictionSourceType } from '@/types'
import type { GroundModel } from '@/services/groundReferences'
import { calibration, camera, depthScale, groundModel, groundRef } from '../../e2e/fixtures/api'

let resources: Record<string, unknown>
let failures: Record<string, unknown>
const calibrationPath = cameraPath(camera.id, '/calibrations/active')
const modelPath = cameraPath(camera.id, '/ground-models/active')
const referencePath = cameraPath(camera.id, '/ground-references/active')
const scalePath = cameraPath(camera.id, `/ground-models/${groundModel.id}/depth-scales/active`)
const notFound = { status: 404, message: 'No active resource' }

beforeEach(() => {
  setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential')
  resources = {
    [calibrationPath]: { ...calibration },
    [modelPath]: { ...groundModel },
    [referencePath]: { ...groundRef },
    [scalePath]: { ...depthScale },
  }
  failures = {}
  vi.spyOn(apiClient, 'get').mockImplementation(async (path) => {
    if (path! in failures) throw failures[path!]
    if (!(path! in resources)) throw notFound
    return { data: resources[path!] }
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('prediction readiness (mock API responses)', () => {
  it('fetches the actual model before deriving readiness and preserves all configuration IDs', async () => {
    const result = await checkReadiness(camera.id)
    expect(result).toEqual({
      camera_id: camera.id,
      source_type: 'upload',
      ready: true,
      has_active_calibration: true,
      has_active_ground_model: true,
      has_active_depth_scale: true,
      calibration_intrinsics_missing: false,
      legacy_upload: false,
      missing: [],
      active_calibration_id: calibration.id,
      active_ground_model_id: groundModel.id,
      active_ground_ref_id: groundRef.id,
      active_depth_scale_id: depthScale.id,
      active_depth_model: depthScale.depth_model,
    })
    expect(apiClient.get).toHaveBeenCalledWith(modelPath, { signal: expect.any(AbortSignal) })
    expect(apiClient.get).toHaveBeenCalledWith(scalePath, { signal: expect.any(AbortSignal) })
    expect(apiClient.get).toHaveBeenCalledTimes(4)
  })

  it('keeps the prediction-service entry point as the exact same domain function', () => {
    expect(checkPredictionPrerequisites).toBe(checkReadiness)
  })

  it.each([
    [calibrationPath, 'prediction_requires_calibration', 'active_calibration_id'],
    [modelPath, 'prediction_requires_ground_model', 'active_ground_model_id'],
    [referencePath, 'prediction_requires_ground_reference', 'active_ground_ref_id'],
  ] as const)(
    'reports a missing resource at %s, not a network failure',
    async (path, code, idKey) => {
      delete resources[path]
      const result = await checkReadiness(camera.id)
      expect(result.ready).toBe(false)
      expect(result.missing).toEqual([code])
      expect(result[idKey]).toBeNull()
      expect(result.has_active_ground_model).toBe(false)
      expect(apiClient.get).not.toHaveBeenCalledWith(scalePath, expect.anything())
      expect(result.missing).not.toContain('prediction_requires_depth_scale')
    },
  )

  it.each([
    ['camera_id', camera.id + '-other', 'ground_model_context_mismatch'],
    ['calibration_id', '77777777-7777-4777-8777-777777777777', 'ground_model_calibration_mismatch'],
    ['ground_ref_id', '88888888-8888-4888-8888-888888888888', 'ground_model_reference_mismatch'],
  ] as const)(
    'distinguishes a model %s mismatch and retains the returned ID',
    async (field, value, code) => {
      resources[modelPath] = { ...groundModel, [field]: value } satisfies GroundModel
      const result = await checkReadiness(camera.id)
      expect(result.ready).toBe(false)
      expect(result.has_active_ground_model).toBe(false)
      expect(result.active_ground_model_id).toBe(groundModel.id)
      expect(result.missing).toEqual([code])
      expect(apiClient.get).not.toHaveBeenCalledWith(scalePath, expect.anything())
    },
  )

  it.each([
    [{ camera_id: 'other-camera' }, 'ground_reference_context_mismatch'],
    [{ is_active: false }, 'ground_reference_context_mismatch'],
    [{ calibration_id: 'other-calibration' }, 'ground_reference_calibration_mismatch'],
  ] as const)('does not use an incompatible active reference: %o', async (override, code) => {
    resources[referencePath] = { ...groundRef, ...override } satisfies GroundReference
    const result = await checkReadiness(camera.id)
    expect(result.missing).toEqual([code])
    expect(result.active_ground_ref_id).toBe(groundRef.id)
    expect(result.ready).toBe(false)
  })

  it.each([{ camera_id: 'other-camera' }, { is_active: false }])(
    'rejects a calibration outside the active camera context: %o',
    async (override) => {
      resources[calibrationPath] = { ...calibration, ...override } satisfies Calibration
      const result = await checkReadiness(camera.id)
      expect(result.missing).toContain('calibration_context_mismatch')
      expect(result.has_active_calibration).toBe(false)
      expect(result.active_calibration_id).toBe(calibration.id)
      expect(result.ready).toBe(false)
    },
  )

  it.each(['rtsp_frame', 'latest_rtsp'] satisfies PredictionSourceType[])(
    'requires original intrinsics for %s',
    async (source) => {
      resources[calibrationPath] = { ...calibration, k_original: null }
      const result = await checkReadiness(camera.id, source)
      expect(result.has_active_calibration).toBe(true)
      expect(result.has_active_ground_model).toBe(true)
      expect(result.has_active_depth_scale).toBe(true)
      expect(result.ready).toBe(false)
      expect(result.source_type).toBe(source)
      expect(result.missing).toEqual(['calibration_intrinsics_missing'])
    },
  )

  it.each(['resolution_w', 'resolution_h'] as const)(
    'requires calibration dimension %s for RTSP',
    async (field) => {
      resources[calibrationPath] = { ...calibration, [field]: null }
      expect(await checkReadiness(camera.id, 'rtsp_frame')).toMatchObject({
        ready: false,
        missing: ['calibration_intrinsics_missing'],
      })
    },
  )

  it('permits already-undistorted legacy uploads without pretending RTSP is ready', async () => {
    resources[calibrationPath] = {
      ...calibration,
      k_original: null,
      resolution_w: null,
      resolution_h: null,
    }
    expect(await checkReadiness(camera.id, 'upload')).toMatchObject({
      ready: true,
      legacy_upload: true,
      calibration_intrinsics_missing: true,
      missing: [],
    })
  })

  it('blocks uploads with original intrinsics but incomplete dimensions', async () => {
    resources[calibrationPath] = { ...calibration, resolution_w: null }
    expect(await checkReadiness(camera.id)).toMatchObject({
      ready: false,
      missing: ['calibration_invalid_intrinsics'],
    })
  })

  it('does not infer depth scale from calibration/model existence', async () => {
    delete resources[scalePath]
    expect(await checkReadiness(camera.id)).toMatchObject({
      ready: false,
      has_active_ground_model: true,
      has_active_depth_scale: false,
      active_depth_scale_id: null,
      missing: ['prediction_requires_depth_scale'],
    })
  })

  it.each([
    { camera_id: 'other-camera' },
    { ground_model_id: 'other-model' },
    { is_active: false },
  ])('rejects incompatible depth-scale response %o', async (override) => {
    resources[scalePath] = { ...depthScale, ...override } satisfies DepthScale
    expect(await checkReadiness(camera.id)).toMatchObject({
      ready: false,
      has_active_depth_scale: false,
      active_depth_scale_id: depthScale.id,
      missing: ['depth_scale_context_mismatch'],
    })
  })

  for (const path of [calibrationPath, modelPath, referencePath, scalePath]) {
    it.each([
      { status: 401, message: 'Key not active' },
      { status: 403, message: 'Scope denied' },
      { status: 503, message: 'Service unavailable' },
      { status: 409, code: 'depth_scale_prerequisites_changed', message: 'Configuration changed' },
      { status: 404, code: 'camera_not_found', message: 'Camera unavailable' },
    ])(`does not turn API failure at ${path} into missing setup: %o`, async (error) => {
      failures[path] = error
      await expect(checkReadiness(camera.id)).rejects.toMatchObject(error)
    })
  }

  it('does not turn a network failure into missing configuration', async () => {
    failures[modelPath] = new TypeError('Failed to fetch')
    await expect(checkReadiness(camera.id)).rejects.toMatchObject({
      status: null,
      message: expect.stringContaining('koneksi'),
    })
  })

  it('rejects a late response after the connection changes, before requesting a scale', async () => {
    let finish!: (value: { data: GroundModel }) => void
    const get = vi.mocked(apiClient.get)
    const previous = get.getMockImplementation()!
    get.mockImplementation((path, config) =>
      path === modelPath
        ? new Promise((resolve) => {
            finish = resolve
          })
        : previous(path, config),
    )
    const pending = checkReadiness(camera.id).catch((error) => error)
    setConnection('http://other-backend.test', 'other-fixture')
    finish({ data: groundModel })
    expect(await pending).toMatchObject({ code: 'ERR_CANCELED' })
    expect(get).not.toHaveBeenCalledWith(scalePath, expect.anything())
  })

  it('also rejects stale connection context during the scale read', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path) => {
      if (path === scalePath) setConnection('http://other-backend.test', 'other-fixture')
      return { data: resources[path!] }
    })
    await expect(checkReadiness(camera.id)).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  })

  it('shares compatibility rules with the depth-scale setup context', async () => {
    expect(await getDepthScaleContext(camera.id)).toEqual({ calibration, groundModel })
    resources[modelPath] = { ...groundModel, calibration_id: 'other-calibration' }
    await expect(getDepthScaleContext(camera.id)).rejects.toMatchObject({
      status: 409,
      code: 'depth_scale_prerequisites_changed',
    })
    expect(await checkReadiness(camera.id)).toMatchObject({
      missing: ['ground_model_calibration_mismatch'],
    })
  })

  it('offers Bahasa Indonesia explanations and real setup destinations', () => {
    expect(getMissingPrerequisiteLabels(['ground_model_calibration_mismatch'])).toEqual([
      'Model ground tidak cocok dengan kalibrasi aktif. Periksa Referensi Tanah.',
    ])
    expect(getPrerequisiteRecoveryPath('ground_model_calibration_mismatch')).toBe(
      '/dashboard/ground-references',
    )
    expect(getPrerequisiteRecoveryPath('calibration_intrinsics_missing')).toBe(
      '/dashboard/calibrations',
    )
    expect(getPrerequisiteRecoveryPath('prediction_requires_depth_scale')).toBe(
      '/dashboard/depth-scales',
    )
  })
})
