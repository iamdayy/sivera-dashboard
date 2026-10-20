import { apiClient, normalizeApiError, artifactUrl } from './api'
import type { PredictionJob, SubmitPredictionResult, PredictionOutput, DetectedInstance, VolumeEstimate, PaginatedList } from '@/types'

export type PredictionJobList = PaginatedList<PredictionJob>

export async function listPredictionJobs(cameraId: string, page = 1, pageSize = 20, status?: string): Promise<PredictionJobList> {
  try {
    const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() })
    if (status) params.append('status', status)
    const response = await apiClient.get<PredictionJobList>(`/cameras/${cameraId}/predict?${params}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getPredictionJob(cameraId: string, jobId: string): Promise<PredictionJob> {
  try {
    const response = await apiClient.get<PredictionJob>(`/cameras/${cameraId}/predict/${jobId}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export interface SubmitPredictionPayload {
  source_type: 'upload' | 'rtsp_frame' | 'latest_rtsp'
  seg_conf?: number
  seg_model?: string
  seg_classes?: string[]
  volume_cell_m?: number
  volume_min_pts_per_cell?: number
  return_outputs?: string[]
  file?: File
  timestamp?: string
}

export async function submitPrediction(cameraId: string, payload: SubmitPredictionPayload): Promise<SubmitPredictionResult> {
  try {
    const formData = new FormData()
    formData.append('source_type', payload.source_type)
    if (payload.seg_conf !== undefined) formData.append('seg_conf', payload.seg_conf.toString())
    if (payload.seg_model) formData.append('seg_model', payload.seg_model)
    if (payload.seg_classes?.length) formData.append('seg_classes', JSON.stringify(payload.seg_classes))
    if (payload.volume_cell_m !== undefined) formData.append('volume_cell_m', payload.volume_cell_m.toString())
    if (payload.volume_min_pts_per_cell !== undefined) formData.append('volume_min_pts_per_cell', payload.volume_min_pts_per_cell.toString())
    if (payload.return_outputs?.length) formData.append('return_outputs', JSON.stringify(payload.return_outputs))
    if (payload.timestamp) formData.append('timestamp', payload.timestamp)
    if (payload.source_type === 'upload' && payload.file) formData.append('file', payload.file)

    const response = await apiClient.post<SubmitPredictionResult>(`/cameras/${cameraId}/predict`, formData)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function listPredictionOutputs(cameraId: string, jobId: string): Promise<PredictionOutput[]> {
  try {
    const response = await apiClient.get<{ outputs: PredictionOutput[] }>(`/cameras/${cameraId}/predict/${jobId}/outputs`)
    return response.data.outputs
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export function getOutputUrl(cameraId: string, jobId: string, outputType: string): string {
  const base = new URL(apiClient.defaults.baseURL || '', window.location.origin)
  return new URL(`cameras/${cameraId}/predict/${jobId}/outputs/${outputType}`, base).toString()
}

export async function getPredictionInstances(cameraId: string, jobId: string): Promise<DetectedInstance[]> {
  try {
    const response = await apiClient.get<DetectedInstance[]>(`/cameras/${cameraId}/predict/${jobId}/instances`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getPredictionVolumes(cameraId: string, jobId: string): Promise<VolumeEstimate[]> {
  try {
    const response = await apiClient.get<VolumeEstimate[]>(`/cameras/${cameraId}/predict/${jobId}/volumes`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export interface PredictionPrerequisites {
  has_active_calibration: boolean
  has_active_ground_model: boolean
  missing: string[]
}

export async function checkPredictionPrerequisites(cameraId: string): Promise<PredictionPrerequisites> {
  const missing: string[] = []
  
  // Check active calibration
  try {
    await apiClient.get(`/cameras/${cameraId}/calibrations/active`)
  } catch {
    missing.push('Kalibrasi aktif')
  }

  // Check active ground model
  try {
    await apiClient.get(`/cameras/${cameraId}/ground-models/active`)
  } catch {
    missing.push('Model ground aktif')
  }

  // Note: Depth scale is created during prediction pipeline
  // No separate API endpoint to check

  return {
    has_active_calibration: !missing.includes('Kalibrasi aktif'),
    has_active_ground_model: !missing.includes('Model ground aktif'),
    missing,
  }
}