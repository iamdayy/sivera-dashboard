import { assertCurrentConnection, getConnectionContext, normalizeApiError } from './api'
import { getActiveDepthScale } from './depthScales'
import { isMissingActiveResource, resolveMeasurementContext } from './measurementContext'
import type {
  DepthScale,
  PredictionPrerequisiteCode,
  PredictionPrerequisites,
  PredictionSourceType,
} from '@/types'

export type PrerequisiteCheck = PredictionPrerequisites

export async function checkReadiness(
  cameraId: string,
  sourceType: PredictionSourceType = 'upload',
): Promise<PredictionPrerequisites> {
  const connection = getConnectionContext()
  try {
    const context = await resolveMeasurementContext(cameraId, connection.signal)
    assertCurrentConnection(connection)
    const { calibration, groundModel, groundReference } = context
    const missing = [...context.missing]
    const hasActiveCalibration = !!calibration && !missing.includes('calibration_context_mismatch')
    const hasActiveGroundModel = context.missing.length === 0
    const intrinsicsMissing =
      !!calibration &&
      (!calibration.k_original || !calibration.resolution_w || !calibration.resolution_h)

    if (hasActiveCalibration && intrinsicsMissing) {
      if (sourceType !== 'upload') missing.push('calibration_intrinsics_missing')
      else if (calibration.k_original) missing.push('calibration_invalid_intrinsics')
    }

    let depthScale: DepthScale | null = null
    if (hasActiveGroundModel && groundModel) {
      try {
        depthScale = await getActiveDepthScale(cameraId, groundModel.id, connection.signal)
        if (
          depthScale.camera_id !== cameraId ||
          depthScale.ground_model_id !== groundModel.id ||
          !depthScale.is_active
        ) {
          missing.push('depth_scale_context_mismatch')
        }
      } catch (error) {
        const code = normalizeApiError(error).code
        if (code === 'depth_scale_identity_missing' || code === 'depth_scale_model_mismatch' || code === 'depth_scale_invalid_saved_fit') {
          missing.push(code)
        } else {
          if (!isMissingActiveResource(error)) throw error
          missing.push('prediction_requires_depth_scale')
        }
      }
    }
    assertCurrentConnection(connection)

    return {
      camera_id: cameraId,
      source_type: sourceType,
      ready: missing.length === 0,
      has_active_calibration: hasActiveCalibration,
      has_active_ground_model: hasActiveGroundModel,
      has_active_depth_scale: !!depthScale && !missing.includes('depth_scale_context_mismatch'),
      calibration_intrinsics_missing: intrinsicsMissing,
      legacy_upload: hasActiveCalibration && sourceType === 'upload' && !calibration.k_original,
      missing,
      active_calibration_id: calibration?.id ?? null,
      active_ground_model_id: groundModel?.id ?? null,
      active_ground_ref_id: groundReference?.id ?? null,
      active_depth_scale_id: depthScale?.id ?? null,
      active_depth_model: depthScale?.depth_model ?? null,
    }
  } catch (error) {
    assertCurrentConnection(connection)
    throw normalizeApiError(error)
  }
}

const labels: Record<PredictionPrerequisiteCode, string> = {
  prediction_requires_calibration: 'Kalibrasi aktif belum tersedia. Buat dan aktifkan kalibrasi.',
  prediction_requires_ground_reference:
    'Referensi tanah aktif belum tersedia. Buat dan aktifkan referensi tanah.',
  prediction_requires_ground_model:
    'Model ground untuk konfigurasi aktif belum tersedia. Periksa Referensi Tanah.',
  prediction_requires_depth_scale:
    'Skala kedalaman aktif belum tersedia untuk model ground ini. Buat dan aktifkan skala.',
  calibration_context_mismatch:
    'Respons kalibrasi tidak sesuai kamera atau tidak aktif. Muat ulang Kalibrasi.',
  ground_reference_context_mismatch:
    'Respons referensi tanah tidak sesuai kamera atau tidak aktif. Muat ulang Referensi Tanah.',
  ground_reference_calibration_mismatch:
    'Referensi tanah tidak cocok dengan kalibrasi aktif. Buat atau aktifkan referensi yang sesuai.',
  ground_model_context_mismatch: 'Model ground tidak sesuai kamera. Muat ulang Referensi Tanah.',
  ground_model_calibration_mismatch:
    'Model ground tidak cocok dengan kalibrasi aktif. Periksa Referensi Tanah.',
  ground_model_reference_mismatch:
    'Model ground tidak cocok dengan referensi tanah aktif. Periksa Referensi Tanah.',
  depth_scale_context_mismatch:
    'Skala kedalaman tidak aktif atau tidak cocok dengan kamera/model ground. Muat ulang Skala Kedalaman.',
  depth_scale_identity_missing: 'Skala lama belum memiliki identitas model. Buat skala kedalaman baru.',
  depth_scale_model_mismatch: 'Weights atau persiapan model berubah. Buat skala kedalaman baru.',
  depth_scale_invalid_saved_fit: 'Fit tersimpan tidak memenuhi pemeriksaan. Buat skala kedalaman baru.',
  calibration_intrinsics_missing:
    'Sumber RTSP memerlukan intrinsics asli dan dimensi kalibrasi. Lakukan kalibrasi ulang.',
  calibration_invalid_intrinsics:
    'Intrinsics asli tersedia tetapi dimensi kalibrasi belum lengkap. Lakukan kalibrasi ulang.',
}

export function getMissingPrerequisiteLabels(
  missing: readonly PredictionPrerequisiteCode[],
): string[] {
  return missing.map((code) => labels[code])
}

export function getPrerequisiteRecoveryPath(code: PredictionPrerequisiteCode): string {
  if (code.includes('depth_scale')) return '/dashboard/depth-scales'
  if (code.startsWith('calibration_') || code === 'prediction_requires_calibration')
    return '/dashboard/calibrations'
  return '/dashboard/ground-references'
}

export function getPrerequisiteRecoveryLabel(code: PredictionPrerequisiteCode): string {
  const path = getPrerequisiteRecoveryPath(code)
  if (path === '/dashboard/depth-scales') return 'Buka Skala Kedalaman'
  if (path === '/dashboard/calibrations') return 'Buka Kalibrasi'
  return 'Buka Referensi Tanah'
}
