import { getActiveCalibration, getActiveGroundModel, getCamera } from '@/services'
import type { Camera, Calibration } from '@/types'
import type { GroundModel } from '@/services/groundReferences'

export interface PrerequisiteCheck {
  has_active_calibration: boolean
  has_active_ground_model: boolean
  calibration_intrinsics_missing: boolean
  missing: string[]
  active_calibration_id: string | null
  active_ground_model_id: string | null
  camera_id: string
}

export async function checkReadiness(cameraId: string): Promise<PrerequisiteCheck> {
  const missing: string[] = []
  let activeCalibration: Calibration | null = null
  let activeGroundModel: GroundModel | null = null
  let activeCalibrationId: string | null = null
  let activeGroundModelId: string | null = null

  try {
    const camera = await getCamera(cameraId)
    activeCalibrationId = camera.active_calibration_id

    if (!camera.active_calibration_id) {
      missing.push('prediction_requires_calibration')
    } else {
      activeCalibration = await getActiveCalibration(cameraId)
      if (activeCalibration) {
        if (!activeCalibration.k_original || !activeCalibration.resolution_w || !activeCalibration.resolution_h) {
          missing.push('calibration_intrinsics_missing')
        }
      } else {
        missing.push('prediction_requires_calibration')
      }
    }

    if (!activeGroundModelId) {
      missing.push('prediction_requires_ground_model')
    } else if (activeCalibrationId) {
      try {
        activeGroundModel = await getActiveGroundModel(cameraId)
        if (!activeGroundModel) {
          missing.push('prediction_requires_ground_model')
        } else if (activeGroundModel.calibration_id !== activeCalibrationId) {
          missing.push('ground_model_calibration_mismatch')
        }
      } catch {
        missing.push('prediction_requires_ground_model')
      }
    }
  } catch {
    missing.push('prediction_requires_calibration')
    missing.push('prediction_requires_ground_model')
  }

  return {
    has_active_calibration: !!activeCalibration,
    has_active_ground_model: !!activeGroundModel,
    calibration_intrinsics_missing: missing.includes('calibration_intrinsics_missing'),
    missing,
    active_calibration_id: activeCalibrationId,
    active_ground_model_id: activeGroundModelId,
    camera_id: cameraId,
  }
}

export function getMissingPrerequisiteLabels(missing: string[]): string[] {
  const labels: Record<string, string> = {
    prediction_requires_calibration: 'Kalibrasi aktif diperlukan',
    prediction_requires_ground_model: 'Model ground aktif diperlukan',
    calibration_intrinsics_missing: 'Kalibrasi tidak memiliki intrinsics asli/dimensi (lakukan kalibrasi ulang)',
    ground_model_calibration_mismatch: 'Model ground tidak cocok dengan kalibrasi aktif',
  }
  return missing.map(code => labels[code] || code)
}