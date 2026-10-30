<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold text-text">Ringkasan</h1>
      <p class="mt-1 text-text-muted">Kesiapan konfigurasi kamera dan tren estimasi volume per analisis.</p>
    </header>

    <div v-if="!hasApiKey" class="card border-warning-border bg-warning-bg/50">
      <div class="flex items-start gap-3">
        <AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="font-medium text-text">API Key belum diatur</p>
          <p class="mt-1 text-sm text-text-muted">
            Ringkasan memerlukan akses API. Atur API key untuk memuat kamera, kalibrasi, dan job prediksi.
            <RouterLink to="/dashboard/settings" class="inline-flex min-h-11 items-center text-brand underline">Buka Pengaturan</RouterLink>
          </p>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-state" role="status" aria-label="Memuat ringkasan">
      <div class="spinner" aria-hidden="true" />
      Memuat data ringkasan...
    </div>

    <div v-else-if="loadError" class="error-state" role="alert">
      <AlertCircle class="h-6 w-6" aria-hidden="true" />
      <p class="error-state-title">Gagal memuat ringkasan</p>
      <p class="error-state-description">{{ loadError }}</p>
      <Button variant="outline" @click="fetchAll">Coba Lagi</Button>
      <RouterLink to="/dashboard/settings" class="inline-flex min-h-11 items-center text-brand underline">Buka Pengaturan</RouterLink>
    </div>

    <template v-else>
      <MeasurementNextStep v-if="cameras.length > 0"
        :camera-id="selectedCameraId" :camera-name="selectedCamera?.name ?? ''"
        :readiness="readiness" :loading="readinessLoading" :error="readinessError"
        @retry="fetchReadiness(selectedCameraId)">
        <template #camera>
          <div class="w-full min-w-0 sm:w-72">
            <label for="overview-camera" class="label">Pilih kamera</label>
            <select id="overview-camera" class="input min-h-11 w-full"
              :value="selectedCameraId" @change="onCameraChange(($event.target as HTMLSelectElement).value)">
              <option value="" disabled>Pilih kamera</option>
              <option v-for="camera in cameras" :key="camera.id" :value="camera.id">
                {{ camera.name }} ({{ camera.resolution_w }}×{{ camera.resolution_h }})
              </option>
            </select>
          </div>
        </template>
      </MeasurementNextStep>

      <section v-if="cameras.length > 0" aria-label="Metrik utama">
        <p v-if="statsLoading" class="text-sm text-text-muted" role="status">Memuat metrik kamera...</p>
        <dl v-else class="card grid grid-cols-2 gap-px overflow-hidden bg-sheet-border p-0 lg:grid-cols-4">
          <div class="bg-sheet p-4 sm:p-5">
            <dt class="text-sm text-text-muted">Total Kamera</dt>
            <dd class="kpi-value mt-1">{{ stats.totalCameras }}</dd>
            <p class="mt-2 text-xs text-text-muted">{{ stats.camerasWithCalibration === null ? 'Kalibrasi belum dapat dimuat' : `${stats.camerasWithCalibration} dengan kalibrasi aktif` }}</p>
          </div>
          <div class="bg-sheet p-4 sm:p-5">
            <dt class="text-sm text-text-muted">Kalibrasi Aktif</dt>
            <dd class="kpi-value mt-1">{{ stats.activeCalibrations ?? '-' }}</dd>
            <p class="mt-2 text-xs text-text-muted">
              {{ stats.totalCalibrations === null ? 'Belum dapat dimuat' : stats.totalCalibrations > 0 ? `${stats.totalCalibrations} total versi` : 'Belum ada kalibrasi' }}
            </p>
          </div>
          <div class="bg-sheet p-4 sm:p-5">
            <dt class="text-sm text-text-muted">Referensi Tanah</dt>
            <dd class="kpi-value mt-1">{{ stats.activeGroundReferences ?? '-' }}</dd>
            <p class="mt-2 text-xs text-text-muted">
              {{ stats.totalGroundReferences === null ? 'Belum dapat dimuat' : stats.totalGroundReferences > 0 ? `${stats.totalGroundReferences} total referensi` : 'Belum ada referensi tanah' }}
            </p>
          </div>
          <div class="bg-sheet p-4 sm:p-5">
            <dt class="text-sm text-text-muted">Analisis Selesai</dt>
            <dd class="kpi-value mt-1">{{ stats.completedJobs ?? '-' }}</dd>
            <p class="mt-2 text-xs text-text-muted">{{ stats.totalJobs === null ? 'Total job belum dapat dimuat' : `Dari ${stats.totalJobs} total job` }}</p>
          </div>
        </dl>
        <p v-if="statsIncomplete" class="mt-2 text-sm text-warning" role="status">
          Metrik dari {{ statsFailureCount }} kamera tidak dapat dimuat sepenuhnya. Angka di atas hanya mencakup data yang berhasil dibaca.
        </p>
      </section>

      <details v-if="cameras.length > 0" class="card">
          <summary class="min-h-11 cursor-pointer content-center font-semibold text-text">Detail kamera dan prasyarat</summary>

          <div v-if="selectedCamera" class="mt-5 space-y-4">
            <dl class="grid gap-3 sm:grid-cols-3">
              <div class="rounded-md bg-frame p-3">
                <dt class="text-text-muted">Resolusi</dt>
                <dd class="font-mono text-text">{{ selectedCamera.resolution_w }}×{{ selectedCamera.resolution_h }}</dd>
              </div>
              <div class="rounded-md bg-frame p-3">
                <dt class="text-text-muted">FPS</dt>
                <dd class="font-mono text-text">{{ selectedCamera.fps }}</dd>
              </div>
              <div class="rounded-md bg-frame p-3">
                <dt class="text-text-muted">Konfigurasi stream</dt>
                <dd class="text-text">{{ selectedCamera.stream_enabled ? 'Diaktifkan' : 'Dinonaktifkan' }}</dd>
              </div>
            </dl>
            <p v-if="cameraDetailError" class="text-sm text-negative" role="alert">{{ cameraDetailError }} Metadata di atas masih mengikuti daftar kamera.</p>
            <div class="text-sm text-text-muted">
              <p>Status online dan usia frame diperiksa di Manajemen Kamera.</p>
              <RouterLink :to="{ path: '/dashboard/cameras', query: { camera: selectedCamera.id } }" class="inline-flex min-h-11 items-center text-brand underline">Periksa Kamera dan Stream</RouterLink>
            </div>

            <div class="border-t border-sheet-border pt-4">
              <h3 class="font-semibold text-text">Kesiapan konfigurasi</h3>

              <div v-if="readinessLoading" class="loading-state py-4" role="status">
                <div class="spinner" aria-hidden="true" />
                Memeriksa prasyarat...
              </div>

              <p v-else-if="readinessError" class="mt-3 text-sm text-text-muted">Pemeriksaan belum berhasil. Gunakan pemulihan pada Langkah berikutnya.</p>

              <ul v-else-if="readiness" class="mt-3 space-y-2">
                <li class="flex flex-col gap-2 rounded-md border border-sheet-border p-3 sm:flex-row sm:items-center">
                  <CheckCircle v-if="readiness.has_active_calibration" class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
                  <XCircle v-else class="h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-text">Kalibrasi aktif</p>
                    <p class="text-sm text-text-muted">
                      {{ readiness.has_active_calibration ? 'Kalibrasi aktif tersedia; lihat persyaratan sumber di Analisis.' : 'Kalibrasi aktif belum tersedia atau tidak sesuai kamera.' }}
                    </p>
                  </div>
                  <RouterLink
                    :to="{ path: '/dashboard/calibrations', query: { camera: selectedCamera.id } }"
                    class="btn btn-ghost btn-sm min-h-11 shrink-0"
                  >
                    Kelola
                  </RouterLink>
                </li>

                <li class="flex flex-col gap-2 rounded-md border border-sheet-border p-3 sm:flex-row sm:items-center">
                  <CheckCircle v-if="readiness.has_active_ground_model" class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
                  <XCircle v-else class="h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-text">Model ground aktif</p>
                    <p class="text-sm text-text-muted">
                      {{ readiness.has_active_ground_model ? 'Model cocok dengan kalibrasi dan referensi tanah aktif.' : 'Model ground belum tersedia atau tidak cocok dengan konfigurasi aktif.' }}
                    </p>
                  </div>
                  <RouterLink
                    :to="{ path: '/dashboard/ground-references', query: { camera: selectedCamera.id } }"
                    class="btn btn-ghost btn-sm min-h-11 shrink-0"
                  >
                    Kelola
                  </RouterLink>
                </li>

                <li class="flex flex-col gap-2 rounded-md border border-sheet-border p-3 sm:flex-row sm:items-center">
                  <CheckCircle v-if="readiness.has_active_depth_scale" class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
                  <XCircle v-else class="h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-text">Skala kedalaman</p>
                    <p class="text-sm text-text-muted">
                      {{ readiness.has_active_depth_scale ? 'Skala aktif tersedia untuk model ground ini.' : 'Skala aktif belum dapat digunakan. Selesaikan prasyarat yang tercantum.' }}
                    </p>
                  </div>
                  <RouterLink :to="{ path: '/dashboard/depth-scales', query: { camera: selectedCamera.id } }" class="btn btn-ghost btn-sm min-h-11 shrink-0">
                    Kelola
                  </RouterLink>
                </li>
              </ul>

            </div>
          </div>

          <div v-else class="empty-state py-8">
            <Video class="empty-state-icon" aria-hidden="true" />
            <p class="empty-state-title">Belum ada kamera terpilih</p>
            <p class="empty-state-description">Pilih kamera dari dropdown untuk melihat status kesiapan konfigurasi.</p>
          </div>
      </details>

      <section v-if="selectedCameraId" class="card">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-text">Estimasi volume per analisis</h2>
            <p class="mt-1 text-sm text-text-muted">
              {{ selectedCamera?.name || 'Kamera terpilih' }}.
              <span v-if="chartData.length > 0">
                Menampilkan {{ methodRows.length }} analisis {{ methodLabel }} terbaru dari {{ chartJobsLoaded }} job selesai yang diperiksa.
              </span>
              <span v-else>Memeriksa hingga {{ maxChartPoints }} job selesai terbaru.</span>
            </p>
            <p v-if="chartCoverageNote" class="mt-1 text-xs text-warning" role="status">
              {{ chartCoverageNote }}
            </p>
          </div>

          <div v-if="chartData.length > 0" class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="flex items-center gap-2">
              <label for="chart-method" class="text-sm text-text-muted">Metode</label>
              <select id="chart-method" v-model="selectedMethod" class="input input-sm w-auto">
                <option value="grid">Grid/Voxel</option>
                <option value="convex_hull">Convex Hull</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <label for="chart-unit" class="text-sm text-text-muted">Satuan</label>
              <select id="chart-unit" v-model="chartUnit" class="input input-sm w-auto">
                <option value="m3">m³</option>
                <option value="liter">L</option>
              </select>
            </div>
          </div>
        </div>

        <VolumeChart
          class="mt-4"
          :data="chartData"
          :selected-method="selectedMethod"
          :unit="chartUnit"
          :camera-name="selectedCamera?.name ?? ''"
          :max-points="maxChartPoints"
          :loading="chartLoading"
          :error="chartError ?? ''"
          @retry="fetchChartData"
        />

        <details v-if="methodRows.length > 0" class="mt-4">
          <summary class="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand hover:underline">
            Tampilkan tabel data ({{ methodRows.length }} baris)
          </summary>
          <div class="mt-3 table-container">
            <table class="table" aria-label="Data estimasi volume per job">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Waktu</th>
                  <th scope="col" class="numeric">Volume (m³)</th>
                  <th scope="col" class="numeric">Volume (L)</th>
                  <th scope="col" class="numeric">Footprint (m²)</th>
                  <th scope="col" class="numeric">Tinggi rata (m)</th>
                  <th scope="col">Metode</th>
                  <th scope="col"><span class="sr-only">Tindakan</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in methodRows" :key="`${item.jobId}-${item.method}`">
                  <td class="id-cell">{{ item.jobId.substring(0, 8) }}…</td>
                  <td>{{ formatDateTime(item.createdAt) }}</td>
                  <td class="numeric">{{ formatNumber(item.volumeM3, 3) }}</td>
                  <td class="numeric">{{ formatNumber(item.volumeLiter, 0) }}</td>
                  <td class="numeric">{{ formatNullable(item.footprint_m2, 2) }}</td>
                  <td class="numeric">{{ formatNullable(item.height_mean_m, 2) }}</td>
                  <td>{{ volumeMethodLabel(item.method) }}</td>
                  <td>
                    <RouterLink
                      :to="{ path: '/dashboard/predictions', query: { camera: selectedCameraId, job: item.jobId } }"
                      class="inline-flex min-h-11 items-center text-sm text-brand hover:underline"
                    >
                      Detail
                    </RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div v-if="cameras.length === 0" class="card empty-state py-12">
        <Video class="empty-state-icon" aria-hidden="true" />
        <p class="empty-state-title">Belum ada kamera terdaftar</p>
        <p class="empty-state-description">Tambahkan kamera pertama untuk memulai monitoring dan analisis volume.</p>
        <RouterLink to="/dashboard/cameras" class="btn btn-primary empty-state-action">
          <Video class="h-4 w-4" aria-hidden="true" />
          Tambah Kamera
        </RouterLink>
      </div>

      <section v-if="cameras.length > 0 && (!selectedCameraId || chartData.length === 0)" class="card" aria-labelledby="overview-recent-jobs">
        <div class="flex flex-col gap-1">
          <h2 id="overview-recent-jobs" class="text-lg font-semibold text-text">Job prediksi terbaru</h2>
          <p v-if="cameras.length > 5" class="text-sm text-text-muted">
            Dimuat dari 5 kamera pertama. Buka halaman Analisis Sampah untuk riwayat per kamera.
          </p>
        </div>

        <div v-if="recentJobsLoading" class="loading-state py-6" role="status">
          <div class="spinner" aria-hidden="true" />
          Memuat job terbaru...
        </div>

        <div v-else-if="recentJobs.length === 0 && recentJobsIncomplete" class="mt-4 space-y-3" role="alert">
          <p class="font-medium text-text">Riwayat belum dapat dimuat</p>
          <p class="text-sm text-negative">{{ recentJobsError }}</p>
          <Button variant="outline" class="min-h-11" @click="fetchRecentJobs">Muat Ulang Riwayat</Button>
        </div>
        <div v-else-if="recentJobs.length === 0" class="empty-state py-8">
          <Brain class="empty-state-icon" aria-hidden="true" />
          <p class="empty-state-title">Belum ada job prediksi</p>
          <p class="empty-state-description">Jalankan prediksi pertama dari halaman Analisis Sampah.</p>
        </div>

        <div v-else class="mt-4 space-y-2">
          <div
            v-for="job in recentJobs"
            :key="job.id"
            class="flex flex-col gap-2 rounded-md bg-frame p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <p class="truncate font-mono text-sm text-text">{{ job.id.substring(0, 8) }}…</p>
              <p class="text-xs text-text-muted">{{ formatDateTime(job.created_at) }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <span class="badge" :class="getJobStatusClass(job.status)">{{ formatJobStatus(job.status) }}</span>
              <RouterLink
                :to="{ path: '/dashboard/predictions', query: { camera: job.camera_id, job: job.id } }"
                class="inline-flex min-h-11 items-center text-sm text-brand hover:underline"
              >
                Detail
              </RouterLink>
            </div>
          </div>
        </div>

        <div v-if="recentJobsIncomplete && recentJobs.length > 0" class="mt-2 space-y-2" role="status">
          <p class="text-sm text-warning">Sebagian job terbaru tidak dapat dimuat. {{ recentJobsError }}</p>
          <Button variant="outline" class="min-h-11" @click="fetchRecentJobs">Muat Ulang Riwayat</Button>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApiStore } from '@/stores/api'
