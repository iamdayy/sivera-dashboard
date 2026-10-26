import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useJobPolling } from '@/composables/useJobPolling'
import { predictionJob } from './fixtures/prediction'
import type { PredictionJob } from '@/types'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const job = predictionJob()
let scope = effectScope()
const read = vi.fn<(camera: string, jobId: string, signal?: AbortSignal) => Promise<PredictionJob>>()
const update = vi.fn()
function setup() {
  scope = effectScope()
  return scope.run(() => useJobPolling(read, update))!
}

beforeEach(() => {
  vi.useFakeTimers()
  read.mockReset().mockResolvedValue(job)
  update.mockReset()
})
afterEach(() => { scope.stop(); vi.useRealTimers() })

describe('persisted job polling', () => {
  it('keeps multiple jobs and publishes full persisted terminal responses exactly once', async () => {
    const other = predictionJob({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
    read.mockImplementation(async (_, id) => ({ ...(id === job.id ? job : other), status: 'processing' }))
    const polling = setup()
    polling.startPolling(job.camera_id, job.id)
    polling.startPolling(other.camera_id, other.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(2)
    expect(polling.getPollingStatus(job.camera_id, job.id)?.status).toBe('processing')
    read.mockImplementation(async (_, id) => ({ ...(id === job.id ? job : other), status: id === job.id ? 'done' : 'failed', error_msg: 'prediction_worker_timeout' }))
    await vi.advanceTimersByTimeAsync(3000)
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ id: other.id, status: 'failed', error_msg: 'prediction_worker_timeout' }))
    polling.startPolling(job.camera_id, job.id)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(4)
    expect(polling.getPollingStatus(job.camera_id, job.id)?.status).toBe('done')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('never queues overlapping reads even after repeated starts and manual retries', async () => {
    const held = deferred<PredictionJob>()
    read.mockReturnValueOnce(held.promise)
    const polling = setup()
    polling.startPolling(job.camera_id, job.id, 'processing')
    await vi.advanceTimersByTimeAsync(0)
    polling.startPolling(job.camera_id, job.id)
    polling.retryPolling(job.camera_id, job.id)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(1)
    held.resolve({ ...job, status: 'processing' })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2999)
    expect(read).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it.each([null, 408, 429, 500, 502, 503, 504])('retains backend state after transient GET failure %s and recovers', async status => {
    const polling = setup()
    read.mockResolvedValueOnce({ ...job, status: 'processing' }).mockRejectedValueOnce({ status, message: 'Fixture unavailable' }).mockResolvedValue({ ...job, status: 'done' })
    polling.startPolling(job.camera_id, job.id)
    await vi.advanceTimersByTimeAsync(3000)
    const state = polling.getPollingStatus(job.camera_id, job.id)!
    expect(state.status).toBe('processing')
    expect(state.error?.status).toBe(status)
    expect(state.retrying).toBe(true)
    expect(update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(state.status).toBe('done')
    expect(state.error).toBeNull()
  })

  it('backs off per job to 30 seconds without delaying other jobs', async () => {
    read.mockImplementation(async (_, id) => {
      if (id === job.id) throw { status: 503, message: 'Fixture unavailable' }
      return { ...job, id, status: 'processing' }
    })
    const polling = setup()
    polling.startPolling(job.camera_id, job.id)
    polling.startPolling(job.camera_id, 'other')
    await vi.advanceTimersByTimeAsync(0)
    for (const delay of [3000, 6000, 12_000, 24_000, 30_000, 30_000]) {
      const count = read.mock.calls.filter(([, id]) => id === job.id).length
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(read.mock.calls.filter(([, id]) => id === job.id)).toHaveLength(count)
      await vi.advanceTimersByTimeAsync(1)
      expect(read.mock.calls.filter(([, id]) => id === job.id)).toHaveLength(count + 1)
    }
    expect(read.mock.calls.filter(([, id]) => id === 'other').length).toBeGreaterThan(30)
  })

  it.each([401, 403, 404, 422])('pauses on %s and allows an explicit retry', async status => {
    read.mockRejectedValue({ status, message: 'Fixture failure' })
    const polling = setup()
    polling.startPolling(job.camera_id, job.id, 'pending')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
    expect(polling.getPollingStatus(job.camera_id, job.id)).toMatchObject({ status: 'pending', retrying: false })
    read.mockResolvedValue({ ...job, status: 'done' })
    polling.retryPolling(job.camera_id, job.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }))
  })

  it.each([{ status: 'success' }, { status: 'queued' }, { id: 'wrong-job' }, { camera_id: 'wrong-camera' }])('does not invent a terminal state for an invalid response %j', async override => {
    read.mockResolvedValue({ ...job, ...override })
    const polling = setup()
    polling.startPolling(job.camera_id, job.id, 'processing')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(update).not.toHaveBeenCalled()
    expect(polling.getPollingStatus(job.camera_id, job.id)).toMatchObject({ status: 'processing', retrying: false, error: { status: 422 } })
  })

  it.each(['resolve', 'reject'] as const)('fences a stopped request that later %ss after the same job restarts', async finish => {
    const held = deferred<PredictionJob>()
    read.mockReturnValueOnce(held.promise).mockResolvedValue({ ...job, status: 'processing' })
    const polling = setup()
    polling.startPolling(job.camera_id, job.id)
    await vi.advanceTimersByTimeAsync(0)
    const signal = read.mock.calls[0]![2]!
    polling.stopPolling()
    expect(signal.aborted).toBe(true)
    polling.startPolling(job.camera_id, job.id)
    await vi.advanceTimersByTimeAsync(0)
    if (finish === 'resolve') held.resolve({ ...job, status: 'done' })
    else held.reject({ status: 403, message: 'Old failure' })
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledTimes(1)
    expect(polling.getPollingStatus(job.camera_id, job.id)).toMatchObject({ status: 'processing', error: null })
  })

  it('aborts reads and clears timers on scope disposal', async () => {
    const held = deferred<PredictionJob>()
    read.mockReturnValue(held.promise)
    const polling = setup()
    polling.startPolling(job.camera_id, job.id)
    await vi.advanceTimersByTimeAsync(0)
    scope.stop()
    held.resolve({ ...job, status: 'done' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read.mock.calls[0]![2]?.aborted).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(polling.pollingJobs.value.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('accepts fresh detail after a partial result and fences an older polling read', async () => {
    const held = deferred<PredictionJob>()
    read.mockReturnValueOnce(held.promise)
    const polling = setup()
    polling.startPolling(job.camera_id, job.id, 'processing')
    await vi.advanceTimersByTimeAsync(0)
    const partial = { ...job, status: 'done' }
    expect(polling.reconcileJob(partial)).toEqual(partial)
    held.resolve({ ...job, status: 'processing' })
    await vi.advanceTimersByTimeAsync(0)
    expect(update).not.toHaveBeenCalled()
    const complete = { ...partial, result: { volume: { method_grid: { volume_m3: 0, volume_liter: 0 } } } }
    expect(polling.reconcileJob(complete)).toEqual(complete)
    expect(polling.reconcileJob(job)).toEqual(complete)
    expect(polling.getPollingStatus(job.camera_id, job.id)?.job).toEqual(complete)
    expect(vi.getTimerCount()).toBe(0)
  })
})
