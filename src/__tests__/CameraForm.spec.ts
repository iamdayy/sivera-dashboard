import { describe, expect, it } from 'vitest'
import { cameraPayload, createCameraForm } from '@/lib/camera-form'
import { camera } from '../../e2e/fixtures/api'

describe('camera form payload', () => {
  it('preserves the create defaults and omits empty coordinates from JSON', () => {
    const payload = cameraPayload({ ...createCameraForm(), name: 'Kamera fixture UI' })
    expect(JSON.parse(JSON.stringify(payload))).toEqual({
      name: 'Kamera fixture UI',
      resolution_w: 1920,
      resolution_h: 1080,
      fps: 15,
    })
  })

  it('keeps zero and decimal coordinates as numbers and empty PATCH RTSP omitted', () => {
    const form = createCameraForm({ ...camera, latitude: 0, longitude: 110.4215 })
    expect(form.latitude).toBe(0)
    const payload = cameraPayload({ ...form, resolution_w: '1280', fps: '30' }, true)
    expect(JSON.parse(JSON.stringify(payload))).toEqual({
      name: camera.name,
      resolution_w: 1280,
      resolution_h: 1080,
      fps: 30,
      latitude: 0,
      longitude: 110.4215,
    })
  })

  it('does not invent coordinates for null values', () => {
    const form = createCameraForm(camera)
    expect(form.latitude).toBe('')
    expect(form.longitude).toBe('')
    expect(cameraPayload({ ...form, latitude: '  ' }).latitude).toBeUndefined()
  })

  it.each(['', ' ', 'abc', 'NaN', 'Infinity', '0', '-1', '1.5', '10001'])(
    'rejects invalid required numeric input %j',
    (resolution_w) => {
      expect(() => cameraPayload({ ...createCameraForm(), resolution_w })).toThrow()
    },
  )

  it.each(['abc', 'NaN', 'Infinity', '91', '-91'])(
    'rejects invalid optional numeric input %j',
    (latitude) => {
      expect(() => cameraPayload({ ...createCameraForm(), latitude })).toThrow()
    },
  )
})
