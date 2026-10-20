import { apiClient, normalizeApiError } from './api'
import type { Camera, CameraDetail, CameraList, CreateCameraPayload, UpdateCameraPayload } from '@/types'

export async function listCameras(page = 1, pageSize = 20): Promise<CameraList> {
  try {
    const response = await apiClient.get<CameraList>('/cameras', {
      params: { page, page_size: pageSize },
    })
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getCamera(cameraId: string): Promise<CameraDetail> {
  try {
    const response = await apiClient.get<CameraDetail>(`/cameras/${cameraId}`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function createCamera(payload: CreateCameraPayload): Promise<Camera> {
  try {
    const response = await apiClient.post<Camera>('/cameras', payload)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function updateCamera(cameraId: string, payload: UpdateCameraPayload): Promise<Camera> {
  try {
    const response = await apiClient.patch<Camera>(`/cameras/${cameraId}`, payload)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function deleteCamera(cameraId: string): Promise<void> {
  try {
    await apiClient.delete(`/cameras/${cameraId}`)
  } catch (error) {
    throw normalizeApiError(error)
  }
}