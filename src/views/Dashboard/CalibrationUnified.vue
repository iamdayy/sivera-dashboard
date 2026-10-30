<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { listCameras as apiListCameras, getCamera, getCameraStreamStatus } from '@/services/cameras'
import { getActiveCalibration as apiGetActiveCalibration, listCalibrations, captureCalibrationFrames, activateCalibration, uploadCalibrationImages } from '@/services/calibrations'
import { getActiveGroundReference, getActiveGroundModel, getGroundReferenceSource, createGroundReferenceSource, createGroundReference, getGroundReferenceSourceImageBlob } from '@/services/groundReferences'
import { getDepthScaleContext, createDepthScalePreview, getDepthPreviewImageBlob, deleteDepthPreview, createDepthScale, getActiveDepthScale } from '@/services/depthScales'
import { runPrediction } from '@/services/predictions'
import { normalizeApiError } from '@/services/api'
import type { Camera, Calibration, GroundReference, GroundModel, DepthScale, DepthScalePreviewResponse, DepthScaleCreate, DepthMeasurement, PredictionJob, SubmitPredictionPayload } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ChevronDown, ChevronUp, Video, Camera as CameraIcon, MapPin, Brain, Settings, RotateCcw, Trash2, Eye, Download, Upload, X, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Ruler, Zap, HelpCircle, ChevronRight } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
const apiStore = useApiStore()
const { getApiKey, hasApiKey, busy: scopeBusy, isActive } = useConnectionScope()

const cameraId = computed(() => route.params.id as string)
const camera = ref<Camera | null>(null)
const streamStatus = ref<'disabled' | 'idle' | 'online' | 'offline' | 'unknown'>('unknown')

// Step states
type StepStatus = 'pending' | 'active' | 'done'
type StepKey = 'calibration' | 'groundReference' | 'depthEstimation' | 'prediction'

const stepStatus = ref<Record<StepKey, StepStatus>>({
  calibration: 'pending',
  groundReference: 'pending',
  depthEstimation: 'pending',
  prediction: 'pending',
})

const currentStep = ref<StepKey>('calibration')

// Step 1: Calibration
const calibrations = ref<Calibration[]>([])
const activeCalibration = ref<Calibration | null>(null)
const calibrationBusy = ref(false)
const showCaptureDialog = ref(false)
const showCreateDialog = ref(false)
const captureConfig = reactive({
  chessboard_cols: 9,
  chessboard_rows: 6,
  square_m: 0.025,
  interval_sec: 2,
  target_images: 20,
  max_duration_sec: 300,
  auto_calibrate: true,
  alpha: 0,
})
const uploadFiles = ref<File[]>([])

// Step 2: Ground Reference
const activeGroundRef = ref<GroundReference | null>(null)
const activeGroundModel = ref<GroundModel | null>(null)
const groundRefBusy = ref(false)
const showSourceDialog = ref(false)
const sourceImage = ref<string | null>(null)
const sourceWidth = ref(0)
const sourceHeight = ref(0)
const groundPoints = ref<Array<{ x: number; y: number; worldX: number; worldY: number; sourceId?: string }>>([])
const groundPointWorldX = ref('')
const groundPointWorldY = ref('')

// Step 3: Depth Estimation
const depthScale = ref<DepthScale | null>(null)
const depthBusy = ref(false)
const depthPreview = ref<DepthScalePreviewResponse | null>(null)
const depthPreviewImage = ref<string | null>(null)
const depthMeasurementPoints = ref<Array<{ x: number; y: number; distance_m: number }>>([])
const depthPointDistance = ref('')
const depthTestImageType = ref<'first_calib' | 'latest_snapshot' | 'upload'>('first_calib')
const depthUploadFile = ref<File | null>(null)
const depthPreviewImageKey = ref<string | null>(null)

// Step 4: Prediction
const predictionBusy = ref(false)
const predictionJob = ref<PredictionJob | null>(null)
const predictionSource = ref<'rtsp_frame' | 'latest_rtsp' | 'upload'>('rtsp_frame')
const predictionUploadFile = ref<File | null>(null)
const predictionParams = reactive({
  seg_model: 'yolo11n-seg.pt',
  seg_conf: 0.25,
  seg_classes: [] as string[],
  volume_cell_m: 0.05,
  volume_min_pts_per_cell: 2,
  return_outputs: ['mask', 'overlay', 'bev_image', 'bev_mask_proyeksi', 'instances'] as string[],
})

const stepLabels: Record<StepKey, string> = {
  calibration: 'Kalibrasi',
  groundReference: 'Referensi Tanah',
  depthEstimation: 'Estimasi Kedalaman',
  prediction: 'Prediksi',
}

const hasDepthScale = computed(() => !!depthScale.value)

const stepIcons: Record<StepKey, any> = {
  calibration: Settings,
  groundReference: MapPin,
  depthEstimation: Brain,
  prediction: Zap,
}

