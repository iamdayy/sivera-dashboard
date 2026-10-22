import { apiClient, cameraPath, normalizeApiError } from './api'
import type { CaptureCreate, CaptureResponse, CaptureImageList, CaptureImageResponse } from '@/types'

export async function startCapture(cameraId: string, payload: CaptureCreate, signal?: AbortSignal): Promise<CaptureResponse> {
  try {
    return (await apiClient.post<CaptureResponse>(cameraPath(cameraId, '/calibration-captures'), payload, { signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getCaptureSession(cameraId: string, sessionId: string, signal?: AbortSignal): Promise<CaptureResponse> {
  try {
    return (await apiClient.get<CaptureResponse>(cameraPath(cameraId, `/calibration-captures/${sessionId}`), { signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function stopCapture(cameraId: string, sessionId: string, signal?: AbortSignal): Promise<CaptureResponse> {
  try {
    return (await apiClient.post<CaptureResponse>(cameraPath(cameraId, `/calibration-captures/${sessionId}/stop`), undefined, { signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function computeCapture(cameraId: string, sessionId: string, signal?: AbortSignal): Promise<CaptureResponse> {
  try {
    return (await apiClient.post<CaptureResponse>(cameraPath(cameraId, `/calibration-captures/${sessionId}/compute`), undefined, { signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function listCaptureImages(cameraId: string, sessionId: string, offset = 0, limit = 20, signal?: AbortSignal): Promise<CaptureImageList> {
  try {
    return (await apiClient.get<CaptureImageList>(cameraPath(cameraId, `/calibration-captures/${sessionId}/images`), { params: { offset, limit }, signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getCaptureImageBlob(cameraId: string, sessionId: string, imageId: string, preview = false, signal?: AbortSignal): Promise<Blob> {
  try {
    const suffix = preview ? '/preview' : ''
    return (await apiClient.get<Blob>(cameraPath(cameraId, `/calibration-captures/${sessionId}/images/${imageId}${suffix}`), { responseType: 'blob', signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export function isCaptureTerminal(status: string): boolean {
  return ['completed', 'stopped', 'expired', 'failed'].includes(status)
}

export function isComputeTerminal(status: string): boolean {
  return ['done', 'failed'].includes(status)
}