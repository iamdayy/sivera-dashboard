import { apiClient, cameraPath, normalizeApiError } from './api'
import type { SnapshotResponse } from '@/types'

export interface SnapshotQuery {
  max_frame_age_sec?: number
}

export async function takeSnapshot(cameraId: string, signal?: AbortSignal): Promise<SnapshotResponse> {
  try {
    return (await apiClient.post<SnapshotResponse>(cameraPath(cameraId, '/snapshots'), undefined, { signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getLatestSnapshot(cameraId: string, query: SnapshotQuery = {}, signal?: AbortSignal): Promise<SnapshotResponse> {
  try {
    return (await apiClient.get<SnapshotResponse>(cameraPath(cameraId, '/snapshots/latest'), { params: query, signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export async function getSnapshotImageBlob(cameraId: string, snapshotId: string, signal?: AbortSignal): Promise<Blob> {
  try {
    return (await apiClient.get<Blob>(cameraPath(cameraId, `/snapshots/${snapshotId}/image`), { responseType: 'blob', signal })).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}

export function isSnapshotFresh(snapshot: SnapshotResponse | null, maxAgeSec = 30): boolean {
  if (!snapshot) return false
  const captured = new Date(snapshot.captured_at).getTime()
  const now = Date.now()
  return (now - captured) / 1000 <= maxAgeSec
}