const isStepEnabled = computed(() => (step: StepKey) => {
  const order: StepKey[] = ['calibration', 'groundReference', 'depthEstimation', 'prediction']
  const currentIndex = order.indexOf(step)
  if (currentIndex === 0) return true
  return order.slice(0, currentIndex).every(s => stepStatus.value[s] === 'done')
})

const isStepDone = computed(() => (step: StepKey) => stepStatus.value[step] === 'done')
const isStepActive = computed(() => (step: StepKey) => stepStatus.value[step] === 'active')

const updateStepStatus = () => {
  if (activeCalibration.value) {
    stepStatus.value.calibration = 'done'
  } else {
    stepStatus.value.calibration = calibrationBusy.value ? 'active' : 'pending'
  }

  if (activeGroundModel.value) {
    stepStatus.value.groundReference = 'done'
  } else if (activeGroundRef.value) {
    stepStatus.value.groundReference = 'active'
  } else {
    stepStatus.value.groundReference = stepStatus.value.calibration === 'done' ? 'pending' : 'pending'
  }

  if (depthScale.value) {
    stepStatus.value.depthEstimation = 'done'
  } else if (depthPreview.value) {
    stepStatus.value.depthEstimation = 'active'
  } else {
    stepStatus.value.depthEstimation = stepStatus.value.groundReference === 'done' ? 'pending' : 'pending'
  }

  if (predictionJob.value?.status === 'done') {
    stepStatus.value.prediction = 'done'
  } else if (predictionJob.value) {
    stepStatus.value.prediction = 'active'
  } else {
    stepStatus.value.prediction = (stepStatus.value.calibration === 'done' && stepStatus.value.groundReference === 'done' && stepStatus.value.depthEstimation === 'done') ? 'pending' : 'pending'
  }
}

const depthUploadFileName = computed(() => depthUploadFile.value?.name || 'Belum dipilih')
const predictionUploadFileName = computed(() => predictionUploadFile.value?.name || 'Belum dipilih')
const hasPredictionUploadFile = computed(() => !!predictionUploadFile.value)

// Initialize
async function loadCamera() {
  if (!cameraId.value) return
  try {
    camera.value = await getCamera(cameraId.value)
    const status = await getCameraStreamStatus(cameraId.value)
    streamStatus.value = status.status as 'disabled' | 'idle' | 'online' | 'offline' | 'unknown'
  } catch (error) {
    console.error('Failed to load camera:', error)
    toastError('Error', { description: 'Gagal memuat kamera' })
    router.push('/dashboard/cameras')
  }
}

async function loadCalibrations() {
  if (!cameraId.value) return
  try {
    const data = await listCalibrations(cameraId.value)
    calibrations.value = data.items
    const active = data.items.find(c => c.is_active)
    if (active) {
      activeCalibration.value = active
    }
  } catch (error) {
    console.error('Failed to load calibrations:', error)
  }
}

async function loadGroundReference() {
  if (!cameraId.value) return
  try {
    const ref = await getActiveGroundReference(cameraId.value)
    activeGroundRef.value = ref
    if (ref) {
      const model = await getActiveGroundModel(cameraId.value)
      activeGroundModel.value = model
    }
  } catch (error) {
    // No active ground reference
  }
}

async function loadDepthScale() {
  if (!cameraId.value || !activeGroundModel.value) return
  try {
    const scale = await getActiveDepthScale(cameraId.value, activeGroundModel.value.id)
    depthScale.value = scale
  } catch (error) {
    // No active depth scale
  }
}

async function loadAll() {
  await loadCamera()
  await loadCalibrations()
  await loadGroundReference()
  await loadDepthScale()
  updateStepStatus()
}

onMounted(() => {
  loadAll()
})

// Step 1: Calibration handlers
async function startCapture() {
  if (!cameraId.value || !hasApiKey.value || !getApiKey()) return
  calibrationBusy.value = true
  try {
    const result = await captureCalibrationFrames(cameraId.value, captureConfig)
    if (result.compute_status === 'done' && result.result_calibration_id) {
      await loadCalibrations()
      toastSuccess('Berhasil', { description: 'Kalibrasi selesai dan aktif' })
    } else {
      toastInfo('Capture selesai', { description: `Terkumpul ${result.accepted} frame. Klik "Buat Kalibrasi" untuk melanjutkan.` })
    }
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    calibrationBusy.value = false
    showCaptureDialog.value = false
  }
}

async function createCalibrationFromUpload() {
  if (!cameraId.value || !hasApiKey.value || !getApiKey() || uploadFiles.value.length === 0) return
  calibrationBusy.value = true
  try {
    const formData = new FormData()
    uploadFiles.value.forEach(f => formData.append('files', f))
    formData.append('chessboard_cols', String(captureConfig.chessboard_cols))
    formData.append('chessboard_rows', String(captureConfig.chessboard_rows))
    formData.append('square_m', String(captureConfig.square_m))
    formData.append('alpha', '0')
    await uploadCalibrationImages(cameraId.value, formData)
    await loadCalibrations()
    toastSuccess('Berhasil', { description: 'Kalibrasi dibuat dari upload' })
    uploadFiles.value = []
    showCreateDialog.value = false
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    calibrationBusy.value = false
  }
}

