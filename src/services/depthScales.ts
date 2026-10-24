import { apiClient, cameraPath, getConnectionContext, normalizeApiError } from './api'
import { fetchArtifactBlob, requireImageBlob, trustedArtifactUrl } from './artifacts'
import type { Calibration, DepthScale, DepthScaleCreate, DepthScaleListResponse, DepthScaleImageResponse, GroundReference } from '@/types'
import type { GroundModel } from './groundReferences'

// Deployment inference defaults to 120 s. Upload/preparation/persistence need additional time.
export const DEPTH_SCALE_CREATE_TIMEOUT_MS = 180_000
export type CreateDepthScalePayload = DepthScaleCreate

export interface DepthScaleContext {
  calibration: Calibration
  groundModel: GroundModel
}

export function depthScaleContextKey(context: DepthScaleContext): string {
  return `${context.groundModel.camera_id}/${context.calibration.id}/${context.groundModel.id}/${context.groundModel.ground_ref_id}`
}

export function isMissingActiveResource(error: unknown): boolean {
  const normalized = normalizeApiError(error)
  return normalized.status === 404 && !normalized.code
}

export async function getDepthScaleContext(cameraId: string, signal?: AbortSignal): Promise<DepthScaleContext> {
  try {
    const calibration = (await apiClient.get<Calibration>(cameraPath(cameraId, '/calibrations/active'), { signal })).data
    const [modelResponse, referenceResponse] = await Promise.all([
      apiClient.get<GroundModel>(cameraPath(cameraId, '/ground-models/active'), { signal }),
      apiClient.get<GroundReference>(cameraPath(cameraId, '/ground-references/active'), { signal }),
    ])
    const groundModel = modelResponse.data
    const reference = referenceResponse.data
    if (!calibration.is_active || calibration.camera_id !== cameraId || groundModel.camera_id !== cameraId ||
        groundModel.calibration_id !== calibration.id || reference.camera_id !== cameraId || !reference.is_active ||
        reference.calibration_id !== calibration.id || groundModel.ground_ref_id !== reference.id) {
      throw { status: 409, code: 'depth_scale_prerequisites_changed', message: 'Konfigurasi aktif berubah. Muat ulang kalibrasi dan referensi tanah.' }
    }
    return { calibration, groundModel }
  } catch (error) {
    if (isMissingActiveResource(error)) {
      throw { status: 404, message: 'Kalibrasi dan referensi tanah dengan model ground yang sesuai harus aktif terlebih dahulu.' }
    }
    throw normalizeApiError(error)
  }
}

export async function listDepthScales(cameraId: string, groundModelId: string, signal?: AbortSignal): Promise<DepthScaleListResponse> {
  try {
    const response = await apiClient.get<DepthScaleListResponse>(
      cameraPath(cameraId, `/ground-models/${encodeURIComponent(groundModelId)}/depth-scales`), { signal }
    )
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getActiveDepthScale(cameraId: string, groundModelId: string, signal?: AbortSignal): Promise<DepthScale> {
  try {
    const response = await apiClient.get<DepthScale>(
      cameraPath(cameraId, `/ground-models/${encodeURIComponent(groundModelId)}/depth-scales/active`), { signal }
    )
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getDepthScale(cameraId: string, groundModelId: string, depthScaleId: string): Promise<DepthScale> {
  try {
    const response = await apiClient.get<DepthScale>(
      cameraPath(cameraId, `/ground-models/${encodeURIComponent(groundModelId)}/depth-scales/${encodeURIComponent(depthScaleId)}`)
    )
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function createDepthScale(
  cameraId: string,
  groundModelId: string,
  payload: CreateDepthScalePayload,
  signal?: AbortSignal
): Promise<DepthScale> {
  try {
    const response = await apiClient.post<DepthScale>(
      cameraPath(cameraId, `/ground-models/${encodeURIComponent(groundModelId)}/depth-scales`),
      payload,
      { timeout: DEPTH_SCALE_CREATE_TIMEOUT_MS, signal }
    )
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function activateDepthScale(
  cameraId: string,
  groundModelId: string,
  depthScaleId: string,
  signal?: AbortSignal
): Promise<DepthScale> {
  try {
    const response = await apiClient.post<DepthScale>(
      cameraPath(cameraId, `/ground-models/${encodeURIComponent(groundModelId)}/depth-scales/${encodeURIComponent(depthScaleId)}/activate`),
      undefined, { signal }
    )
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function uploadDepthScaleImage(
  cameraId: string,
  groundModelId: string,
  file: File,
  signal?: AbortSignal
): Promise<DepthScaleImageResponse> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<DepthScaleImageResponse>(
      cameraPath(cameraId, `/ground-models/${encodeURIComponent(groundModelId)}/depth-scales/test-images`),
      formData,
      {
        signal,
      }
    )
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function fetchDepthScaleImageBlob(
  cameraId: string,
  groundModelId: string,
  image: DepthScaleImageResponse,
  signal?: AbortSignal
): Promise<Blob> {
  try {
    const context = getConnectionContext()
    const url = trustedArtifactUrl(image.image_url, context)
    const expected = cameraPath(cameraId, `/ground-models/${encodeURIComponent(groundModelId)}/depth-scales/test-images/${encodeURIComponent(image.image_id)}/image`)
    if (new URL(url).pathname !== expected || image.coordinate_system !== 'undistorted_pixels' ||
        image.distance_type !== 'camera_axis_z_m' || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
        image.width <= 0 || image.height <= 0) {
      throw { status: null, message: 'Konteks atau dimensi preview tidak sesuai dengan gambar pengukuran.' }
    }
    return requireImageBlob(await fetchArtifactBlob(url, context, signal))
  } catch (error) {
    throw normalizeApiError(error)
  }
}
