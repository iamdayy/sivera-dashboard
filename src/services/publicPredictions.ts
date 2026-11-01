import { apiClient, cameraPath, normalizeApiError } from './api'
import type { LatestPrediction, AutoPredictionLivePayload } from '@/types'

export async function getLatestPredictionPublic(cameraId: string): Promise<LatestPrediction> {
  try {
    const response = await apiClient.get<LatestPrediction>(`/public/cameras/${cameraId}/latest-prediction`)
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getPredictionOutputImage(cameraId: string, outputType: string): Promise<Blob> {
  try {
    const response = await apiClient.get(`/public/cameras/${cameraId}/latest-prediction/outputs/${outputType}/image`, {
      responseType: 'blob',
    })
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function listPredictionsPublic(
  cameraId: string,
  page = 1,
  pageSize = 20,
  status?: string
): Promise<{ items: any[]; total: number; page: number; page_size: number; total_pages: number }> {
  try {
    const params: Record<string, string | number> = { page, page_size: pageSize }
    if (status) params.status = status
    const response = await apiClient.get(`/public/cameras/${cameraId}/predictions`, { params })
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export function createSSEConnection(
  cameraId: string,
  onPrediction: (data: AutoPredictionLivePayload) => void
): EventSource {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const es = new EventSource(`${baseUrl}/api/v1/public/cameras/${cameraId}/predictions/stream`)

  es.addEventListener('prediction', (event) => {
    try {
      const data = JSON.parse(event.data) as AutoPredictionLivePayload
      onPrediction(data)
    } catch {
      // Ignore parse errors
    }
  })

  return es
}