async function activateCalib(calib: Calibration) {
  if (!cameraId.value || !hasApiKey.value || !getApiKey()) return
  calibrationBusy.value = true
  try {
    await activateCalibration(cameraId.value, calib.id)
    await loadCalibrations()
    await loadGroundReference()
    await loadDepthScale()
    updateStepStatus()
    toastSuccess('Berhasil', { description: 'Kalibrasi diaktifkan' })
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    calibrationBusy.value = false
  }
}

// Step 2: Ground Reference handlers
async function createGroundRefSource() {
  if (!cameraId.value || !hasApiKey.value || !getApiKey() || !activeCalibration.value) return
  groundRefBusy.value = true
  try {
    const source = await createGroundReferenceSource(cameraId.value)
    // Get the undistorted image
    const sourceDetail = await getGroundReferenceSource(cameraId.value, source.id)
    sourceWidth.value = sourceDetail.width
    sourceHeight.value = sourceDetail.height
    
    // Load the image blob and create object URL
    const blob = await getGroundReferenceSourceImageBlob(cameraId.value, source.id)
    sourceImage.value = URL.createObjectURL(blob)
    
    groundPoints.value = []
    showSourceDialog.value = true
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    groundRefBusy.value = false
  }
}

function addGroundPoint(event: MouseEvent) {
  if (!sourceImage.value) return
  const rect = (event.target as HTMLImageElement).getBoundingClientRect()
  const scaleX = sourceWidth.value / rect.width
  const scaleY = sourceHeight.value / rect.height
  const x = Math.round((event.clientX - rect.left) * scaleX)
  const y = Math.round((event.clientY - rect.top) * scaleY)
  if (x >= 0 && x < sourceWidth.value && y >= 0 && y < sourceHeight.value) {
    groundPoints.value.push({ x, y, worldX: 0, worldY: 0 })
  }
}

async function saveGroundReference() {
  if (!cameraId.value || !hasApiKey.value || !getApiKey() || !activeCalibration.value || groundPoints.value.length < 4) return
  groundRefBusy.value = true
  try {
    const imagePoints = groundPoints.value.map(p => [p.x, p.y] as [number, number])
    const worldPoints = groundPoints.value.map(p => [p.worldX, p.worldY] as [number, number])
    await createGroundReference(cameraId.value, { image_points: imagePoints, world_points: worldPoints, world_units: 'meter' })
    await loadGroundReference()
    await loadDepthScale()
    updateStepStatus()
    showSourceDialog.value = false
    if (sourceImage.value) URL.revokeObjectURL(sourceImage.value)
    sourceImage.value = null
    groundPoints.value = []
    toastSuccess('Berhasil', { description: 'Referensi tanah dibuat dan diaktifkan' })
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    groundRefBusy.value = false
  }
}

function updateGroundPointWorld(index: number, field: 'worldX' | 'worldY', value: string) {
  const num = parseFloat(value)
  if (!isNaN(num) && groundPoints.value[index]) {
    groundPoints.value[index][field] = num
  }
}

function handleDepthFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  depthUploadFile.value = target.files?.[0] || null
}

function handlePredictionFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  predictionUploadFile.value = target.files?.[0] || null
}

// Step 3: Depth Estimation handlers
async function runDepthPreview() {
  if (!cameraId.value || !hasApiKey.value || !getApiKey() || !activeGroundModel.value || !activeCalibration.value) return
  depthBusy.value = true
  try {
    let testImage: string | undefined
    if (depthTestImageType.value === 'first_calib' && activeCalibration.value.calib_images?.length) {
      testImage = activeCalibration.value.calib_images[0]
    } else if (depthTestImageType.value === 'latest_snapshot') {
      testImage = activeCalibration.value.calib_images?.[0]
    }
    // For upload, we'd need to upload first - simplified for now
    
    const preview = await createDepthScalePreview(cameraId.value, activeGroundModel.value.id, { test_image: testImage, depth_model: 'yolo26n-depth.pt' })
    depthPreview.value = preview
    depthPreviewImageKey.value = preview.depth_image_id
    
    // Load visualization
    const blob = await getDepthPreviewImageBlob(cameraId.value, activeGroundModel.value.id, preview.depth_image_id)
    depthPreviewImage.value = URL.createObjectURL(blob)
    
    depthMeasurementPoints.value = []
    updateStepStatus()
    toastSuccess('Pratinjau kedalaman siap', { description: 'Klik pada gambar untuk menambahkan titik pengukuran' })
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    depthBusy.value = false
  }
}

function addDepthPoint(event: MouseEvent) {
  if (!depthPreviewImage.value || !depthPreview.value) return
  const rect = (event.target as HTMLImageElement).getBoundingClientRect()
  const scaleX = depthPreview.value.width / rect.width
  const scaleY = depthPreview.value.height / rect.height
  const x = Math.round((event.clientX - rect.left) * scaleX)
  const y = Math.round((event.clientY - rect.top) * scaleY)
  if (x >= 0 && x < depthPreview.value.width && y >= 0 && y < depthPreview.value.height) {
    depthMeasurementPoints.value.push({ x, y, distance_m: 0 })
  }
}

