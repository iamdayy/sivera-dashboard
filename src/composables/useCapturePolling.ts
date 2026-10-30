import { onScopeDispose, ref } from 'vue'
import type { CaptureResponse } from '@/types'
import { normalizeApiError, type ApiError } from '@/services/api'
import { getCaptureSession, isCaptureTerminal, isComputeTerminal } from '@/services/calibrationCaptures'

export interface UseCapturePollingOptions {
  intervalMs?: number
  onUpdate?: (session: CaptureResponse) => void
  onError?: (error: ApiError) => void
}

interface PollingRequest {
  cameraId: string
  sessionId: string
  controller: AbortController
  timer?: ReturnType<typeof setTimeout>
}

export function useCapturePolling(options: UseCapturePollingOptions = {}) {
  const { intervalMs = 2000, onUpdate, onError } = options

  const session = ref<CaptureResponse | null>(null)
  const error = ref<ApiError | null>(null)
  const isPolling = ref(false)
  let current: PollingRequest | null = null

  async function poll(request: PollingRequest) {
    if (current !== request) return
    isPolling.value = true
    try {
      const data = await getCaptureSession(request.cameraId, request.sessionId, request.controller.signal)
      if (current !== request) return
      if (data.camera_id !== request.cameraId || data.session_id !== request.sessionId) {
        throw { status: 422, message: 'Respons status capture tidak sesuai sesi. Periksa versi API bersama operator, lalu refresh status.' }
      }
      session.value = data
      error.value = null
      onUpdate?.(data)

      const captureDone = isCaptureTerminal(data.status)
      const computeDone = data.compute_status === 'none' || isComputeTerminal(data.compute_status)

      if (captureDone && computeDone) {
        stop()
        return
      }
    } catch (err) {
      if (current !== request) return
      error.value = normalizeApiError(err)
      if (!error.value.cancelled) onError?.(error.value)
      stop()
    } finally {
      if (current === request) {
        isPolling.value = false
        request.timer = setTimeout(() => { void poll(request) }, intervalMs)
      }
    }
  }

  function start(cameraId: string, sessionId: string) {
    stop()
    error.value = null
    const request = { cameraId, sessionId, controller: new AbortController() }
    current = request
    void poll(request)
  }

  function stop() {
    clearTimeout(current?.timer)
    current?.controller.abort()
    current = null
    isPolling.value = false
  }

  onScopeDispose(stop)
  return { session, error, isPolling, start, stop }
}
