import { onScopeDispose, ref } from 'vue'
import { normalizeApiError, type ApiError } from '@/services/api'
import { isPredictionJobStatus, isUnfinishedJob } from '@/lib/prediction-job'
import type { PredictionJob, PredictionJobStatus } from '@/types'

export interface PollingJob {
  jobId: string
  cameraId: string
  status: PredictionJobStatus | null
  job: PredictionJob | null
  error: ApiError | null
  lastChecked: Date | null
  consecutiveFailures: number
  checking: boolean
  retrying: boolean
}

interface PollingRequest {
  controller: AbortController
  timer?: ReturnType<typeof setTimeout>
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_INTERVAL_MS = 30_000

export function useJobPolling(
  getJob: (cameraId: string, jobId: string, signal?: AbortSignal) => Promise<PredictionJob>,
  onJobUpdate?: (job: PredictionJob) => void,
) {
  const pollingJobs = ref(new Map<string, PollingJob>())
  const requests = new Map<string, PollingRequest>()

  function schedule(key: string, request: PollingRequest, delay: number) {
    request.timer = setTimeout(() => { void poll(key, request) }, delay)
  }

  async function poll(key: string, request: PollingRequest) {
    const state = pollingJobs.value.get(key)
    if (!state || requests.get(key) !== request || state.checking) return
    state.checking = true
    let updated: PredictionJob
    try {
      updated = await getJob(state.cameraId, state.jobId, request.controller.signal)
      if (requests.get(key) !== request) return
      if (updated.id !== state.jobId || updated.camera_id !== state.cameraId || !isPredictionJobStatus(updated.status)) {
        throw { status: 422, message: 'Respons status job tidak sesuai kontrak. Periksa versi API bersama operator, lalu periksa status lagi.' }
      }
    } catch (cause) {
      if (requests.get(key) !== request) return
      const error = normalizeApiError(cause)
      state.error = error
      state.consecutiveFailures += 1
      state.retrying = !error.cancelled && (error.status === null || [408, 429, 500, 502, 503, 504].includes(error.status))
      if (state.retrying) {
        schedule(key, request, Math.min(MAX_POLL_INTERVAL_MS, POLL_INTERVAL_MS * 2 ** (state.consecutiveFailures - 1)))
      }
      return
    } finally {
      if (requests.get(key) === request) state.checking = false
    }

    state.job = updated
    state.status = updated.status as PredictionJobStatus
    state.error = null
    state.lastChecked = new Date()
    state.consecutiveFailures = 0
    state.retrying = isUnfinishedJob(updated.status)
    if (state.retrying) schedule(key, request, POLL_INTERVAL_MS)
    onJobUpdate?.(updated)
  }

  function startPolling(cameraId: string, jobId: string, status: string | null = null) {
    const key = `${cameraId}:${jobId}`
    if (requests.has(key)) return
    const request = { controller: new AbortController() }
    requests.set(key, request)
    pollingJobs.value.set(key, {
      jobId, cameraId, status: isPredictionJobStatus(status) ? status : null,
      job: null, error: null, lastChecked: null, consecutiveFailures: 0,
      checking: false, retrying: true,
    })
    schedule(key, request, 0)
  }

  function retryPolling(cameraId: string, jobId: string) {
    const key = `${cameraId}:${jobId}`
    const request = requests.get(key)
    const state = pollingJobs.value.get(key)
    if (!request || !state) return startPolling(cameraId, jobId)
    if (state.checking) return
    clearTimeout(request.timer)
    state.consecutiveFailures = 0
    state.retrying = true
    schedule(key, request, 0)
  }

  function reconcileJob(job: PredictionJob): PredictionJob {
    const key = `${job.camera_id}:${job.id}`
    const state = pollingJobs.value.get(key)
    if (!state || !isPredictionJobStatus(job.status)) return job
    if (state.job && ((!isUnfinishedJob(state.job.status) && job.status !== state.job.status)
      || (state.job.status === 'processing' && job.status === 'pending'))) return state.job
    const previous = requests.get(key)
    clearTimeout(previous?.timer)
    previous?.controller.abort()
    const request = { controller: new AbortController() }
    requests.set(key, request)
    Object.assign(state, { job, status: job.status, error: null, lastChecked: new Date(),
      consecutiveFailures: 0, checking: false, retrying: isUnfinishedJob(job.status) })
    if (state.retrying) schedule(key, request, POLL_INTERVAL_MS)
    return job
  }

  function stopPolling() {
    for (const request of requests.values()) {
      clearTimeout(request.timer)
      request.controller.abort()
    }
    // A restarted job may have the same key. Request identity fences its old response.
    requests.clear()
    pollingJobs.value.clear()
  }

  function getPollingStatus(cameraId: string, jobId: string) {
    return pollingJobs.value.get(`${cameraId}:${jobId}`)
  }

  onScopeDispose(stopPolling)
  return { pollingJobs, startPolling, retryPolling, stopPolling, getPollingStatus, reconcileJob }
}