async function createDepthScaleFromPreview() {
  if (!cameraId.value || !hasApiKey.value || !getApiKey() || !activeGroundModel.value || !depthPreview.value || depthMeasurementPoints.value.length < 3) return
  depthBusy.value = true
  try {
    // Validate all points have distance
    const incomplete = depthMeasurementPoints.value.some(p => p.distance_m <= 0)
    if (incomplete) {
      toastError('Error', { description: 'Semua titik harus diisi jaraknya (meter)' })
      return
    }
    
    const payload: DepthScaleCreate = {
      depth_image_id: depthPreview.value.depth_image_id,
      depth_model: 'yolo26n-depth.pt',
      clip_min_m: 0.1,
      clip_max_m: 50.0,
      known_distances: depthMeasurementPoints.value.map(p => ({ x: p.x, y: p.y, distance_m: p.distance_m })),
    }
    
    const scale = await createDepthScale(cameraId.value, activeGroundModel.value.id, payload)
    depthScale.value = scale
    depthPreview.value = null
    depthPreviewImage.value = null
    depthMeasurementPoints.value = []
    updateStepStatus()
    toastSuccess('Berhasil', { description: 'Skala kedalaman dibuat dan diaktifkan' })
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    depthBusy.value = false
  }
}

function updateDepthPointDistance(index: number, value: string) {
  const num = parseFloat(value)
  if (!isNaN(num) && num > 0 && depthMeasurementPoints.value[index]) {
    depthMeasurementPoints.value[index].distance_m = num
  }
}

function removeDepthPoint(index: number) {
  depthMeasurementPoints.value.splice(index, 1)
}

async function redoDepthScale() {
  depthScale.value = null
  depthPreview.value = null
  depthPreviewImage.value = null
  depthMeasurementPoints.value = []
  updateStepStatus()
}

// Step 4: Prediction handlers
async function runPredictionJob() {
  if (!cameraId.value || !hasApiKey.value || !getApiKey() || !activeCalibration.value || !activeGroundModel.value || !depthScale.value) return
  predictionBusy.value = true
  try {
    const payload: SubmitPredictionPayload = {
      source_type: predictionSource.value,
      seg_model: predictionParams.seg_model,
      seg_conf: predictionParams.seg_conf,
      seg_classes: predictionParams.seg_classes,
      volume_cell_m: predictionParams.volume_cell_m,
      volume_min_pts_per_cell: predictionParams.volume_min_pts_per_cell,
      return_outputs: predictionParams.return_outputs,
    }
    
    const result = await runPrediction(cameraId.value, payload)
    predictionJob.value = {
      id: result.job_id,
      camera_id: cameraId.value,
      calibration_id: activeCalibration.value.id,
      ground_model_id: activeGroundModel.value.id,
      depth_scale_id: depthScale.value.id,
      status: result.status,
      source_type: predictionSource.value,
      source_path: null,
      source_ts: null,
      max_frame_age_sec: 300,
      volume_cell_m: predictionParams.volume_cell_m,
      volume_min_pts_per_cell: predictionParams.volume_min_pts_per_cell,
      seg_model: predictionParams.seg_model,
      seg_conf: predictionParams.seg_conf,
      seg_classes: predictionParams.seg_classes,
      return_outputs: predictionParams.return_outputs,
      result: null,
      error_msg: null,
      started_at: new Date().toISOString(),
      completed_at: null,
      created_at: new Date().toISOString(),
    }
    updateStepStatus()
    // Poll for completion would go here
    toastSuccess('Prediksi dimulai', { description: `Job ID: ${result.job_id}` })
  } catch (error) {
    toastError('Error', { description: normalizeApiError(error).message })
  } finally {
    predictionBusy.value = false
  }
}

function goToPredictions() {
  router.push(`/dashboard/predictions?camera=${cameraId.value}`)
}

// Cleanup
const collapsedSteps = ref<Record<StepKey, boolean>>({
  calibration: false,
  groundReference: false,
  depthEstimation: false,
  prediction: false,
})

function toggleCollapse(step: StepKey) {
  if (isStepDone.value(step)) {
    collapsedSteps.value[step] = !collapsedSteps.value[step]
  }
}

const isBusy = computed(() => calibrationBusy.value || groundRefBusy.value || depthBusy.value || predictionBusy.value || scopeBusy.value)