import { useToast } from '@/composables/useToast'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { listCameras, getCamera } from '@/services/cameras'
import { listCalibrations } from '@/services/calibrations'
import { listGroundReferences } from '@/services/groundReferences'
import { listPredictionJobs, checkPredictionPrerequisites, getPredictionVolumes } from '@/services/predictions'
import type { Camera, PredictionJob, VolumeEstimate } from '@/types'
import type { PredictionPrerequisites } from '@/services/predictions'
import VolumeChart from '@/components/dashboard/VolumeChart.vue'
import MeasurementNextStep from '@/components/dashboard/MeasurementNextStep.vue'
import Button from '@/components/ui/Button.vue'
import { RouterLink } from 'vue-router'
import { AlertCircle, Brain, CheckCircle, Video, XCircle } from '@lucide/vue'

interface ChartPoint {
  jobId: string
  createdAt: string
  method: string
  volumeM3: number
  volumeLiter: number
  footprint_m2: number | null
  height_mean_m: number | null
}

const route = useRoute()
const router = useRouter()
const apiStore = useApiStore()
const toast = useToast()
const { isActive, getApiKey } = useConnectionScope()

const loading = ref(true)
const loadError = ref<string | null>(null)
const cameras = ref<Camera[]>([])
const selectedCameraId = ref('')
const selectedCamera = ref<Camera | null>(null)
const cameraDetailError = ref('')
let cameraDetailRequestId = 0

