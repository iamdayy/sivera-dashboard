import { describe, expect, it } from 'vitest'
import {
  createDepthScaleForm,
  depthScaleFormErrors,
  depthScalePayload,
} from '@/lib/depth-scale-form'
import type { DepthScaleCreate, DepthMeasurement } from '@/types'

const width = 1920
const height = 1080

function point(id: number, x: string, y: string, z: string): { id: number; x: string; y: string; distance_m: string } {
  return { id, x, y, distance_m: z }
}

describe('depth scale form validation and payload', () => {
  it('returns no errors for three valid points with varying depth', () => {
    const form = createDepthScaleForm()
    form.points = [point(1, '100', '200', '2.5'), point(2, '300', '400', '5.0'), point(3, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toEqual([])
  })

  it('requires at least 3 points', () => {
    const form = createDepthScaleForm()
    form.points = [point(4, '100', '200', '2.5'), point(5, '300', '400', '5.0')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Gunakan minimal 3 dan maksimal 100 titik pengukuran.',
    )
  })

  it('rejects more than 100 points', () => {
    const form = createDepthScaleForm()
    form.points = Array.from({ length: 101 }, (_, i) => point(i, String(i * 10), '0', String(i + 1)))

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Gunakan minimal 3 dan maksimal 100 titik pengukuran.',
    )
  })

  it('rejects non-integer coordinates', () => {
    const form = createDepthScaleForm()
    form.points = [point(6, '100.5', '200', '2.5'), point(7, '300', '400', '5.0'), point(8, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Titik 1: koordinat harus pixel integer di dalam gambar.',
    )
  })

  it('rejects negative coordinates', () => {
    const form = createDepthScaleForm()
    form.points = [point(9, '-1', '200', '2.5'), point(10, '300', '400', '5.0'), point(11, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Titik 1: koordinat harus pixel integer di dalam gambar.',
    )
  })

  it('rejects coordinates outside image dimensions', () => {
    const form = createDepthScaleForm()
    form.points = [point(12, String(width), '200', '2.5'), point(13, '300', '400', '5.0'), point(14, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      `Titik 1: koordinat di luar dimensi gambar (${width} × ${height}).`,
    )
  })

  it('rejects duplicate pixels', () => {
    const form = createDepthScaleForm()
    form.points = [point(14, '100', '200', '2.5'), point(15, '100', '200', '5.0'), point(16, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Titik 2: pixel sudah digunakan.',
    )
  })

  it('requires non-empty numeric depth for every point', () => {
    const form = createDepthScaleForm()
    form.points = [point(17, '100', '200', ''), point(18, '300', '400', '5.0'), point(19, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Titik 1: isi kedalaman Z (m) harus berupa angka terdefinisi.',
    )
  })

  it('rejects zero or negative depth', () => {
    const form = createDepthScaleForm()
    form.points = [point(19, '100', '200', '0'), point(20, '300', '400', '5.0'), point(21, '500', '600', '-1')]

    const errors = depthScaleFormErrors(form, width, height)
    expect(errors).toContain('Titik 1: kedalaman Z harus lebih besar dari 0 meter.')
    expect(errors).toContain('Titik 3: kedalaman Z harus lebih besar dari 0 meter.')
  })

  it('requires varying depth when at least 3 depths are present', () => {
    const form = createDepthScaleForm()
    form.points = [point(22, '100', '200', '2.5'), point(23, '300', '400', '2.5'), point(24, '500', '600', '2.5000001')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Gunakan titik dengan kedalaman yang bervariasi, bukan semua pada kedalaman yang sama.',
    )
  })

  it('does not fail depth-variance check when fewer than 3 depths present', () => {
    const form = createDepthScaleForm()
    form.points = [point(25, '100', '200', '2.5'), point(26, '300', '400', '')]

    expect(depthScaleFormErrors(form, width, height)).not.toContain(
      'Gunakan titik dengan kedalaman yang bervariasi, bukan semua pada kedalaman yang sama.',
    )
  })

  it('produces payload with only known_distances', () => {
    const form = createDepthScaleForm()
    form.points = [point(26, '100', '200', '2.5'), point(27, '300', '400', '5.0'), point(28, '500', '600', '7.5')]

    const payload: DepthScaleCreate = depthScalePayload(form, width, height)

    expect(Object.keys(payload)).toEqual(['known_distances'])
    expect(payload.known_distances).toEqual([
      { x: 100, y: 200, distance_m: 2.5 },
      { x: 300, y: 400, distance_m: 5.0 },
      { x: 500, y: 600, distance_m: 7.5 },
    ] as DepthMeasurement[])
  })

  it('throws on invalid payload', () => {
    const form = createDepthScaleForm()
    form.points = [point(29, '100', '200', '2.5'), point(30, '300', '400', '5.0')]

    expect(() => depthScalePayload(form, width, height)).toThrow()
  })

  it('rejects invalid depth model name', () => {
    const form = createDepthScaleForm()
    form.depth_model = '../etc/passwd.pt'
    form.points = [point(31, '100', '200', '2.5'), point(32, '300', '400', '5.0'), point(33, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Jika diisi, nama file model harus .pt yang terpasang di backend, tanpa path atau URL.',
    )
  })

  it('accepts valid depth model name', () => {
    const form = createDepthScaleForm()
    form.depth_model = 'yolo26n-depth.pt'
    form.points = [point(34, '100', '200', '2.5'), point(35, '300', '400', '5.0'), point(36, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toEqual([])
  })

  it('accepts positive clipping outside the previously invented UI range', () => {
    const form = createDepthScaleForm()
    form.clip_min_m = '0.005'
    form.clip_max_m = '50'
    form.points = [point(37, '100', '200', '2.5'), point(38, '300', '400', '5.0'), point(39, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toEqual([])
  })

  it('rejects min greater than max', () => {
    const form = createDepthScaleForm()
    form.clip_min_m = '10'
    form.clip_max_m = '5'
    form.points = [point(40, '100', '200', '2.5'), point(41, '300', '400', '5.0'), point(42, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toContain(
      'Batas minimum harus lebih kecil dari maksimum (default 0,1 dan 50 m).',
    )
  })

  it('uses the backend default when only one clip value is provided', () => {
    const form = createDepthScaleForm()
    form.clip_min_m = '0.1'
    form.points = [point(43, '100', '200', '2.5'), point(44, '300', '400', '5.0'), point(45, '500', '600', '7.5')]

    expect(depthScaleFormErrors(form, width, height)).toEqual([])
    expect(depthScalePayload(form, width, height)).toMatchObject({ clip_min_m: 0.1 })
    expect(depthScalePayload(form, width, height)).not.toHaveProperty('clip_max_m')
  })

  it('includes test_image and depth_model in payload when provided', () => {
    const form = createDepthScaleForm()
    form.depth_model = 'yolo26n-depth.pt'
    form.clip_min_m = '0.1'
    form.clip_max_m = '50'
    form.points = [point(46, '100', '200', '2.5'), point(47, '300', '400', '5.0'), point(48, '500', '600', '7.5')]

    const payload = depthScalePayload(form, width, height, 'img-123')

    expect(payload.test_image).toBe('img-123')
    expect(payload.depth_model).toBe('yolo26n-depth.pt')
    expect(payload.clip_min_m).toBe(0.1)
    expect(payload.clip_max_m).toBe(50)
  })

  it('omits optional fields when not provided', () => {
    const form = createDepthScaleForm()
    form.points = [point(49, '100', '200', '2.5'), point(50, '300', '400', '5.0'), point(51, '500', '600', '7.5')]

    const payload = depthScalePayload(form, width, height)

    expect(Object.keys(payload)).toEqual(['known_distances'])
  })

  it.each([0, -1, NaN, Infinity, 1.5])('blocks unknown or invalid dimensions %s', dimension => {
    const form = createDepthScaleForm()
    form.points = [1, 2, 3].map(i => point(i, String(i), '1', String(i)))
    expect(() => depthScalePayload(form, dimension, height)).toThrow('Dimensi gambar')
    expect(() => depthScalePayload(form, width, dimension)).toThrow('Dimensi gambar')
  })

  it.each(['', ' ', 'NaN', 'Infinity', 'abc'])('rejects blank or nonfinite coordinates and Z: %j', value => {
    const form = createDepthScaleForm()
    form.points = [1, 2, 3].map(i => point(i, String(i), '1', String(i)))
    for (const field of ['x', 'y', 'distance_m'] as const) {
      const changed = { ...form, points: form.points.map(p => ({ ...p, [field]: value })) }
      expect(() => depthScalePayload(changed, width, height)).toThrow()
    }
  })

  it.each(['NaN', 'Infinity', 'abc', '0', '-1'])('rejects invalid optional clipping %s', value => {
    const form = createDepthScaleForm()
    form.points = [1, 2, 3].map(i => point(i, String(i), '1', String(i)))
    for (const field of ['clip_min_m', 'clip_max_m'] as const) {
      expect(() => depthScalePayload({ ...form, [field]: value }, width, height)).toThrow('Batas kedalaman')
    }
  })

  it('enforces the 100-character model limit and effective clipping bounds for measurements', () => {
    const form = createDepthScaleForm()
    form.points = [1, 2, 3].map(i => point(i, String(i), '1', String(i)))
    form.depth_model = 'a'.repeat(97) + '.pt'
    expect(depthScaleFormErrors(form, width, height)).toEqual([])
    form.depth_model = 'a'.repeat(98) + '.pt'
    expect(() => depthScalePayload(form, width, height)).toThrow('nama file model')
    form.depth_model = ''
    form.points[0]!.distance_m = '0.01'
    expect(depthScaleFormErrors(form, width, height)).toContain('Titik 1: kedalaman Z harus berada dalam batas 0.1–50 m.')
    form.clip_min_m = '0.01'
    expect(depthScaleFormErrors(form, width, height)).toEqual([])
  })
})
