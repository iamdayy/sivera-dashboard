import { apiClient, cameraPath, normalizeApiError } from './api'
import type { StreamResponse } from '@/types'

export async function getStream(cameraId: string, signal?: AbortSignal): Promise<StreamResponse> {
  try {
    return (await apiClient.get<StreamResponse>(cameraPath(cameraId, '/stream'), { signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function updateStream(cameraId: string, enabled: boolean, signal?: AbortSignal): Promise<StreamResponse> {
  try {
    // PATCH persists desired state; only a subsequent GET checks MediaMTX runtime.
    return (await apiClient.patch<StreamResponse>(cameraPath(cameraId, '/stream'), { enabled }, { signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}