const emptyStats = () => ({
  totalCameras: 0,
  camerasWithCalibration: null as number | null,
  activeCalibrations: null as number | null,
  totalCalibrations: null as number | null,
  activeGroundReferences: null as number | null,
  totalGroundReferences: null as number | null,
  completedJobs: null as number | null,
  totalJobs: null as number | null,
})

const stats = ref(emptyStats())
const statsLoading = ref(false)
const statsIncomplete = ref(false)
const statsFailureCount = ref(0)

const readiness = ref<PredictionPrerequisites | null>(null)
const readinessLoading = ref(false)
const readinessError = ref<string | null>(null)
let readinessRequestId = 0

const chartData = ref<ChartPoint[]>([])
const chartLoading = ref(false)
const chartError = ref<string | null>(null)
const chartJobsLoaded = ref(0)
const chartVolumeFailures = ref(0)
const chartJobsWithoutVolumes = ref(0)
const selectedMethod = ref<'grid' | 'convex_hull'>('grid')
const chartUnit = ref<'m3' | 'liter'>('m3')
const maxChartPoints = 20
let chartRequestId = 0

const recentJobs = ref<PredictionJob[]>([])
const recentJobsLoading = ref(false)
const recentJobsIncomplete = ref(false)
const recentJobsError = ref('')

