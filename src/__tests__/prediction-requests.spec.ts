import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/services/api'
import { getPredictionJob, listPredictionJobs, submitPrediction } from '@/services/predictions'
import { predictionJob } from './fixtures/prediction'

const job = predictionJob()
afterEach(() => vi.restoreAllMocks())

describe('prediction HTTP contract (mock transport)', () => {
  it.each([undefined, [], ['overlay', 'bev_image']])('formats upload with confidence zero and outputs %j', async outputs => {
    const accepted = { job_id: job.id, status: 'pending', message: 'Accepted', estimated_duration_sec: 30 }
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 202, data: accepted })
    const file = new File(['fixture'], 'fixture.png', { type: 'image/png' })
    expect(await submitPrediction(job.camera_id, {
      source_type: 'upload', file, timestamp: '2026-10-26T08:00:00Z', seg_conf: 0,
      seg_classes: ['waste'], volume_cell_m: 0.05, volume_min_pts_per_cell: 2,
      return_outputs: outputs,
    })).toEqual(accepted)
    expect(post).toHaveBeenCalledTimes(1)
    const [url, form] = post.mock.calls[0]!
    expect(url).toBe(`/api/v1/cameras/${job.camera_id}/predict`)
    expect(form).toBeInstanceOf(FormData)
    expect(Object.fromEntries((form as FormData).entries())).toEqual({
      source_type: 'upload', file, timestamp: '2026-10-26T08:00:00Z', seg_conf: '0',
      seg_classes: '["waste"]', volume_cell_m: '0.05', volume_min_pts_per_cell: '2',
      ...(outputs === undefined ? {} : { return_outputs: JSON.stringify(outputs) }),
    })
  })

  it.each(['rtsp_frame', 'latest_rtsp'] as const)('omits file and timestamp for %s even if supplied', async source_type => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { job_id: job.id } })
    await submitPrediction(job.camera_id, { source_type, file: new File(['fixture'], 'fixture.png'), timestamp: '2026-10-26T08:00:00Z', max_frame_age_sec: 30 })
    expect(Object.fromEntries((post.mock.calls[0]![1] as FormData).entries())).toEqual({ source_type, max_frame_age_sec: '30' })
  })

  it('does not retry ambiguous submission failures', async () => {
    const post = vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('connection lost'))
    await expect(submitPrediction(job.camera_id, { source_type: 'rtsp_frame' })).rejects.toMatchObject({ status: null })
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('uses persisted detail and paginated history with the request abort signal', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: job })
    const controller = new AbortController()
    expect(await getPredictionJob(job.camera_id, job.id, controller.signal)).toEqual(job)
    expect(get).toHaveBeenLastCalledWith(`/api/v1/cameras/${job.camera_id}/predict/${job.id}`, { signal: controller.signal })
    await listPredictionJobs(job.camera_id, 2, 10, 'processing')
    expect(get).toHaveBeenLastCalledWith(`/api/v1/cameras/${job.camera_id}/predict?page=2&page_size=10&status=processing`)
  })
})
