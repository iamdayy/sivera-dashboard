import { describe, expect, it } from 'vitest'
import { hasPredictionVolume, predictionFailureMessage } from '@/lib/prediction-job'
import { predictionJob } from './fixtures/prediction'

describe('prediction result and failure presentation', () => {
  it.each([null, {}, { volume: null }, { volume: { method_grid: null } }, { volume: { method_grid: { volume_m3: 1 } } }, { volume: { method_grid: { volume_m3: NaN, volume_liter: 1 } } }])('does not treat missing or invalid volume as a successful measurement: %j', result => {
    expect(hasPredictionVolume(predictionJob({ status: 'done', result }))).toBe(false)
  })
  it.each(['method_grid', 'method_convex_hull'])('accepts a real zero from %s', method => {
    expect(hasPredictionVolume(predictionJob({ result: { volume: { [method]: { volume_m3: 0, volume_liter: 0 } } } }))).toBe(true)
  })
  it('maps worker and snapshot recovery and never displays unknown raw errors', () => {
    expect(predictionFailureMessage(predictionJob({ error_msg: 'prediction_worker_timeout' }))).toContain('buat prediksi baru')
    expect(predictionFailureMessage(predictionJob({ error_msg: 'snapshot_stale' }))).toContain('Ambil snapshot baru')
    expect(predictionFailureMessage(predictionJob({ error_msg: 'rtsp://private:secret@camera' }))).not.toContain('secret')
  })
})