const hasApiKey = computed(() => apiStore.hasApiKey)

const methodRows = computed(() =>
  chartData.value
    .filter(point => point.method === selectedMethod.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
)

const methodLabel = computed(() => selectedMethod.value === 'grid' ? 'Grid/Voxel' : 'Convex Hull')

const chartCoverageNote = computed(() => {
  const notes: string[] = []
  if (chartVolumeFailures.value > 0) {
    notes.push(`${chartVolumeFailures.value} job gagal dimuat volumenya`)
  }
  if (chartJobsWithoutVolumes.value > 0) {
    notes.push(`${chartJobsWithoutVolumes.value} job selesai tidak mengembalikan volume`)
  }
  if (chartData.value.length > 0 && methodRows.value.length === 0) {
    notes.push(`Metode ${methodLabel.value} tidak tersedia pada job terbaru`)
  }
  return notes.length > 0 ? notes.join('. ') + '.' : ''
})

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Permintaan gagal. Coba kembali.'
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNumber(value: number, digits: number): string {
  return value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatNullable(value: number | null, digits: number): string {
  return value === null || value === undefined ? '-' : formatNumber(value, digits)
}

function volumeMethodLabel(method: string): string {
  if (method === 'grid') return 'Grid/Voxel'
  if (method === 'convex_hull') return 'Convex Hull'
  return method
}

function formatJobStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    processing: 'Memproses',
    done: 'Selesai',
    failed: 'Gagal',
  }
  return labels[status] || status
}

function getJobStatusClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'badge-warning',
    processing: 'bg-brand-light text-brand',
    done: 'badge-positive',
    failed: 'badge-negative',
  }
  return classes[status] || 'badge-neutral'
}

async function fetchCameras() {
  const first = await listCameras(1, 100)
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await listCameras(page, 100)
    items.push(...next.items)
  }
  if (!isActive()) return

  cameras.value = items
  stats.value.totalCameras = first.total

  const queryCamera = typeof route.query.camera === 'string' ? route.query.camera : ''
  const current = items.find(camera => camera.id === selectedCameraId.value)
  const fromQuery = items.find(camera => camera.id === queryCamera)
  selectedCameraId.value = current?.id ?? fromQuery?.id ?? items[0]?.id ?? ''
}

async function fetchCameraDetails(cameraId: string) {
  const requestId = ++cameraDetailRequestId
  cameraDetailError.value = ''
  try {
    const camera = await getCamera(cameraId)
    if (!isActive() || requestId !== cameraDetailRequestId || cameraId !== selectedCameraId.value) return
    selectedCamera.value = camera
  } catch (error) {
    if (!isActive() || requestId !== cameraDetailRequestId || cameraId !== selectedCameraId.value) return
    cameraDetailError.value = errorMessage(error)
  }
}

