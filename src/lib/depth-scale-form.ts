import type { DepthMeasurement, DepthScaleCreate } from '@/types'

export interface MeasurementInput {
  id: number
  x: string
  y: string
  distance_m: string
}

export interface DepthScaleFormInput {
  // depth_model: string
  // clip_min_m: string
  // clip_max_m: string
  points: MeasurementInput[]
  // Optional: image URL key will be set after upload, or default to first calibration image
  // test_image?: string
}

export function createDepthScaleForm(): DepthScaleFormInput {
  return {
    // depth_model: 'yolo26n-depth.pt',
    // clip_min_m: '0.1',
    // clip_max_m: '50',
    points: []
  }
}

function numeric(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function depthScaleFormErrors(form: DepthScaleFormInput, width: number, height: number): string[] {
  const errors: string[] = []

  // depth_model is optional - only validate if provided
  // const model = form.depth_model?.trim()
  // if (model && (model.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9_.-]*\.pt$/.test(model))) {
  //   errors.push('Jika diisi, nama file model harus .pt yang terpasang di backend, tanpa path atau URL.')
  // }

  // clip_min_m/clip_max_m are optional - only validate if provided
  // const min = numeric(form.clip_min_m)
  // const max = numeric(form.clip_max_m)
  // if (min !== null && max !== null) {
  //   if (min < 0.01 || min > 10 || max < 5 || max > 200 || min >= max) {
  //     errors.push('Batas minimum harus 0,01–10 m, maksimum 5–200 m, dan minimum lebih kecil dari maksimum.')
  //   }
  // } else if (min !== null || max !== null) {
  //   // One provided without the other
  //   errors.push('Jika diisi, baik batas minimum maupun maksimum harus diisi keduanya.')
  // }

  if (form.points.length < 3 || form.points.length > 100) errors.push('Gunakan minimal 3 dan maksimal 100 titik pengukuran.')
  const seen = new Set<string>()
  const depths: number[] = []
  form.points.forEach((point, index) => {
    const x = numeric(point.x)
    const y = numeric(point.y)
    const z = numeric(point.distance_m)
    if (x === null || y === null || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
      errors.push(`Titik ${index + 1}: koordinat harus pixel integer di dalam gambar.`)
    } else {
      const key = `${x},${y}`
      if (seen.has(key)) errors.push(`Titik ${index + 1}: pixel sudah digunakan.`)
      seen.add(key)
    }
    // const min = numeric(form.clip_min_m)
    // const max = numeric(form.clip_max_m)
    // if (z === null || z <= 0 || (min !== null && z < min) || (max !== null && z > max)) {
    //   errors.push(`Titik ${index + 1}: isi kedalaman Z positif dalam rentang clip (m).`)
    // } else depths.push(z)
  })
  if (depths.length >= 3 && Math.max(...depths) - Math.min(...depths) <= 0.001) {
    errors.push('Gunakan titik dengan kedalaman yang bervariasi, bukan semua pada kedalaman yang sama.')
  }
  return errors
}

export function depthScalePayload(form: DepthScaleFormInput, width: number, height: number): DepthScaleCreate {
  const errors = depthScaleFormErrors(form, width, height)
  if (errors.length) throw new Error(errors[0])
  // test_image is now optional - backend will default to first calibration image
  const known_distances: DepthMeasurement[] = form.points.map(point => ({ x: Number(point.x), y: Number(point.y), distance_m: Number(point.distance_m) }))
  const payload: DepthScaleCreate = { known_distances }
  // if (form.test_image) payload.test_image = form.test_image
  // if (form.depth_model?.trim()) payload.depth_model = form.depth_model.trim()
  // const min = numeric(form.clip_min_m)
  // const max = numeric(form.clip_max_m)
  // if (min !== null && max !== null) {
  // payload.clip_min_m = min
  // payload.clip_max_m = max
  // }
  return payload
}

export function displayedPixel(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, width: number, height: number): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return null
  const scale = Math.min(rect.width / width, rect.height / height)
  const left = rect.left + (rect.width - width * scale) / 2
  const top = rect.top + (rect.height - height * scale) / 2
  const x = (clientX - left) / scale
  const y = (clientY - top) / scale
  if (x < 0 || y < 0 || x >= width || y >= height) return null
  return { x: Math.min(width - 1, Math.round(x)), y: Math.min(height - 1, Math.round(y)) }
}