watch([activeCalibration, activeGroundModel, depthScale, predictionJob], updateStepStatus, { deep: true })
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto px-4 py-6">
    <!-- Camera Header -->
    <div v-if="camera" class="card">
      <CardHeader class="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle class="text-xl">{{ camera.name }}</CardTitle>
          <div class="flex items-center gap-2 text-sm text-text-muted mt-1">
            <span :class="streamStatus === 'online' ? 'text-green-600' : 'text-gray-500'" class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full" :class="streamStatus === 'online' ? 'bg-green-500' : 'bg-gray-400'"></span>
              RTSP: {{ streamStatus === 'online' ? 'Live' : streamStatus }}
            </span>
            <span class="text-gray-300">|</span>
            <span>Resolusi: {{ camera.resolution_w }}×{{ camera.resolution_h }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" @click="goToPredictions" :disabled="!hasApiKey || !activeCalibration || !activeGroundModel || !depthScale">
            <Brain class="w-4 h-4 mr-1" />
            Buka Analisis
          </Button>
        </div>
      </CardHeader>
    </div>

    <!-- Progress Tracker -->
    <div class="card">
      <CardContent class="pt-4 pb-2">
        <div class="flex items-center">
          <template v-for="(step, index) in ['calibration', 'groundReference', 'depthEstimation', 'prediction']" :key="step">
            <div class="flex items-center">
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5">
                  <span :class="[
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                    isStepDone(step) ? 'bg-green-100 text-green-700' : 
                    isStepActive(step) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  ]">
                    <CheckCircle v-if="isStepDone(step)" class="w-4 h-4" />
                    <component v-else :is="stepIcons[step as keyof typeof stepIcons]" class="w-4 h-4" />
                  </span>
                  <span class="text-sm font-medium" :class="isStepDone(step) ? 'text-green-700' : isStepActive(step) ? 'text-blue-700' : 'text-gray-500'">
                    {{ stepLabels[step as keyof typeof stepLabels] }}
                  </span>
                </div>
                <ChevronRight v-if="index < 3" class="text-gray-300" />
              </div>
            </div>
          </template>
        </div>
      </CardContent>
    </div>

    <!-- Step 1: Calibration -->
    <div class="card" :class="collapsedSteps.calibration ? 'min-h-[80px]' : ''">
      <CardHeader class="pb-2" @click="toggleCollapse('calibration')" style="cursor: pointer;">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="stepIcons.calibration" :class="isStepDone('calibration') ? 'text-green-600' : isStepActive('calibration') ? 'text-blue-600' : 'text-gray-400'" class="w-5 h-5" />
            <CardTitle class="text-lg">Langkah 1: Kalibrasi Kamera</CardTitle>
            <Badge :variant="isStepDone('calibration') ? 'default' : isStepActive('calibration') ? 'secondary' : 'outline'">
              {{ isStepDone('calibration') ? 'Selesai ✓' : isStepActive('calibration') ? 'Aktif' : 'Belum' }}
            </Badge>
          </div>
          <ChevronUp v-if="collapsedSteps.calibration" class="text-gray-400" />
          <ChevronDown v-else class="text-gray-400" />
        </div>
      </CardHeader>
      <CardContent v-if="!collapsedSteps.calibration" class="space-y-4">
        <div v-if="!activeCalibration" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <Label>Kolom Catur</Label>
              <Input v-model.number="captureConfig.chessboard_cols" type="number" min="4" max="20" />
            </div>
            <div>
              <Label>Baris Catur</Label>
              <Input v-model.number="captureConfig.chessboard_rows" type="number" min="4" max="20" />
            </div>
            <div>
              <Label>Ukuran Kotak (meter)</Label>
              <Input v-model.number="captureConfig.square_m" type="number" step="0.001" min="0.001" max="1" />
            </div>
            <div>
              <Label>Alpha (0-1)</Label>
              <Input v-model.number="captureConfig.alpha" type="number" step="0.1" min="0" max="1" />
            </div>
          </div>
          
          <div class="flex flex-wrap gap-2">
            <Button 
              variant="default" 
              :disabled="!hasApiKey || !getApiKey() || streamStatus !== 'online' || calibrationBusy"
              @click="showCaptureDialog = true"
            >
              <Video class="w-4 h-4 mr-1" />
              Mulai Capture dari Stream RTSP
            </Button>
            <Button variant="outline" :disabled="!hasApiKey || !getApiKey() || calibrationBusy" @click="showCreateDialog = true">
              <Upload class="w-4 h-4 mr-1" />
              Unggah Gambar Kalibrasi
            </Button>
          </div>
          
          <div v-if="calibrations.length > 0" class="border-t pt-4">
            <h4 class="font-medium mb-2">Riwayat Kalibrasi</h4>
            <div class="space-y-2">
              <div v-for="calib in calibrations" :key="calib.id" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span class="font-medium">v{{ calib.version }}</span>
                  <span class="text-sm text-gray-500 ml-2">RMS: {{ calib.rms_reproj?.toFixed(3) || 'N/A' }} px</span>
                  <Badge v-if="calib.is_active" class="ml-2" variant="default">Aktif</Badge>
                </div>
                <div class="flex gap-2">
                  <Button variant="ghost" size="sm" @click="activateCalib(calib)" :disabled="calib.is_active || calibrationBusy">
                    <RotateCcw class="w-3 h-3 mr-1" /> Aktifkan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="space-y-4">
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-green-800">Kalibrasi Aktif: v{{ activeCalibration?.version }}</p>
                <p class="text-sm text-green-700">RMS Reprojeksi: {{ activeCalibration?.rms_reproj?.toFixed(3) || 'N/A' }} px</p>
              </div>
              <div class="flex gap-2">
                <Button variant="outline" size="sm" @click="showCreateDialog = true">
                  <RotateCcw class="w-3 h-3 mr-1" />
                  Buat Kalibrasi Baru
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </div>

    <!-- Step 2: Ground Reference -->
    <div class="card" :class="collapsedSteps.groundReference ? 'min-h-[80px]' : ''">
      <CardHeader class="pb-2" @click="toggleCollapse('groundReference')" style="cursor: pointer;">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="stepIcons.groundReference" :class="isStepDone('groundReference') ? 'text-green-600' : isStepActive('groundReference') ? 'text-blue-600' : 'text-gray-400'" class="w-5 h-5" />
            <CardTitle class="text-lg">Langkah 2: Referensi Tanah</CardTitle>
            <Badge :variant="isStepDone('groundReference') ? 'default' : isStepActive('groundReference') ? 'secondary' : 'outline'">
              {{ isStepDone('groundReference') ? 'Selesai ✓' : isStepActive('groundReference') ? 'Aktif' : 'Belum' }}
            </Badge>
          </div>
          <ChevronUp v-if="collapsedSteps.groundReference" class="text-gray-400" />
          <ChevronDown v-else class="text-gray-400" />
        </div>
      </CardHeader>
      <CardContent v-if="!collapsedSteps.groundReference" class="space-y-4">
        <div v-if="!activeGroundModel" class="space-y-4">
          <AlertCircle class="w-5 h-5 text-yellow-500" v-if="!activeCalibration" />
          <p v-if="!activeCalibration" class="text-gray-500">Selesaikan kalibrasi terlebih dahulu</p>
          
          <div v-else class="space-y-4">
            <Button 
              variant="default" 
              :disabled="!hasApiKey || !getApiKey() || groundRefBusy || streamStatus !== 'online'"
              @click="createGroundRefSource"
            >
              <CameraIcon class="w-4 h-4 mr-1" />
              Ambil Gambar Tanah dari Stream
            </Button>
            
            <p class="text-sm text-gray-500">Atau gunakan mode manual (klik pada gambar kalibrasi)</p>
          </div>
        </div>
        
        <div v-else class="space-y-4">
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="font-medium text-green-800">Model Ground Aktif</p>
            <p class="text-sm text-green-700">Ketinggian kamera: {{ activeGroundModel?.cam_height?.toFixed(2) || 'N/A' }} m | Pitch: {{ activeGroundModel?.pitch_down_deg?.toFixed(1) || 'N/A' }}°</p>
            <p class="text-sm text-green-700">Error reprojeksi: {{ activeGroundModel?.reproj_err_px?.toFixed(2) || 'N/A' }} px</p>
          </div>
          
          <Button variant="outline" size="sm" @click="showSourceDialog = true">
            <RotateCcw class="w-3 h-3 mr-1" />
            Buat Referensi Baru
          </Button>
        </div>
      </CardContent>
    </div>

    <!-- Step 3: Depth Estimation -->
    <div class="card" :class="collapsedSteps.depthEstimation ? 'min-h-[80px]' : ''">
      <CardHeader class="pb-2" @click="toggleCollapse('depthEstimation')" style="cursor: pointer;">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="stepIcons.depthEstimation" :class="isStepDone('depthEstimation') ? 'text-green-600' : isStepActive('depthEstimation') ? 'text-blue-600' : 'text-gray-400'" class="w-5 h-5" />
            <CardTitle class="text-lg">Langkah 3: Estimasi Kedalaman (YOLO26n-depth)</CardTitle>
            <Badge :variant="isStepDone('depthEstimation') ? 'default' : isStepActive('depthEstimation') ? 'secondary' : 'outline'">
              {{ isStepDone('depthEstimation') ? 'Selesai ✓' : isStepActive('depthEstimation') ? 'Aktif' : 'Belum' }}
            </Badge>
          </div>
          <ChevronUp v-if="collapsedSteps.depthEstimation" class="text-gray-400" />
          <ChevronDown v-else class="text-gray-400" />
        </div>
      </CardHeader>
      <CardContent v-if="!collapsedSteps.depthEstimation" class="space-y-4">
        <div v-if="!depthScale">
          <AlertCircle class="w-5 h-5 text-yellow-500" v-if="!activeGroundModel" />
          <p v-if="!activeGroundModel" class="text-gray-500">Selesaikan referensi tanah terlebih dahulu</p>
          
          <div v-else-if="!depthPreview" class="space-y-4">
            <div>
              <Label>Gambar Uji</Label>
              <Select v-model="depthTestImageType">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_calib">Gambar Kalibrasi Pertama</SelectItem>
                  <SelectItem value="latest_snapshot">Snapshot RTSP Terbaru</SelectItem>
                  <SelectItem value="upload">Unggah Gambar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div v-if="depthTestImageType === 'upload'" class="space-y-2">
              <input type="file" @change="handleDepthFileChange" accept="image/*" class="input w-full" />
              <p class="text-sm text-gray-500">File: {{ depthUploadFileName }}</p>
            </div>
            
            <Button 
              variant="default" 
              :disabled="!hasApiKey || !getApiKey() || depthBusy"
              @click="runDepthPreview"
            >
              <Loader2 v-if="depthBusy" class="w-4 h-4 mr-1 animate-spin" />
              <Brain v-else class="w-4 h-4 mr-1" />
              Jalankan YOLO Depth
            </Button>
          </div>
          
          <!-- Depth Preview & Measurement -->
          <div v-else-if="depthPreview && !depthScale" class="space-y-4">
            <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p class="font-medium text-blue-800">Pratinjau Kedalaman Siap</p>
              <p class="text-sm text-blue-700">Model: {{ depthPreview.model_used }} | Ukuran: {{ depthPreview.width }}×{{ depthPreview.height }}</p>
              <p class="text-sm text-blue-700">Depth Raw: Min {{ depthPreview.depth_stats.min.toFixed(2) }} | Max {{ depthPreview.depth_stats.max.toFixed(2) }} | Mean {{ depthPreview.depth_stats.mean.toFixed(2) }}</p>
            </div>
            
            <div class="relative" style="max-width: 100%;">
              <img 
                v-if="depthPreviewImage" 
                :src="depthPreviewImage" 
                alt="Depth visualization"
                @click="addDepthPoint"
                style="width: 100%; max-height: 600px; cursor: crosshair;"
                class="border rounded-lg"
              />
              <div v-for="(point, index) in depthMeasurementPoints" :key="index" 
                class="absolute w-3 h-3 bg-red-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                :style="{ left: (point.x / depthPreview!.width * 100) + '%', top: (point.y / depthPreview!.height * 100) + '%' }"
              >
                <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-xs bg-red-500 text-white px-1 rounded whitespace-nowrap">{{ index + 1 }}</span>
              </div>
            </div>
            
            <div class="space-y-2">
              <h4 class="font-medium">Titik Pengukuran (min 3)</h4>
              <div v-for="(point, index) in depthMeasurementPoints" :key="index" class="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span class="w-6 text-center text-sm font-medium">{{ index + 1 }}</span>
                <span class="text-sm text-gray-600">x: {{ point.x }}, y: {{ point.y }}</span>
                <Input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  placeholder="Jarak (meter)" 
                  :value="point.distance_m || ''"
                  @input="(e: Event) => updateDepthPointDistance(index, (e.target as HTMLInputElement).value)"
                  class="w-32"
                />
                <Button variant="ghost" size="sm" @click="removeDepthPoint(index)">
                  <X class="w-3 h-3" />
                </Button>
              </div>
              <p v-if="depthMeasurementPoints.length < 3" class="text-sm text-amber-600">Minimal 3 titik pengukuran</p>
            </div>
            
            <div class="flex gap-2">
              <Button variant="default" :disabled="depthBusy || depthMeasurementPoints.length < 3 || depthMeasurementPoints.some(p => p.distance_m <= 0)" @click="createDepthScaleFromPreview">
                <Loader2 v-if="depthBusy" class="w-4 h-4 mr-1 animate-spin" />
                <CheckCircle v-else class="w-4 h-4 mr-1" />
                Hitung & Aktifkan Skala
              </Button>
              <Button variant="outline" @click="depthPreview = null; depthPreviewImage = null; depthMeasurementPoints = []; updateStepStatus()">
                <RotateCcw class="w-3 h-3 mr-1" />
                Ulangi
              </Button>
            </div>
          </div>
          
          <!-- Active Depth Scale -->
          <div v-else-if="hasDepthScale" class="space-y-4">
            <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p class="font-medium text-green-800">Skala Kedalaman Aktif</p>
              <div class="grid grid-cols-2 gap-2 text-sm mt-2">
                <div><span class="text-gray-600">Model:</span> {{ depthScale!.depth_model }}</div>
                <div><span class="text-gray-600">Scale (s):</span> {{ depthScale!.scale_s?.toFixed(6) }}</div>
                <div><span class="text-gray-600">Offset (b):</span> {{ depthScale!.offset_b?.toFixed(3) }} m</div>
                <div><span class="text-gray-600">Clip:</span> {{ depthScale!.clip_min_m }}–{{ depthScale!.clip_max_m }} m</div>
                <div><span class="text-gray-600">Mean Residual:</span> {{ depthScale!.mean_residual_m?.toFixed(3) }} m</div>
                <div><span class="text-gray-600">Max Residual:</span> {{ depthScale!.max_residual_m?.toFixed(3) }} m</div>
              </div>
            </div>
            <Button variant="outline" @click="redoDepthScale">
              <RotateCcw class="w-3 h-3 mr-1" />
              Buat Ulang Skala
            </Button>
          </div>
          
          <!-- No depth scale yet -->
          <div v-else class="space-y-4">
            <p class="text-gray-500 text-center py-8">Belum ada skala kedalaman. Klik "Jalankan YOLO Depth" untuk memulai.</p>
          </div>
        </div>
      </CardContent>
    </div>

    <!-- Step 4: Prediction -->
    <div class="card" :class="collapsedSteps.prediction ? 'min-h-[80px]' : ''">
      <CardHeader class="pb-2" @click="toggleCollapse('prediction')" style="cursor: pointer;">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="stepIcons.prediction" :class="isStepDone('prediction') ? 'text-green-600' : isStepActive('prediction') ? 'text-blue-600' : 'text-gray-400'" class="w-5 h-5" />
            <CardTitle class="text-lg">Langkah 4: Prediksi Volume Sampah</CardTitle>
            <Badge :variant="isStepDone('prediction') ? 'default' : isStepActive('prediction') ? 'secondary' : 'outline'">
              {{ isStepDone('prediction') ? 'Selesai ✓' : isStepActive('prediction') ? 'Proses' : 'Siap' }}
            </Badge>
          </div>
          <ChevronUp v-if="collapsedSteps.prediction" class="text-gray-400" />
          <ChevronDown v-else class="text-gray-400" />
        </div>
      </CardHeader>
      <CardContent v-if="!collapsedSteps.prediction" class="space-y-4">
        <div v-if="!activeCalibration || !activeGroundModel || !depthScale" class="space-y-2">
          <AlertCircle class="w-5 h-5 text-yellow-500" />
          <p class="text-gray-500">Selesaikan semua langkah sebelumnya untuk mengaktifkan prediksi</p>
          <ul class="text-sm text-gray-500 space-y-1 pl-4 list-disc">
            <li v-if="!activeCalibration">❌ Kalibrasi belum aktif</li>
            <li v-else>✅ Kalibrasi aktif</li>
            <li v-if="!activeGroundModel">❌ Referensi tanah/model ground belum aktif</li>
            <li v-else>✅ Model ground aktif</li>
            <li v-if="!depthScale">❌ Skala kedalaman belum aktif</li>
            <li v-else>✅ Skala kedalaman aktif</li>
          </ul>
        </div>
        
        <div v-else class="space-y-4">
          <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p class="font-medium text-green-800">Semua Prasyarat Terpenuhi</p>
            <p class="text-sm text-green-700">Siap menjalankan analisis volume sampah</p>
          </div>
          
          <div>
            <Label class="block mb-2">Sumber Gambar (RTSP Prioritas)</Label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="predictionSource" value="rtsp_frame" name="pred_source" :disabled="streamStatus !== 'online'">
                <span class="flex items-center gap-2">
                  <Video class="w-4 h-4 text-blue-600" />
                  <span>Frame RTSP Baru (Live) — capture saat eksekusi</span>
                </span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="predictionSource" value="latest_rtsp" name="pred_source" :disabled="streamStatus !== 'online'">
                <span class="flex items-center gap-2">
                  <ImageIcon class="w-4 h-4 text-blue-600" />
                  <span>Snapshot RTSP Terbaru — gambar tersimpan terakhir</span>
                </span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="predictionSource" value="upload" name="pred_source">
                <span class="flex items-center gap-2">
                  <Upload class="w-4 h-4 text-gray-600" />
                  <span>Unggah Gambar (fallback jika tidak ada RTSP)</span>
                </span>
              </label>
            </div>
          </div>
          
          <div v-if="predictionSource === 'upload'" class="space-y-2">
            <input type="file" @change="handlePredictionFileChange" accept="image/*" class="input w-full" />
            <p class="text-sm text-gray-500">File: {{ predictionUploadFileName }}</p>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Model Segmentasi</Label>
              <Input v-model="predictionParams.seg_model" placeholder="yolo11n-seg.pt" />
            </div>
            <div>
              <Label>Confidence Threshold</Label>
              <Input v-model.number="predictionParams.seg_conf" type="number" step="0.05" min="0" max="1" />
            </div>
            <div>
              <Label>Ukuran Sel Volume (meter)</Label>
              <Input v-model.number="predictionParams.volume_cell_m" type="number" step="0.01" min="0.01" max="1" />
            </div>
            <div>
              <Label>Min Titik per Sel</Label>
              <Input v-model.number="predictionParams.volume_min_pts_per_cell" type="number" min="1" max="10" />
            </div>
          </div>
          
          <Button 
            variant="default" 
            :disabled="!hasApiKey || !getApiKey() || predictionBusy || (predictionSource === 'upload' && !hasPredictionUploadFile)"
            @click="runPredictionJob"
            class="w-full"
          >
            <Loader2 v-if="predictionBusy" class="w-4 h-4 mr-1 animate-spin" />
            <Zap v-else class="w-4 h-4 mr-1" />
            Jalankan Prediksi
          </Button>
          
          <div v-if="predictionJob" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="font-medium text-blue-800">Job Prediksi: {{ predictionJob.id.slice(0, 8) }}...</p>
            <p class="text-sm text-blue-700">Status: {{ predictionJob.status }}</p>
            <Button variant="outline" size="sm" @click="goToPredictions">
              <Eye class="w-3 h-3 mr-1" />
              Lihat Detail di Halaman Analisis
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  </div>
</template>