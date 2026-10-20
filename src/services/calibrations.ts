import { apiClient, normalizeApiError, artifactUrl } from './api'
import type { Calibration, CalibrationList } from '@/types'

export async function listCalibrations(cameraId: string): Promise<CalibrationList> {
  try {
    const response = await apiClient.get<CalibrationList>(`/cameras/${cameraId}/calibrations`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getActiveCalibration(cameraId: string): Promise<Calibration> {
  try {
    const response = await apiClient.get<Calibration>(`/cameras/${cameraId}/calibrations/active`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getCalibration(cameraId: string, calibrationId: string): Promise<Calibration> {
  try {
    const response = await apiClient.get<Calibration>(`/cameras/${cameraId}/calibrations/${calibrationId}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export interface CreateCalibrationPayload {
  chessboard_cols: number
  chessboard_rows: number
  square_m: number
  alpha: number
  notes?: string
  files: File[]
}

export async function createCalibration(cameraId: string, payload: CreateCalibrationPayload): Promise<Calibration> {
  try {
    const formData = new FormData()
    formData.append('chessboard_cols', payload.chessboard_cols.toString())
    formData.append('chessboard_rows', payload.chessboard_rows.toString())
    formData.append('square_m', payload.square_m.toString())
    formData.append('alpha', payload.alpha.toString())
    if (payload.notes) formData.append('notes', payload.notes)
    payload.files.forEach((f) => formData.append('files', f))

    const response = await apiClient.post<Calibration>(`/cameras/${cameraId}/calibrations`, formData)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function activateCalibration(cameraId: string, calibrationId: string): Promise<Calibration> {
  try {
    const response = await apiClient.post<Calibration>(`/cameras/${cameraId}/calibrations/${calibrationId}/activate`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getUndistortPreview(cameraId: string, calibrationId: string): Promise<string> {
  try {
    const response = await apiClient.get<{ preview_url: string }>(`/cameras/${cameraId}/calibrations/${calibrationId}/undistort-preview`)
    return artifactUrl(response.data.preview_url)
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function deleteCalibration(cameraId: string, calibrationId: string): Promise<void> {
  try {
    await apiClient.delete(`/cameras/${cameraId}/calibrations/${calibrationId}`)
  } catch (error) {
    throw normalizeApiError(error)
  }
}