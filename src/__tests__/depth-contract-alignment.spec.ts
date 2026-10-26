import { describe, expect, it } from 'vitest'
import { createDepthScaleForm, depthScalePayload } from '@/lib/depth-scale-form'
import { getMissingPrerequisiteLabels, getPrerequisiteRecoveryPath } from '@/services/readiness'

describe('depth scale image and identity contract', () => {
  it('binds preview measurements to the uploaded source key', () => {
    const form = createDepthScaleForm()
    form.points = [1, 2, 3].map(id => ({ id, x: String(id * 10), y: '20', distance_m: String(id) }))
    const source = 'cameras/camera/depth-scale-images/ground/image/source.image'
    const payload = depthScalePayload(form, 640, 480, source)
    expect(payload.test_image).toBe(source)
    expect(payload.known_distances[0]).toEqual({ x: 10, y: 20, distance_m: 1 })
    expect(depthScalePayload(form, 640, 480)).not.toHaveProperty('test_image')
  })

  it.each(['depth_scale_identity_missing', 'depth_scale_model_mismatch', 'depth_scale_invalid_saved_fit'] as const)(
    'provides a recovery action for %s', code => {
      expect(getMissingPrerequisiteLabels([code])[0]).toContain('Buat skala')
      expect(getPrerequisiteRecoveryPath(code)).toBe('/dashboard/depth-scales')
    },
  )
})
