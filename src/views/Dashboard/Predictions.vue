<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold text-text">Analisis Sampah</h1>
      <p class="text-sm text-text-muted">Riwayat dan detail job prediksi volume per kamera.</p>
    </header>

    <div v-if="!apiStore.hasApiKey" class="card empty-state py-10" role="alert">
      <KeyRound class="empty-state-icon" aria-hidden="true" />
      <p class="empty-state-title">API key belum diatur</p>
      <p class="empty-state-description">Atur origin API dan API key di halaman Pengaturan untuk melihat prediksi.</p>
      <RouterLink to="/dashboard/settings" class="btn btn-primary empty-state-action">Buka Pengaturan</RouterLink>
    </div>

    <template v-else>
      <section class="card space-y-3" aria-labelledby="predictions-camera">
        <label for="predictions-camera-select" class="text-sm font-medium text-text">Pilih Kamera</label>
        <select
          id="predictions-camera-select"
          v-model="selectedCameraId"
          class="input w-full max-w-md min-h-11"
          :disabled="camerasLoading"
        >
          <option v-if="cameras.length === 0 && !camerasLoading" value="" disabled>Belum ada kamera</option>
          <option v-for="camera in cameras" :key="camera.id" :value="camera.id">{{ camera.name }}</option>
        </select>
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="primary" class="min-h-11" :disabled="!selectedCameraId" @click="openSubmitDialog">
            Jalankan Prediksi Baru
          </Button>
          <Button variant="outline" class="min-h-11" :disabled="!selectedCameraId || jobsLoading" @click="loadJobs">
            Muat ulang riwayat prediksi
          </Button>
        </div>
      </section>

      <section v-if="selectedCameraId" class="card space-y-3" aria-labelledby="predictions-readiness">
        <h2 id="predictions-readiness" class="text-lg font-semibold text-text">Kesiapan prediksi</h2>
        <div v-if="readinessLoading" class="loading-state py-4" role="status">
          <div class="spinner" aria-hidden="true" />
          Memeriksa prasyarat...
        </div>
        <div v-else-if="readinessError" class="space-y-2" role="alert">
          <p class="text-sm text-negative">{{ readinessError }}</p>
          <Button variant="outline" class="min-h-11" @click="fetchReadiness(selectedCameraId)">Coba Lagi</Button>
        </div>
        <template v-else-if="readiness">
          <ul class="space-y-2">
            <li class="rounded-md border border-sheet-border p-3">
              <p class="font-medium text-text">Kalibrasi aktif</p>
              <p class="text-sm text-text-muted">
                {{ readiness.has_active_calibration ? 'Kalibrasi aktif tersedia; lihat persyaratan sumber di bawah.' : 'Kalibrasi aktif belum tersedia atau tidak sesuai kamera.' }}
              </p>
            </li>
            <li class="rounded-md border border-sheet-border p-3">
              <p class="font-medium text-text">Model ground aktif</p>
              <p class="text-sm text-text-muted">
                {{ readiness.has_active_ground_model ? 'Model cocok dengan kalibrasi dan referensi tanah aktif.' : 'Model ground belum tersedia atau tidak cocok dengan konfigurasi aktif.' }}
              </p>
            </li>
            <li class="rounded-md border border-sheet-border p-3">
              <p class="font-medium text-text">Skala kedalaman</p>
              <p class="text-sm text-text-muted">
                {{ readiness.has_active_depth_scale ? 'Skala aktif tersedia untuk model ground ini.' : 'Skala aktif belum dapat digunakan. Selesaikan prasyarat yang tercantum.' }}
              </p>
            </li>
          </ul>
          <PredictionReadinessIssues :readiness="readiness" />
        </template>
      </section>

      <section v-if="selectedCameraId" class="card space-y-4" aria-labelledby="predictions-history">
        <h2 id="predictions-history" class="text-lg font-semibold text-text">Riwayat job</h2>

        <p v-if="pollingNotice" class="text-sm text-text-muted" role="status">{{ pollingNotice }}</p>
        <div v-if="pollingPaused" class="space-y-2" role="alert">
          <p class="text-sm text-warning">Pemeriksaan otomatis dijeda.</p>
          <div class="flex flex-wrap items-center gap-3">
            <Button variant="outline" class="min-h-11" style="min-height: 44px" @click="retryAllPolling">Periksa Status Lagi</Button>
            <RouterLink to="/dashboard/settings" class="inline-flex min-h-11 items-center text-sm text-brand hover:underline">Buka Pengaturan</RouterLink>
          </div>
        </div>

        <div v-if="jobsLoading" class="loading-state py-6" role="status">
          <div class="spinner" aria-hidden="true" />
          Memuat riwayat...
        </div>
        <div v-else-if="jobsError" class="space-y-2" role="alert">
          <p class="text-sm text-negative">{{ jobsError }}</p>
          <Button variant="outline" class="min-h-11" @click="loadJobs">Muat Ulang</Button>
        </div>
        <div v-else-if="jobs.length === 0" class="empty-state py-8">
          <Brain class="empty-state-icon" aria-hidden="true" />
          <p class="empty-state-title">Belum ada job prediksi</p>
          <p class="empty-state-description">Jalankan prediksi pertama dengan tombol di atas.</p>
        </div>
        <div class="table-container">
          <table class="table jobs-table" aria-label="Riwayat prediksi">
            <thead>
              <tr>
                <th scope="col">Job ID</th>
                <th scope="col" class="hidden sm:table-cell">Waktu</th>
                <th scope="col" class="hidden sm:table-cell">Sumber</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Tindakan</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="job in jobs" :key="job.id">
                <td class="id-cell font-mono">{{ job.id.substring(0, 8) }}…</td>
                <td class="hidden sm:table-cell">{{ formatDateTime(job.created_at) }}</td>
                <td class="hidden sm:table-cell">{{ job.source_type }}</td>
                <td>
                  <span class="badge" :class="statusClass(job)">{{ statusLabel(job) }}</span>
                </td>
                <td>
                  <Button variant="ghost" class="min-h-11" @click="openDetail(job.id)">Detail</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <Dialog v-model:open="submitDialogOpen" content-class="max-w-lg" @update:open="onSubmitOpenChange">
      <DialogHeader>
        <DialogTitle>Jalankan Prediksi Baru</DialogTitle>
        <DialogDescription>Pilih sumber gambar; prasyarat diperiksa ulang sebelum job dikirim.</DialogDescription>
      </DialogHeader>
      <DialogContent>
        <div v-if="dialogCheckError" class="mb-3 space-y-2 rounded-md bg-negative/10 p-3 text-sm text-negative" role="alert">
          <p>{{ dialogCheckError }}</p>
          <Button variant="outline" class="min-h-11" :disabled="dialogChecking" @click="checkDialogReadiness">Coba Lagi</Button>
        </div>
        <PredictionReadinessIssues v-else-if="dialogReadiness" :readiness="dialogReadiness" />
        <p v-if="dialogChecking" class="mb-3 text-sm text-text-muted" role="status">Tunggu pemeriksaan prasyarat selesai.</p>
        <div class="mb-3">
          <label for="pred-source-type" class="text-sm font-medium text-text">Sumber</label>
          <select
            id="pred-source-type"
            v-model="submitSourceType"
            class="input w-full min-h-11"
            :disabled="submitBusy"
            @change="onSourceTypeChange"
          >
            <option value="upload">Unggah gambar</option>
            <option value="rtsp_frame">Frame RTSP saat ini</option>
            <option value="latest_rtsp">Snapshot RTSP terbaru</option>
          </select>
        </div>
        <div class="mb-3">
          <label for="pred-image" class="text-sm font-medium text-text">Gambar (sumber upload)</label>
          <input id="pred-image" type="file" accept="image/*" class="input w-full min-h-11" @change="onFileChange">
        </div>
        <div v-if="submitError" class="mb-3 rounded-md bg-negative/10 p-3 text-sm text-negative" role="alert">{{ submitError }}</div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" class="min-h-11" @click="submitDialogOpen = false">Batal</Button>
        <Button v-if="submitAmbiguous" variant="outline" class="min-h-11" @click="submitDialogOpen = false">Periksa Riwayat</Button>
        <Button variant="primary" class="min-h-11" :disabled="!submitReady" @click="submit">
          {{ submitBusy ? 'Memproses...' : 'Jalankan Prediksi' }}
        </Button>
      </DialogFooter>
    </Dialog>

    <Dialog v-model:open="detailOpen" content-class="max-w-2xl" :show-close-button="false" @update:open="onDetailOpenChange">
      <DialogHeader>
        <DialogTitle>Detail prediksi</DialogTitle>
        <DialogDescription>Status dan hasil job tersimpan.</DialogDescription>
      </DialogHeader>
      <DialogContent>
        <div class="mb-4 flex justify-end">
          <Button variant="outline" class="min-h-11" :disabled="detailLoading" @click="loadDetail(true)">Muat Ulang Detail</Button>
        </div>
        <div v-if="detailLoading" class="loading-state py-6" role="status">
          <div class="spinner" aria-hidden="true" />
          Memuat detail job...
        </div>
        <template v-else-if="detailJob">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <span class="badge" :class="statusClass(detailJob)">{{ statusLabel(detailJob) }}</span>
            <span class="text-xs text-text-muted">Dibuat {{ formatDateTime(detailJob.created_at) }}</span>
          </div>

          <p v-if="detailJob.status === 'failed'" class="mb-4 rounded-md bg-negative/10 p-3 text-sm text-negative" role="alert">
            {{ predictionFailureMessage(detailJob) }}
          </p>
          <p v-else-if="detailJob.status === 'done' && hasVolume" class="mb-4 text-sm text-positive" role="status">
            Job selesai. Tinjau rincian volume dan metode di bawah.
          </p>
          <p v-else-if="detailJob.status === 'done'" class="mb-4 text-sm text-warning" role="status">
            hasil volume belum lengkap
          </p>

          <div v-if="detailPartialError" class="mb-4 space-y-1 rounded-md bg-warning/10 p-3 text-sm" role="alert">
            <p class="font-medium text-text">Sebagian detail tidak dapat dimuat</p>
            <p class="text-text-muted">{{ detailPartialError }}</p>
          </div>

          <PredictionResultSummary :volumes="detailVolumes" />

          <details class="mb-4 border-t border-sheet-border pt-4">
            <summary class="min-h-11 cursor-pointer content-center text-sm font-medium text-brand">Konfigurasi job tersimpan</summary>
            <dl class="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt class="text-text-muted">Job ID</dt><dd class="break-all tabular-nums">{{ detailJob.id }}</dd></div>
              <div><dt class="text-text-muted">Kalibrasi ID</dt><dd class="break-all tabular-nums">{{ detailJob.calibration_id }}</dd></div>
              <div><dt class="text-text-muted">Model ground ID</dt><dd class="break-all tabular-nums">{{ detailJob.ground_model_id }}</dd></div>
              <div><dt class="text-text-muted">Skala kedalaman ID</dt><dd class="break-all tabular-nums">{{ detailJob.depth_scale_id }}</dd></div>
              <div>
                <dt class="text-text-muted">Ambang confidence segmentasi</dt>
                <dd class="tabular-nums">{{ formatConfidence(detailJob.seg_conf) }}</dd>
              </div>
              <div><dt class="text-text-muted">Minimum titik per sel</dt><dd class="tabular-nums">{{ detailJob.volume_min_pts_per_cell }}</dd></div>
              <div v-if="detailJob.source_type !== 'upload'">
                <dt class="text-text-muted">Batas usia frame (detik)</dt><dd class="tabular-nums">{{ detailJob.max_frame_age_sec }}</dd>
              </div>
            </dl>
            <p class="mt-2 text-xs text-text-muted">Confidence segmentasi adalah ambang deteksi, bukan tingkat akurasi volume.</p>
          </details>

          <section v-if="detailInstances.length > 0" class="mb-4" aria-label="Instance terdeteksi">
            <h3 class="mb-2 text-sm font-medium text-text">Instance terdeteksi</h3>
            <div class="table-container">
              <table class="table" aria-label="Instance terdeteksi">
                <thead>
                  <tr>
                    <th scope="col">Kelas</th>
                    <th scope="col" class="numeric">Confidence</th>
                    <th scope="col" class="numeric">Volume (m³)</th>
                    <th scope="col" class="numeric">Footprint (m²)</th>
                    <th scope="col" class="numeric">Tinggi rata (m)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="instance in detailInstances" :key="instance.id">
                    <td>{{ instance.cls_name }}</td>
                    <td class="numeric">{{ formatConfidence(instance.confidence) }}</td>
                    <td class="numeric">{{ formatMeasurement(instance.volume_m3) }}</td>
                    <td class="numeric">{{ formatMeasurement(instance.footprint_m2) }}</td>
                    <td class="numeric">{{ formatMeasurement(instance.height_mean_m) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <dl class="grid grid-cols-1 gap-3 border-t border-sheet-border pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-text-muted">{{ detailJob.source_type === 'upload' ? 'Waktu sumber dari pengunggah' : 'Waktu penerimaan frame oleh worker' }}</dt>
              <dd class="tabular-nums">{{ formatSourceClock(detailJob.source_ts) }}</dd>
            </div>
            <div v-if="detailJob.source_type !== 'upload'">
              <dt class="text-text-muted">Catatan waktu</dt>
              <dd class="text-text-muted">bukan waktu sensor kamera</dd>
            </div>
            <div v-if="detailJob.source_path">
              <dt class="text-text-muted">Sumber</dt>
              <dd class="break-all text-text-muted">{{ detailJob.source_path }}</dd>
            </div>
          </dl>
        </template>
        <div v-else class="py-6 text-sm text-negative" role="alert">{{ detailError }}</div>
        <div class="mt-4 flex justify-end border-t border-sheet-border pt-4">
          <Button variant="outline" class="min-h-11" aria-label="Tutup dialog" @click="onDetailOpenChange(false)">Tutup</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { Brain, KeyRound } from '@lucide/vue'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui'
import PredictionResultSummary from '@/components/PredictionResultSummary.vue'
import PredictionReadinessIssues from '@/components/PredictionReadinessIssues.vue'
import { useApiStore } from '@/stores/api'
import { useToast, globalToast } from '@/composables/useToast'
import { useJobPolling } from '@/composables/useJobPolling'
import { listCameras } from '@/services/cameras'
import {
  listPredictionJobs,
  getPredictionJob,
  submitPrediction,
  getPredictionVolumes,
  getPredictionInstances,
  listPredictionOutputs,
} from '@/services/predictions'
import type { SubmitPredictionPayload } from '@/services/predictions'
import { checkReadiness } from '@/services/readiness'
import { hasPredictionVolume, predictionFailureMessage, isUnfinishedJob } from '@/lib/prediction-job'
import { normalizeApiError } from '@/services/api'
import { formatMeasurement, formatConfidence } from '@/lib/measurement-format'
import type { Camera, PredictionJob, PredictionPrerequisites, PredictionSourceType, VolumeEstimate, DetectedInstance } from '@/types'

const route = useRoute()
const router = useRouter()
const apiStore = useApiStore()
const toast = useToast()

const cameras = ref<Camera[]>([])
const camerasLoading = ref(false)
const selectedCameraId = ref<string>((route.query.camera as string) || '')

const jobs = ref<PredictionJob[]>([])
const jobsLoading = ref(false)
const jobsError = ref('')

const submitDialogOpen = ref(false)
const submitFile = ref<File | null>(null)
const submitBusy = ref(false)
const submitError = ref('')
const submitAmbiguous = ref(false)
const submitSourceType = ref<PredictionSourceType>('upload')
const dialogReadiness = ref<PredictionPrerequisites | null>(null)
const dialogChecking = ref(false)
const dialogCheckError = ref('')
let dialogRequestId = 0

const readiness = ref<PredictionPrerequisites | null>(null)
const readinessLoading = ref(false)
const readinessError = ref('')
let readinessRequestId = 0

const detailOpen = ref(false)
const detailJobId = ref<string>((route.query.job as string) || '')
const detailJob = ref<PredictionJob | null>(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailPartialError = ref('')
const detailVolumes = ref<VolumeEstimate[]>([])
const detailInstances = ref<DetectedInstance[]>([])

const { startPolling, retryPolling, stopPolling, getPollingStatus } = useJobPolling(getPredictionJob, (updated) => {
  const index = jobs.value.findIndex(item => item.id === updated.id)
  if (index >= 0) jobs.value[index] = updated
  if (detailJobId.value === updated.id) detailJob.value = updated
  if (updated.status === 'done' && detailJobId.value !== updated.id) {
    toast.success('Prediksi selesai', { description: `Job ID: ${updated.id}` })
  }
})

const pollingNotice = computed(() => {
  const states = jobs.value.map(job => getPollingStatus(job.camera_id, job.id)).filter(Boolean)
  if (states.some(state => state?.error && (state.error.status === 401 || state.error.status === 403))) return ''
  if (states.some(state => state?.error)) return 'Pemeriksaan akan dicoba lagi otomatis.'
  return ''
})
const pollingPaused = computed(() =>
  jobs.value.some(job => {
    const state = getPollingStatus(job.camera_id, job.id)
    return Boolean(state?.error && (state.error.status === 401 || state.error.status === 403))
  }),
)

const hasVolume = computed(() => (detailJob.value ? hasPredictionVolume(detailJob.value) : false))

const submitReady = computed(() => {
  if (!selectedCameraId.value || submitBusy.value || submitAmbiguous.value || dialogChecking.value) return false
  if (dialogCheckError.value) return false
  if (!dialogReadiness.value?.ready) return false
  if (submitSourceType.value === 'upload' && !submitFile.value) return false
  return true
})

async function fetchReadiness(cameraId: string) {
  if (!cameraId) return
  const requestId = ++readinessRequestId
  readinessLoading.value = true
  readinessError.value = ''
  readiness.value = null
  try {
    const result = await checkReadiness(cameraId, 'upload')
    if (requestId !== readinessRequestId || cameraId !== selectedCameraId.value) return
    readiness.value = result
  } catch (error) {
    if (requestId !== readinessRequestId || cameraId !== selectedCameraId.value) return
    readinessError.value = normalizeApiError(error).message
  } finally {
    if (requestId === readinessRequestId && cameraId === selectedCameraId.value) readinessLoading.value = false
  }
}

async function checkDialogReadiness() {
  if (!selectedCameraId.value) return
  const requestId = ++dialogRequestId
  dialogChecking.value = true
  dialogCheckError.value = ''
  try {
    const result = await checkReadiness(selectedCameraId.value, submitSourceType.value)
    if (requestId !== dialogRequestId || !submitDialogOpen.value) return
    dialogReadiness.value = result
  } catch (error) {
    if (requestId !== dialogRequestId || !submitDialogOpen.value) return
    dialogCheckError.value = normalizeApiError(error).message
  } finally {
    if (requestId === dialogRequestId) dialogChecking.value = false
  }
}

function onSubmitOpenChange(open: boolean) {
  submitDialogOpen.value = open
}

function openSubmitDialog() {
  submitError.value = ''
  submitAmbiguous.value = false
  submitDialogOpen.value = true
}

watch(submitDialogOpen, (open) => {
  if (open) void checkDialogReadiness()
})

function onSourceTypeChange() {
  void checkDialogReadiness()
}

function statusLabel(job: PredictionJob): string {
  const state = getPollingStatus(job.camera_id, job.id)
  const status = state?.status ?? job.status
  if (status === 'pending') return 'Menunggu'
  if (status === 'processing') return 'Memproses'
  if (status === 'failed') return 'Gagal'
  return hasPredictionVolume({ ...job, status }) ? 'Selesai' : 'Hasil parsial'
}

function statusClass(job: PredictionJob): string {
  const label = statusLabel(job)
  if (label === 'Selesai') return 'badge-success'
  if (label === 'Gagal') return 'badge-negative'
  if (label === 'Hasil parsial') return 'badge-warning'
  return 'badge-warning'
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('id-ID')
}

function formatSourceClock(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Tidak tersedia'
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getUTCHours())}.${pad(date.getUTCMinutes())}.${pad(date.getUTCSeconds())} UTC`
}

async function loadCameras() {
  camerasLoading.value = true
  try {
    const result = await listCameras(1, 100)
    cameras.value = result.items
    if (!selectedCameraId.value && result.items.length > 0) {
      selectedCameraId.value = result.items[0]!.id
    }
  } catch (error) {
    jobsError.value = normalizeApiError(error).message
  } finally {
    camerasLoading.value = false
  }
}

async function loadJobs() {
  if (!selectedCameraId.value) return
  jobsLoading.value = true
  jobsError.value = ''
  try {
    const result = await listPredictionJobs(selectedCameraId.value, 1, 50)
    jobs.value = result.items
    for (const job of result.items) {
      if (isUnfinishedJob(job.status)) startPolling(job.camera_id, job.id, job.status)
    }
  } catch (error) {
    jobsError.value = normalizeApiError(error).message
  } finally {
    jobsLoading.value = false
  }
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  submitFile.value = target.files?.[0] ?? null
}

async function submit() {
  if (!selectedCameraId.value || !submitReady.value) return
  submitBusy.value = true
  submitError.value = ''
  submitAmbiguous.value = false
  try {
    await checkDialogReadiness()
    if (!submitDialogOpen.value) return
    if (dialogCheckError.value || !dialogReadiness.value?.ready) return
    const payload: SubmitPredictionPayload = { source_type: submitSourceType.value }
    if (submitSourceType.value === 'upload' && submitFile.value) payload.file = submitFile.value
    const result = await submitPrediction(selectedCameraId.value, payload)
    submitDialogOpen.value = false
    submitFile.value = null
    router.replace({ path: '/dashboard/predictions', query: { camera: selectedCameraId.value, tracking: result.job_id } })
    toast.success('Prediksi berhasil dikirim', { description: `Job ID: ${result.job_id}` })
    toast.info('Job diterima backend', { description: `Job ID: ${result.job_id}` })
    await loadJobs()
    startPolling(selectedCameraId.value, result.job_id, result.status)
  } catch (error) {
    const apiError = normalizeApiError(error)
    submitAmbiguous.value = true
    submitError.value = `Job mungkin sudah tersimpan di backend. Periksa riwayat sebelum mengirim ulang. (${apiError.message})`
    await loadJobs()
  } finally {
    submitBusy.value = false
  }
}

async function openDetail(jobId: string) {
  detailJobId.value = jobId
  detailOpen.value = true
  router.replace({ path: '/dashboard/predictions', query: { camera: selectedCameraId.value, job: jobId } })
  await loadDetail(false)
}

function onDetailOpenChange(open: boolean) {
  detailOpen.value = open
  if (!open) {
    detailJobId.value = ''
    detailJob.value = null
    router.replace({ path: '/dashboard/predictions', query: { camera: selectedCameraId.value || undefined } })
  }
}

async function loadDetail(manual: boolean) {
  if (!selectedCameraId.value || !detailJobId.value) return
  detailLoading.value = true
  detailError.value = ''
  if (manual) detailPartialError.value = ''
  try {
    const job = await getPredictionJob(selectedCameraId.value, detailJobId.value)
    if (detailJobId.value !== job.id || !detailOpen.value) return
    detailJob.value = job
    const listIndex = jobs.value.findIndex(item => item.id === job.id)
    if (listIndex >= 0) jobs.value[listIndex] = job
    if (isUnfinishedJob(job.status)) startPolling(job.camera_id, job.id, job.status)
    const [volumes, instances, outputs] = await Promise.all([
      getPredictionVolumes(selectedCameraId.value, job.id).catch((error: unknown) => {
        const apiError = normalizeApiError(error)
        detailPartialError.value = apiError.status === 403 || apiError.status === 401
          ? 'Periksa izin predict:read bersama administrator'
          : apiError.message
        return [] as VolumeEstimate[]
      }),
      getPredictionInstances(selectedCameraId.value, job.id).catch(() => [] as DetectedInstance[]),
      listPredictionOutputs(selectedCameraId.value, job.id).catch(() => ({ outputs: [] })),
    ])
    if (detailJobId.value !== job.id || !detailOpen.value) return
    detailVolumes.value = volumes
    detailInstances.value = instances
    void outputs
  } catch (error) {
    if (detailOpen.value) detailError.value = normalizeApiError(error).message
  } finally {
    if (detailOpen.value) detailLoading.value = false
  }
}

function retryAllPolling() {
  for (const job of jobs.value) {
    if (isUnfinishedJob(getPollingStatus(job.camera_id, job.id)?.status ?? job.status)) {
      retryPolling(job.camera_id, job.id)
    }
  }
}

watch(selectedCameraId, (cameraId, previous) => {
  if (!cameraId || cameraId === previous) return
  stopPolling()
  globalToast.dismiss()
  detailOpen.value = false
  detailJobId.value = ''
  detailJob.value = null
  router.replace({ path: '/dashboard/predictions', query: { camera: cameraId } })
  void loadJobs()
  void fetchReadiness(cameraId)
})

onMounted(async () => {
  await loadCameras()
  if (selectedCameraId.value) {
    await loadJobs()
    void fetchReadiness(selectedCameraId.value)
    if (route.query.tracking) {
      toast.info('Job diterima backend', { description: `Job ID: ${route.query.tracking}` })
    }
    if (detailJobId.value) {
      detailOpen.value = true
      await loadDetail(false)
    }
  }
})
</script>

<style scoped>
@media (max-width: 639px) {
  .jobs-table th,
  .jobs-table td {
    padding: 8px;
  }
}
</style>