async function fetchReadiness(cameraId: string) {
  const requestId = ++readinessRequestId
  readinessLoading.value = true
  readiness.value = null
  readinessError.value = null
  try {
    const result = await checkPredictionPrerequisites(cameraId)
    if (!isActive() || requestId !== readinessRequestId || cameraId !== selectedCameraId.value) return
    readiness.value = result
  } catch (error: unknown) {
    if (!isActive() || requestId !== readinessRequestId || cameraId !== selectedCameraId.value) return
    readinessError.value = errorMessage(error)
  } finally {
    if (isActive() && requestId === readinessRequestId && cameraId === selectedCameraId.value) {
      readinessLoading.value = false
    }
  }
}

async function fetchStats() {
  statsLoading.value = true
  const next = emptyStats()
  next.totalCameras = cameras.value.length
  let failures = 0

  for (const camera of cameras.value) {
    if (!isActive()) return

    const [calibrations, groundReferences, allJobs, doneJobs] = await Promise.allSettled([
      listCalibrations(camera.id),
      listGroundReferences(camera.id),
      listPredictionJobs(camera.id, 1, 1),
      listPredictionJobs(camera.id, 1, 1, 'done'),
    ])
    if (!isActive()) return

    let cameraFailed = false

    if (calibrations.status === 'fulfilled') {
      next.totalCalibrations = (next.totalCalibrations ?? 0) + calibrations.value.total
      const active = calibrations.value.items.filter(item => item.is_active)
      next.activeCalibrations = (next.activeCalibrations ?? 0) + active.length
      next.camerasWithCalibration = (next.camerasWithCalibration ?? 0) + Number(active.length > 0)
    } else {
      cameraFailed = true
    }

    if (groundReferences.status === 'fulfilled') {
      next.totalGroundReferences = (next.totalGroundReferences ?? 0) + groundReferences.value.total
      next.activeGroundReferences = (next.activeGroundReferences ?? 0) + groundReferences.value.items.filter(item => item.is_active).length
    } else {
      cameraFailed = true
    }

    if (allJobs.status === 'fulfilled') {
      next.totalJobs = (next.totalJobs ?? 0) + allJobs.value.total
    } else {
      cameraFailed = true
    }

    if (doneJobs.status === 'fulfilled') {
      next.completedJobs = (next.completedJobs ?? 0) + doneJobs.value.total
    } else {
      cameraFailed = true
    }

    if (cameraFailed) failures += 1
  }

  if (!isActive()) return
  stats.value = next
  statsFailureCount.value = failures
  statsIncomplete.value = failures > 0
  statsLoading.value = false
}

async function fetchChartData() {
  const requestId = ++chartRequestId
  const cameraId = selectedCameraId.value

  chartData.value = []
  chartJobsLoaded.value = 0
  chartVolumeFailures.value = 0
  chartJobsWithoutVolumes.value = 0
  chartError.value = null

  if (!cameraId) {
    chartLoading.value = false
    return
  }

  chartLoading.value = true
  try {
    const jobsPage = await listPredictionJobs(cameraId, 1, maxChartPoints, 'done')
    if (!isActive() || requestId !== chartRequestId || cameraId !== selectedCameraId.value) return

    const jobs = jobsPage.items
    chartJobsLoaded.value = jobs.length

    const results = await Promise.allSettled(
      jobs.map(async job => ({
        job,
        volumes: await getPredictionVolumes(cameraId, job.id),
      })),
    )
    if (!isActive() || requestId !== chartRequestId || cameraId !== selectedCameraId.value) return

    const points: ChartPoint[] = []
    let failures = 0
    let withoutVolumes = 0

    for (const result of results) {
      if (result.status === 'rejected') {
        failures += 1
        continue
      }
      const { job, volumes } = result.value
      if (volumes.length === 0) {
        withoutVolumes += 1
        continue
      }
      points.push(...volumes.map((volume: VolumeEstimate) => ({
        jobId: job.id,
        createdAt: job.created_at,
        method: volume.method,
        volumeM3: volume.volume_m3,
        volumeLiter: volume.volume_liter,
        footprint_m2: volume.footprint_m2,
        height_mean_m: volume.height_mean_m,
      })))
    }

    points.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    chartData.value = points
    chartVolumeFailures.value = failures
    chartJobsWithoutVolumes.value = withoutVolumes
  } catch (error: unknown) {
    if (!isActive() || requestId !== chartRequestId || cameraId !== selectedCameraId.value) return
    chartError.value = errorMessage(error)
  } finally {
    if (isActive() && requestId === chartRequestId) {
      chartLoading.value = false
    }
  }
}

