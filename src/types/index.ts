// Tipe API yang sinkron dengan schema backend (api/schemas/*.py).
// ID selalu UUID string. Field nullable sesuai Optional di Pydantic.

export interface Camera {
  id: string
  name: string
  rtsp_url: null
  rtsp_configured: boolean
  stream_enabled: boolean
  latitude: number | null
  longitude: number | null
  resolution_w: number
  resolution_h: number
  fps: number
  roi_polygon: number[][] | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CameraDetail extends Camera {
  active_calibration_id: string | null
  active_calibration_version: number | null
  active_calibration_rms: number | null
}

export interface PaginatedList<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export type CameraList = PaginatedList<Camera>

export interface CreateCameraPayload {
  name: string
  resolution_w: number
  resolution_h: number
  fps: number
  rtsp_url?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type UpdateCameraPayload = Partial<CreateCameraPayload>

export interface Calibration {
  id: string
  camera_id: string
  version: number
  k_matrix: number[][]
  k_original: number[][] | null
  k_undist: number[][] | null
  resolution_w: number | null
  resolution_h: number | null
  alpha: number | null
  per_view_errors: number[] | null
  dist_coeffs: number[]
  rms_reproj: number | null
  coverage_w: number | null
  coverage_h: number | null
  chessboard_cols: number | null
  chessboard_rows: number | null
  square_m: number | null
  calib_images: string[] | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface CalibrationList {
  items: Calibration[]
  total: number
}

export interface GroundReference {
  id: string
  camera_id: string
  calibration_id: string
  version: number
  image_points: number[][]
  world_points: number[][]
  world_units: 'meter' | 'metre'
  description: string | null
  is_active: boolean
  created_at: string
}

export interface GroundReferenceList {
  items: GroundReference[]
  total: number
}

export type PredictionJobStatus = 'pending' | 'processing' | 'done' | 'failed'
export type PredictionSourceType = 'upload' | 'rtsp_frame' | 'latest_rtsp'

export interface PredictionJob {
  id: string
  camera_id: string
  calibration_id: string
  ground_model_id: string
  depth_scale_id: string
  status: string
  source_type: string
  source_path: string | null
  source_ts: string | null
  max_frame_age_sec: number
  volume_cell_m: number
  volume_min_pts_per_cell: number
  seg_model: string | null
  seg_conf: number
  seg_classes: string[] | null
  return_outputs: string[] | null
  result: Record<string, unknown> | null
  error_msg: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface SubmitPredictionResult {
  job_id: string
  status: string
  message: string
  estimated_duration_sec: number
}

export interface PredictionOutput {
  id: string
  job_id: string
  output_type: string
  file_path: string
  mime_type: string | null
  width: number | null
  height: number | null
  meta: Record<string, unknown> | null
  created_at: string
}

export interface DetectedInstance {
  id: string
  job_id: string
  cls_name: string
  confidence: number
  polygon_px: number[][]
  polygon_world: number[][] | null
  volume_m3: number | null
  footprint_m2: number | null
  height_mean_m: number | null
  height_max_m: number | null
  n_pixels: number
  created_at: string
}

export interface VolumeEstimate {
  id: string
  job_id: string
  method: string
  volume_m3: number
  volume_liter: number
  footprint_m2: number
  cell_m: number | null
  height_mean_m: number | null
  height_median_m: number | null
  n_cells: number | null
  n_points: number | null
  created_at: string
}

export interface HealthStatus {
  status: string
  version: string
  database: string
}

export interface PredictionPrerequisites {
  has_active_calibration: boolean
  has_active_ground_model: boolean
  has_active_depth_scale: boolean
  missing: string[]
  active_calibration_id: string | null
  active_ground_model_id: string | null
  active_depth_scale_id: string | null
  active_ground_ref_id: string | null
}

export type StreamStatus = 'disabled' | 'idle' | 'online' | 'offline' | 'unknown'

export interface StreamResponse {
  camera_id: string
  enabled: boolean
  status: string
  synced: boolean
  whep_url: string | null
  tracks: string[]
  checked_at: string
}

export type CaptureStatus = 'queued' | 'running' | 'stopping' | 'completed' | 'stopped' | 'expired' | 'failed'
export type CaptureComputeStatus = 'none' | 'queued' | 'running' | 'done' | 'failed'

export interface CaptureCreate {
  chessboard_cols: number
  chessboard_rows: number
  square_m: number
  interval_sec: number
  target_images: number
  max_duration_sec: number
  auto_calibrate: boolean
}

export interface CaptureResponse extends CaptureCreate {
  session_id: string
  camera_id: string
  status: string
  selection_version: number
  accepted: number
  rejected: number
  rejection_counts: Record<string, number>
  compute_status: string
  compute_error_code: string | null
  compute_requested_at: string | null
  compute_started_at: string | null
  compute_completed_at: string | null
  result_calibration_id: string | null
  attempted: number
  captured: number
  failed_attempts: number
  resolution_w: number | null
  resolution_h: number | null
  error_code: string | null
  finish_reason: string | null
  created_at: string
  deadline_at: string
  started_at: string | null
  completed_at: string | null
  heartbeat_at: string | null
  last_capture_at: string | null
}

export interface CaptureImageResponse {
  id: string
  sequence: number
  width: number
  height: number
  size_bytes: number
  captured_at: string
  download_url: string
  quality_status: string
  rejection_reason: string | null
  sharpness: number | null
  corners: number[][] | null
  preview_url: string | null
}

export interface CaptureImageList {
  items: CaptureImageResponse[]
  total: number
}

export interface SnapshotResponse {
  id: string
  camera_id: string
  width: number
  height: number
  size_bytes: number
  captured_at: string
  image_url: string
}

export interface DepthScale {
  id: string
  camera_id: string
  ground_model_id: string
  depth_model: string
  scale_s: number
  offset_b: number
  residuals: number[] | null
  mean_residual_m: number | null
  max_residual_m: number | null
  clip_min_m: number
  clip_max_m: number
  is_active: boolean
  created_at: string
}

export interface DepthScaleList {
  items: DepthScale[]
  total: number
}

export interface DepthMeasurement {
  x: number
  y: number
  distance_m: number
}

export interface DepthScaleCreate {
  test_image?: string
  depth_model?: string
  known_distances: DepthMeasurement[]
  clip_min_m?: number
  clip_max_m?: number
}

export interface DepthScaleImageResponse {
  image_id: string
  test_image: string
  image_url: string
  width: number
  height: number
  coordinate_system: 'undistorted_pixels'
  distance_type: 'camera_axis_z_m'
}

export type DepthScaleListResponse = DepthScaleList
