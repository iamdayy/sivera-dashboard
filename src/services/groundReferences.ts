import { apiClient, normalizeApiError, artifactUrl } from './api'
import type { GroundReference, GroundReferenceList } from '@/types'

export async function listGroundReferences(cameraId: string): Promise<GroundReferenceList> {
  try {
    const response = await apiClient.get<GroundReferenceList>(`/cameras/${cameraId}/ground-references`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getActiveGroundReference(cameraId: string): Promise<GroundReference> {
  try {
    const response = await apiClient.get<GroundReference>(`/cameras/${cameraId}/ground-references/active`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getGroundReference(cameraId: string, groundRefId: string): Promise<GroundReference> {
  try {
    const response = await apiClient.get<GroundReference>(`/cameras/${cameraId}/ground-references/${groundRefId}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export interface CreateGroundReferencePayload {
  image_points: number[][]
  world_points: number[][]
  world_units: 'meter' | 'metre'
  description?: string
}

export async function createGroundReference(cameraId: string, payload: CreateGroundReferencePayload): Promise<GroundReference> {
  try {
    const formData = new FormData()
    formData.append('image_points', JSON.stringify(payload.image_points))
    formData.append('world_points', JSON.stringify(payload.world_points))
    formData.append('world_units', payload.world_units)
    if (payload.description) formData.append('description', payload.description)

    const response = await apiClient.post<GroundReference>(`/cameras/${cameraId}/ground-references`, formData)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function activateGroundReference(cameraId: string, groundRefId: string): Promise<GroundReference> {
  try {
    const response = await apiClient.post<GroundReference>(`/cameras/${cameraId}/ground-references/${groundRefId}/activate`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export interface GroundModel {
  id: string
  camera_id: string
  calibration_id: string
  ground_ref_id: string
  R_matrix: number[][]
  t_vector: number[]
  H_i2w: number[][]
  H_w2i: number[][]
  cam_height: number | null
  pitch_down_deg: number | null
  reproj_err_px: number | null
  bev_ppm: number
  bev_margin_m: number
  created_at: string
}

export async function getActiveGroundModel(cameraId: string): Promise<GroundModel> {
  try {
    const response = await apiClient.get<GroundModel>(`/cameras/${cameraId}/ground-models/active`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getGroundModel(cameraId: string, groundModelId: string): Promise<GroundModel> {
  try {
    const response = await apiClient.get<GroundModel>(`/cameras/${cameraId}/ground-models/${groundModelId}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getGroundModelByRef(cameraId: string, groundRefId: string): Promise<GroundModel | null> {
  try {
    // Backend doesn't have this endpoint; we fetch active and check if it matches
    const active = await getActiveGroundModel(cameraId)
    if (active.ground_ref_id === groundRefId) return active
    return null
  } catch {
    return null
  }
}

export interface BEVPreview {
  bev_image_url: string
  bev_mask_url: string
  bev_overlay_url: string
  bev_info: Record<string, unknown>
}

export async function getBEVPreview(cameraId: string, groundModelId: string, testImagePath?: string, maskPath?: string): Promise<BEVPreview> {
  try {
    const params = new URLSearchParams()
    if (testImagePath) params.append('test_image_path', testImagePath)
    if (maskPath) params.append('mask_path', maskPath)

    const response = await apiClient.get<BEVPreview>(`/cameras/${cameraId}/ground-models/${groundModelId}/bev-preview?${params}`)
    return {
      bev_image_url: artifactUrl(response.data.bev_image_url),
      bev_mask_url: artifactUrl(response.data.bev_mask_url),
      bev_overlay_url: artifactUrl(response.data.bev_overlay_url),
      bev_info: response.data.bev_info,
    }
  } catch (error) {
    throw normalizeApiError(error)
  }
}