async function fetchRecentJobs() {
  if (recentJobsLoading.value) return
  recentJobsLoading.value = true
  recentJobsIncomplete.value = false
  recentJobsError.value = ''
  const allJobs: PredictionJob[] = []
  let failures = 0

  for (const camera of cameras.value.slice(0, 5)) {
    if (!isActive()) return
    try {
      const response = await listPredictionJobs(camera.id, 1, 3)
      allJobs.push(...response.items.map(job => ({ ...job, camera_id: camera.id })))
    } catch (error) {
      failures += 1
      if (isActive()) recentJobsError.value = errorMessage(error)
    }
  }

  if (!isActive()) return
  allJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  recentJobs.value = allJobs.slice(0, 10)
  recentJobsIncomplete.value = failures > 0
  recentJobsLoading.value = false
}

async function fetchAll() {
  if (!hasApiKey.value) {
    loading.value = false
    return
  }

  loading.value = true
  loadError.value = null
  statsIncomplete.value = false
  statsFailureCount.value = 0

  try {
    await fetchCameras()
    if (!isActive()) return

    if (selectedCameraId.value) {
      const cameraId = selectedCameraId.value
      selectedCamera.value = cameras.value.find(camera => camera.id === cameraId) ?? null
      loading.value = false
      await Promise.all([
        fetchCameraDetails(cameraId),
        fetchReadiness(cameraId),
        fetchChartData(),
        fetchStats(),
        fetchRecentJobs(),
      ])
    }
  } catch (error: unknown) {
    if (!isActive()) return
    loadError.value = errorMessage(error)
    toast.error('Gagal memuat ringkasan dashboard')
    cameras.value = []
    selectedCameraId.value = ''
    selectedCamera.value = null
    stats.value = emptyStats()
    chartLoading.value = false
  } finally {
    if (isActive()) loading.value = false
  }
}

async function onCameraChange(cameraId: string) {
  if (!cameraId || cameraId === selectedCameraId.value) return

  selectedCameraId.value = cameraId
  void router.replace({ query: { ...route.query, camera: cameraId } })
  selectedCamera.value = cameras.value.find(camera => camera.id === cameraId) ?? null
  readiness.value = null
  readinessError.value = null
  chartData.value = []
  chartError.value = null
  chartLoading.value = false

  await Promise.all([
    fetchCameraDetails(cameraId),
    fetchReadiness(cameraId),
    fetchChartData(),
  ])
}

function resetForMissingKey() {
  readinessRequestId += 1
  cameraDetailRequestId += 1
  cameraDetailError.value = ''
  cameras.value = []
  selectedCameraId.value = ''
  selectedCamera.value = null
  chartData.value = []
  chartError.value = null
  chartLoading.value = false
  recentJobs.value = []
  recentJobsLoading.value = false
  readiness.value = null
  readinessError.value = null
  stats.value = emptyStats()
  statsIncomplete.value = false
  statsFailureCount.value = 0
  loading.value = false
}

watch(() => route.query.camera, (value) => {
  if (typeof value !== 'string' || !value || value === selectedCameraId.value) return
  if (cameras.value.some(camera => camera.id === value)) {
    void onCameraChange(value)
  }
})

watch(() => apiStore.hasApiKey, (hasKey) => {
  if (hasKey) void fetchAll()
  else resetForMissingKey()
})

onMounted(() => {
  if (hasApiKey.value) void fetchAll()
  else loading.value = false
})
</script>
