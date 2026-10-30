import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, apiErrorFromResponse } from '@/services/api'
import { captureComputeDisabledReason, computeCapture } from '@/services/calibrationCaptures'
import { captureSession } from '../../e2e/fixtures/capture'

afterEach(() => vi.restoreAllMocks())

describe('capture computation contract', () => {
  it.each(['queued', 'running', 'stopping'] as const)('blocks compute while capture is %s', status => {
    expect(captureComputeDisabledReason(captureSession({ status }))).toContain('Tunggu capture selesai')
  })

  it.each(['queued', 'running', 'done'] as const)('blocks duplicate compute while computation is %s', compute_status => {
    expect(captureComputeDisabledReason(captureSession({ status: 'completed', compute_status }))).not.toBeNull()
  })

  it.each(['completed', 'stopped', 'expired', 'failed'] as const)('allows an explicit compute retry for terminal capture %s', status => {
    expect(captureComputeDisabledReason(captureSession({ status, compute_status: 'failed' }))).toBeNull()
  })

  it('retries the same UUID endpoint without creating a new capture or sending images', async () => {
    const session = captureSession({ status: 'completed', compute_status: 'queued' })
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: session })
    await expect(computeCapture(session.camera_id, session.session_id)).resolves.toEqual(session)
    expect(post).toHaveBeenCalledExactlyOnceWith(`/api/v1/cameras/${session.camera_id}/calibration-captures/${session.session_id}/compute`, undefined, { signal: undefined })
  })

  it('explains queue failure and image insufficiency with different recovery actions', () => {
    expect(apiErrorFromResponse(409, { detail: { code: 'calibration_queue_timeout' } }).message).toContain('worker dan antrean calibration')
    expect(apiErrorFromResponse(409, { detail: { code: 'calibration_insufficient_images' } }).message).toContain('Buat sesi capture baru')
  })
})
