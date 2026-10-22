import { onBeforeUnmount, ref, watch } from 'vue'
import type { CaptureResponse } from '@/types'
import { getCaptureSession, isCaptureTerminal, isComputeTerminal } from '@/services/calibrationCaptures'

export interface UseCapturePollingOptions {
  cameraId: string
  sessionId: string
  intervalMs?: number
  signal?: AbortSignal
  onUpdate?: (session: CaptureResponse) => void
  onError?: (error: Error) => void
}

export function useCapturePolling(options: UseCapturePollingOptions) {
  const { cameraId, sessionId, intervalMs = 2000, signal, onUpdate, onError } = options

  const session = ref<CaptureResponse | null>(null)
  const error = ref<Error | null>(null)
  const isPolling = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  async function poll() {
    if (stopped || isPolling.value) return
    if (signal?.aborted) return

    isPolling.value = true
    try {
      const data = await getCaptureSession(cameraId, sessionId, signal)
      if (stopped) return
      session.value = data
      onUpdate?.(data)
      error.value = null

      const captureDone = isCaptureTerminal(data.status)
      const computeDone = isComputeTerminal(data.compute_status)

      if (captureDone && computeDone) {
        stop()
        return
      }
    } catch (err) {
      if (stopped) return
      error.value = err instanceof Error ? err : new Error('Polling gagal')
      onError?.(error.value)
    } finally {
      isPolling.value = false
      if (!stopped && !signal?.aborted) {
        timer = setTimeout(poll, intervalMs)
      }
    }
  }

  function start() {
    stopped = false
    poll()
  }

  function stop() {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  onBeforeUnmount(stop)

  watch(
    () => signal?.aborted,
    (aborted) => {
      if (aborted) stop()
    },
  )

  return { session, error, isPolling, start, stop }
}