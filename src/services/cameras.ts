import { apiClient, cameraPath, normalizeApiError } from './api'
import type { Camera, CameraDetail, CameraList, CreateCameraPayload, UpdateCameraPayload, StreamResponse, AutoPredictConfig, AutoPredictConfigUpdate } from '@/types'

export async function listCameras(page = 1, pageSize = 20): Promise<CameraList> {
  try {
    const response = await apiClient.get<CameraList>(cameraPath(), {
      params: { page, page_size: pageSize },
    })
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getCamera(cameraId: string): Promise<CameraDetail> {
  try {
    const response = await apiClient.get<CameraDetail>(cameraPath(cameraId))
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function createCamera(payload: CreateCameraPayload): Promise<Camera> {
  try {
    const response = await apiClient.post<Camera>(cameraPath(), payload)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function updateCamera(cameraId: string, payload: UpdateCameraPayload): Promise<Camera> {
  try {
    const response = await apiClient.patch<Camera>(cameraPath(cameraId), payload)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function deleteCamera(cameraId: string): Promise<void> {
  try {
    await apiClient.delete(cameraPath(cameraId))
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getCameraStreamStatus(cameraId: string): Promise<StreamResponse> {
  try {
    return (await apiClient.get<StreamResponse>(cameraPath(cameraId, '/stream'))).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getAutoPredictConfig(cameraId: string): Promise<AutoPredictConfig> {
  try {
    const response = await apiClient.get<AutoPredictConfig>(cameraPath(cameraId, '/auto-predict'))
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function updateAutoPredictConfig(cameraId: string, payload: AutoPredictConfigUpdate): Promise<AutoPredictConfig> {
  try {
    const response = await apiClient.patch<AutoPredictConfig>(cameraPath(cameraId, '/auto-predict'), payload)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}
