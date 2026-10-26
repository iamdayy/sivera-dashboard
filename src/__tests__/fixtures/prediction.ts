import type { PredictionJob } from '@/types'

export function predictionJob(overrides: Partial<PredictionJob> = {}): PredictionJob {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    camera_id: '11111111-1111-4111-8111-111111111111',
    calibration_id: '22222222-2222-4222-8222-222222222222',
    ground_model_id: '55555555-5555-4555-8555-555555555555',
    depth_scale_id: '66666666-6666-4666-8666-666666666666',
    status: 'pending', source_type: 'upload', source_path: null, source_ts: null,
    max_frame_age_sec: 30, volume_cell_m: 0.05, volume_min_pts_per_cell: 2,
    seg_model: null, seg_conf: 0.25, seg_classes: null, return_outputs: [],
    result: null, error_msg: null, started_at: null, completed_at: null,
    created_at: '2026-10-26T08:00:00Z', ...overrides,
  }
}
