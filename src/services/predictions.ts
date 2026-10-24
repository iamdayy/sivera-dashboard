import { apiClient, cameraPath, normalizeApiError } from './api'
import type { Calibration, GroundReference, PredictionJob, SubmitPredictionResult, PredictionOutput, DetectedInstance, VolumeEstimate, PaginatedList, PredictionPrerequisites } from '@/types'
import type { GroundModel } from './groundReferences'
import { getActiveDepthScale, isMissingActiveResource } from './depthScales'

export type { PredictionPrerequisites } from '@/types'

export type PredictionJobList = PaginatedList<PredictionJob>

export async function listPredictionJobs(cameraId: string, page = 1, pageSize = 20, status?: string): Promise<PredictionJobList> {
  try {
    const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() })
    if (status) params.append('status', status)
    const response = await apiClient.get<PredictionJobList>(cameraPath(cameraId, `/predict?${params}`))
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getPredictionJob(cameraId: string, jobId: string): Promise<PredictionJob> {
  try {
    const response = await apiClient.get<PredictionJob>(cameraPath(cameraId, `/predict/${jobId}`))
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
  max_frame_age_sec?: number
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
    if (payload.max_frame_age_sec !== undefined) formData.append('max_frame_age_sec', payload.max_frame_age_sec.toString())

    // return_outputs: omit = all outputs, [] = none, array = specific outputs
    // Always send the field to match backend contract
    if (payload.return_outputs !== undefined) {
      formData.append('return_outputs', JSON.stringify(payload.return_outputs))
    }

    // timestamp is only valid for upload source
    if (payload.source_type === 'upload') {
      if (payload.timestamp) formData.append('timestamp', payload.timestamp)
      if (payload.file) formData.append('file', payload.file)
    }

    const response = await apiClient.post<SubmitPredictionResult>(cameraPath(cameraId, '/predict'), formData)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function listPredictionOutputs(cameraId: string, jobId: string): Promise<PredictionOutput[]> {
  try {
    const response = await apiClient.get<{ outputs: PredictionOutput[] }>(cameraPath(cameraId, `/predict/${jobId}/outputs`))
    return response.data.outputs
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export function getOutputPath(cameraId: string, jobId: string, outputType: string): string {
  return cameraPath(cameraId, `/predict/${encodeURIComponent(jobId)}/outputs/${encodeURIComponent(outputType)}`)
}

export async function getPredictionInstances(cameraId: string, jobId: string): Promise<DetectedInstance[]> {
  try {
    const response = await apiClient.get<DetectedInstance[]>(cameraPath(cameraId, `/predict/${jobId}/instances`))
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getPredictionVolumes(cameraId: string, jobId: string): Promise<VolumeEstimate[]> {
  try {
    const response = await apiClient.get<VolumeEstimate[]>(cameraPath(cameraId, `/predict/${jobId}/volumes`))
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function checkPredictionPrerequisites(cameraId: string): Promise<PredictionPrerequisites> {
  const missing: string[] = []
  let activeCalibrationId: string | null = null
  let activeGroundModelId: string | null = null
  let activeDepthScaleId: string | null = null
  let activeGroundRefId: string | null = null

  // Check active calibration
  try {
    const calibration = await apiClient.get<Calibration>(cameraPath(cameraId, '/calibrations/active'))
    if (calibration.data.camera_id !== cameraId || !calibration.data.is_active) {
      throw { status: 409, code: 'depth_scale_prerequisites_changed', message: 'Kalibrasi aktif berubah. Muat ulang konfigurasi.' }
    }
    activeCalibrationId = calibration.data.id
  } catch (error) {
    if (!isMissingActiveResource(error)) throw normalizeApiError(error)
    missing.push('Kalibrasi aktif')
  }

  // Check active ground model
  try {
    if (activeCalibrationId) {
      const [model, reference] = await Promise.all([
        apiClient.get<GroundModel>(cameraPath(cameraId, '/ground-models/active')),
        apiClient.get<GroundReference>(cameraPath(cameraId, '/ground-references/active')),
      ])
      if (model.data.camera_id !== cameraId || model.data.calibration_id !== activeCalibrationId ||
          !reference.data.is_active || reference.data.camera_id !== cameraId || reference.data.calibration_id !== activeCalibrationId ||
          model.data.ground_ref_id !== reference.data.id) {
        missing.push('Model ground tidak cocok dengan kalibrasi/referensi aktif')
      } else {
        activeGroundModelId = model.data.id
        activeGroundRefId = reference.data.id
      }
    }
  } catch (error) {
    if (!isMissingActiveResource(error)) throw normalizeApiError(error)
  }
  if (!activeGroundModelId && !missing.some(label => label.startsWith('Model ground'))) missing.push('Model ground aktif')

  if (activeGroundModelId) {
    try {
      const scale = await getActiveDepthScale(cameraId, activeGroundModelId)
      if (scale.camera_id !== cameraId || scale.ground_model_id !== activeGroundModelId || !scale.is_active) {
        throw { status: 409, code: 'depth_scale_prerequisites_changed', message: 'Skala aktif tidak sesuai model ground. Muat ulang konfigurasi.' }
      }
      activeDepthScaleId = scale.id
    } catch (error) {
      if (!isMissingActiveResource(error)) throw normalizeApiError(error)
    }
  }
  if (!activeDepthScaleId) missing.push('Skala kedalaman aktif')

  return {
    has_active_calibration: !!activeCalibrationId,
    has_active_ground_model: !!activeGroundModelId,
    has_active_depth_scale: !!activeDepthScaleId,
    missing,
    active_calibration_id: activeCalibrationId,
    active_ground_model_id: activeGroundModelId,
    active_depth_scale_id: activeDepthScaleId,
    active_ground_ref_id: activeGroundRefId,
  }
}
