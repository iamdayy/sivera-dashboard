// Tipe API yang sinkron dengan schema backend (api/schemas/*.py).
// ID selalu UUID string. Field nullable sesuai Optional di Pydantic.

export interface Camera {
  id: string
  name: string
  rtsp_url: string | null
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
  status: PredictionJobStatus
  source_type: PredictionSourceType
  source_path: string | null
  source_ts: string | null
  seg_model: string | null
  seg_conf: number
  seg_classes: string[] | null
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
  missing: string[]
}