export interface Camera {
    id: string
    name: string
    resolution_w: number
    resolution_h: number
    fps: number
    latitude: number
    longitude: number
    created_at: string
    has_active_calibration?: boolean
    rtsp_url?: string
}

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

export interface GroundReference {
    id: string
    camera_id: string
    calibration_id: string
    version: number
    image_points: number[][]
    world_points: number[][]
    world_units: string
    description?: string
    is_active: boolean
    created_at: string
}

export interface Prediction {
    id: string
    cameraId: number
    predictionDate: string
    predictionData: Record<string, any>
}

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
    seg_model: string | null
    seg_conf: number
    seg_classes: string[] | null
    result: Record<string, any> | null
    error_msg: string | null
    started_at: string | null
    completed_at: string | null
    created_at: string
}

export interface Activity {
    id: string
    type: string
    status: 'success' | 'info' | 'warning'
    message: string
    created_at: string
    timestamp: string
}

export interface Icons {
    [key: string]: string
}