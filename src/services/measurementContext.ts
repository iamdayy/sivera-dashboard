import {
  apiClient,
  assertCurrentConnection,
  cameraPath,
  getConnectionContext,
  normalizeApiError,
} from './api'
import type { Calibration, GroundReference, PredictionPrerequisiteCode } from '@/types'
import type { GroundModel } from './groundReferences'

export interface MeasurementContext {
  calibration: Calibration | null
  groundReference: GroundReference | null
  groundModel: GroundModel | null
  missing: PredictionPrerequisiteCode[]
}

export function isMissingActiveResource(error: unknown): boolean {
  const normalized = normalizeApiError(error)
  return normalized.status === 404 && !normalized.code
}

async function fetchActive<T>(path: string, signal: AbortSignal): Promise<T | null> {
  try {
    return (await apiClient.get<T>(path, { signal })).data
  } catch (error) {
    if (isMissingActiveResource(error)) return null
    throw normalizeApiError(error)
  }
}

export async function resolveMeasurementContext(
  cameraId: string,
  signal?: AbortSignal,
): Promise<MeasurementContext> {
  const connection = getConnectionContext()
  const requestSignal = signal ? AbortSignal.any([signal, connection.signal]) : connection.signal
  try {
    const [calibration, groundModel, groundReference] = await Promise.all([
      fetchActive<Calibration>(cameraPath(cameraId, '/calibrations/active'), requestSignal),
      fetchActive<GroundModel>(cameraPath(cameraId, '/ground-models/active'), requestSignal),
      fetchActive<GroundReference>(
        cameraPath(cameraId, '/ground-references/active'),
        requestSignal,
      ),
    ])
    assertCurrentConnection(connection)

    const missing: PredictionPrerequisiteCode[] = []
    if (!calibration) missing.push('prediction_requires_calibration')
    else if (calibration.camera_id !== cameraId || !calibration.is_active)
      missing.push('calibration_context_mismatch')

    if (!groundReference) missing.push('prediction_requires_ground_reference')
    else {
      if (groundReference.camera_id !== cameraId || !groundReference.is_active)
        missing.push('ground_reference_context_mismatch')
      if (calibration && groundReference.calibration_id !== calibration.id)
        missing.push('ground_reference_calibration_mismatch')
    }

    if (!groundModel) missing.push('prediction_requires_ground_model')
    else {
      if (groundModel.camera_id !== cameraId) missing.push('ground_model_context_mismatch')
      if (calibration && groundModel.calibration_id !== calibration.id)
        missing.push('ground_model_calibration_mismatch')
      if (groundReference && groundModel.ground_ref_id !== groundReference.id)
        missing.push('ground_model_reference_mismatch')
    }
    return { calibration, groundReference, groundModel, missing }
  } catch (error) {
    assertCurrentConnection(connection)
    throw normalizeApiError(error)
  }
}
