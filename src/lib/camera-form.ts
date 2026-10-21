import type { Camera, CreateCameraPayload } from '@/types'

type NumericInput = string | number

export interface CameraForm {
  name: string
  rtsp_url: string
  resolution_w: NumericInput
  resolution_h: NumericInput
  fps: NumericInput
  latitude: NumericInput
  longitude: NumericInput
}

export function createCameraForm(camera?: Camera): CameraForm {
  return {
    name: camera?.name ?? '',
    rtsp_url: camera?.rtsp_url ?? '',
    resolution_w: camera?.resolution_w ?? 1920,
    resolution_h: camera?.resolution_h ?? 1080,
    fps: camera?.fps ?? 15,
    latitude: camera?.latitude ?? '',
    longitude: camera?.longitude ?? '',
  }
}

function numericValue(
  value: NumericInput,
  label: string,
  min: number,
  max: number,
  optional = false,
): number | undefined {
  if (typeof value === 'string' && value.trim() === '') {
    if (optional) return undefined
    throw new Error(`${label} wajib diisi.`)
  }
  const number = Number(value)
  if (
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    (!optional && !Number.isInteger(number))
  ) {
    throw new Error(
      `${label} harus ${optional ? 'bernilai' : 'berupa bilangan bulat'} antara ${min} dan ${max}.`,
    )
  }
  return number
}

export function cameraPayload(form: CameraForm, editing = false): CreateCameraPayload {
  const resolution_w = numericValue(form.resolution_w, 'Resolusi W', 1, 10000)
  const resolution_h = numericValue(form.resolution_h, 'Resolusi H', 1, 10000)
  const fps = numericValue(form.fps, 'FPS', 1, 120)
  if (resolution_w === undefined || resolution_h === undefined || fps === undefined) {
    throw new Error('Resolusi dan FPS wajib diisi.')
  }
  return {
    name: form.name,
    rtsp_url: editing ? form.rtsp_url || undefined : form.rtsp_url,
    resolution_w,
    resolution_h,
    fps,
    latitude: numericValue(form.latitude, 'Latitude', -90, 90, true),
    longitude: numericValue(form.longitude, 'Longitude', -180, 180, true),
  }
}
