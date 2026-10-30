import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCapturePolling } from '@/composables/useCapturePolling'
import { getCaptureSession } from '@/services/calibrationCaptures'
import { captureSession } from '../../e2e/fixtures/capture'
import type { CaptureResponse } from '@/types'

vi.mock('@/services/calibrationCaptures', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/calibrationCaptures')>(),
  getCaptureSession: vi.fn(),
}))

let scope = effectScope()
const read = vi.mocked(getCaptureSession)
const update = vi.fn()
const error = vi.fn()
const session = captureSession({ status: 'completed' })

function setup() {
  scope = effectScope()
  return scope.run(() => useCapturePolling({ onUpdate: update, onError: error }))!
}

beforeEach(() => {
  vi.useFakeTimers()
  read.mockReset().mockResolvedValue(session)
  update.mockReset()
  error.mockReset()
})
afterEach(() => { scope.stop(); vi.useRealTimers() })

describe('capture and compute polling', () => {
  it.each(['none', 'done', 'failed'] as const)('stops completed capture polling with compute %s', async compute_status => {
    read.mockResolvedValue({ ...session, compute_status })
    const polling = setup()
    polling.start(session.camera_id, session.session_id)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('restarts a failed computation on the same session and follows queued, running and done', async () => {
    read.mockResolvedValueOnce({ ...session, compute_status: 'failed', compute_error_code: 'calibration_queue_timeout' })
      .mockResolvedValueOnce({ ...session, compute_status: 'queued' })
      .mockResolvedValueOnce({ ...session, compute_status: 'running' })
      .mockResolvedValue({ ...session, compute_status: 'done', result_calibration_id: 'result-id' })
    const polling = setup()
    polling.start(session.camera_id, session.session_id)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
    polling.start(session.camera_id, session.session_id)
    await vi.advanceTimersByTimeAsync(0)
    expect(polling.session.value?.compute_status).toBe('queued')
    await vi.advanceTimersByTimeAsync(2000)
    expect(polling.session.value?.compute_status).toBe('running')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(4)
    expect(polling.session.value?.result_calibration_id).toBe('result-id')
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([403, 503])('preserves an HTTP %s failure and pauses until manual refresh', async status => {
    read.mockResolvedValueOnce({ ...session, compute_status: 'queued' }).mockRejectedValueOnce({ status, message: 'Kegagalan fixture', code: 'fixture_error' })
    const polling = setup()
    polling.start(session.camera_id, session.session_id)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status, code: 'fixture_error' }))
    expect(polling.session.value?.compute_status).toBe('queued')
    read.mockResolvedValue({ ...session, compute_status: 'done' })
    polling.start(session.camera_id, session.session_id)
    await vi.advanceTimersByTimeAsync(0)
    expect(polling.error.value).toBeNull()
    expect(polling.session.value?.compute_status).toBe('done')
  })

  it('aborts and fences an old response when the same session restarts', async () => {
    let finish!: (value: CaptureResponse) => void
    read.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      .mockResolvedValue({ ...session, compute_status: 'queued' })
    const polling = setup()
    polling.start(session.camera_id, session.session_id)
    const oldSignal = read.mock.calls[0]![2]!
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).toHaveBeenCalledTimes(1)
    polling.start(session.camera_id, session.session_id)
    await vi.advanceTimersByTimeAsync(0)
    expect(oldSignal.aborted).toBe(true)
    finish({ ...session, compute_status: 'failed' })
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledTimes(1)
    expect(polling.session.value?.compute_status).toBe('queued')
  })

  it('aborts a pending read on disposal without publishing its late response', async () => {
    let finish!: (value: CaptureResponse) => void
    read.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const polling = setup()
    polling.start(session.camera_id, session.session_id)
    scope.stop()
    finish(session)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read.mock.calls[0]![2]?.aborted).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects a status response for another session', async () => {
    read.mockResolvedValue({ ...session, session_id: 'other-session' })
    const polling = setup()
    polling.start(session.camera_id, session.session_id)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(update).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 422 }))
    expect(read).toHaveBeenCalledTimes(1)
  })
})
