import { ref, onUnmounted, type Ref } from 'vue'

export interface PollingJob {
  jobId: string
  cameraId: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  lastChecked: Date
}

export function useJobPolling(
  getJobFn: (cameraId: string, jobId: string) => Promise<any>,
  onJobComplete?: (job: any) => void
) {
  const pollingJobs = ref<Map<string, PollingJob>>(new Map())
  const intervalId = ref<number | null>(null)
  const POLL_INTERVAL_MS = 3000

  function startPolling(cameraId: string, jobId: string) {
    const key = `${cameraId}:${jobId}`
    if (pollingJobs.value.has(key)) return

    pollingJobs.value.set(key, {
      jobId,
      cameraId,
      status: 'pending',
      lastChecked: new Date(),
    })

    if (!intervalId.value) {
      intervalId.value = window.setInterval(pollAll, POLL_INTERVAL_MS)
    }
  }

  async function pollAll() {
    if (pollingJobs.value.size === 0) {
      stopPolling()
      return
    }

    for (const [key, job] of pollingJobs.value) {
      try {
        const updated = await getJobFn(job.cameraId, job.jobId)
        job.status = updated.status
        job.lastChecked = new Date()

        if (updated.status === 'done' || updated.status === 'failed') {
          pollingJobs.value.delete(key)
          onJobComplete?.(updated)
        }
      } catch (error) {
        console.error(`Polling failed for ${key}:`, error)
      }
    }

    if (pollingJobs.value.size === 0) {
      stopPolling()
    }
  }

  function stopPolling() {
    if (intervalId.value) {
      clearInterval(intervalId.value)
      intervalId.value = null
    }
    pollingJobs.value.clear()
  }

  function isPolling(cameraId: string, jobId: string): boolean {
    return pollingJobs.value.has(`${cameraId}:${jobId}`)
  }

  function getPollingStatus(cameraId: string, jobId: string): 'pending' | 'processing' | 'done' | 'failed' | null {
    return pollingJobs.value.get(`${cameraId}:${jobId}`)?.status ?? null
  }

  onUnmounted(stopPolling)

  return {
    pollingJobs,
    startPolling,
    stopPolling,
    isPolling,
    getPollingStatus,
  }
}