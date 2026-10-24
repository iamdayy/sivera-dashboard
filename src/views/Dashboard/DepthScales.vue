<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { listCameras as apiListCameras, getCamera } from '@/services/cameras'
import { getActiveCalibration as apiGetActiveCalibration } from '@/services/calibrations'
import { getActiveGroundModel, getActiveGroundReference } from '@/services/groundReferences'
import { listDepthScales, getActiveDepthScale, getDepthScaleContext, activateDepthScale, getDepthScale, type DepthScaleContext } from '@/services/depthScales'
import { normalizeApiError } from '@/services/api'
import type { Camera, Calibration, DepthScale, GroundReference } from '@/types'
import { getDepthScaleContext as typeDepthScaleContext } from '@/services/depthScales'
import type { GroundModel } from '@/services/groundReferences'
import { Button, Badge } from '@/components/ui'
import { RouterLink } from 'vue-router'
import { AlertCircle, Brain, CheckCircle, ChevronRight, HelpCircle, MapPin, Plus, RotateCcw, Scale, Settings, Video, XCircle } from '@lucide/vue'
import DepthScaleForm from '@/components/depth-scales/DepthScaleForm.vue'

const route = useRoute()
const router = useRouter()
const apiStore = useApiStore()
const toast = useToast()
const isActive = useConnectionScope()

const cameras = ref<Camera[]>([])
const selectedCameraId = ref('')
const cameraLoading = ref(false)
const context = ref<DepthScaleContext | null>(null)
const contextLoading = ref(false)
const contextError = ref('')
const activeScale = ref<DepthScale | null>(null)
const activeScaleLoading = ref(false)
const savedScales = ref<DepthScale[]>([])
const savedScalesLoading = ref(false)
const isCreateFormOpen = ref(false)
const createdScaleId = ref<string | null>(null)
const showActiveTab = ref(true)

const hasApiKey = computed(() => apiStore.hasApiKey)
const selectedCamera = computed(() => cameras.value.find(c => c.id === selectedCameraId.value))
const hasActiveContext = computed(() => !!context.value)
const contextKey = computed(() => context.value ? `${context.value.calibration.id}/${context.value.groundModel.id}/${context.value.groundModel.ground_ref_id}` : '')

async function loadAllCameras(): Promise<Camera[]> {
  const first = await apiListCameras(1, 100)
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page++) {
    const next = await apiListCameras(page, 100)
    items.push(...next.items)
  }
  return items
}

async function fetchCameras() {
  if (!hasApiKey.value) return
  cameraLoading.value = true
  try {
    const items = await loadAllCameras()
    if (!isActive()) return
    cameras.value = items
    const queryCamera = typeof route.query.camera === 'string' ? route.query.camera : ''
    const current = items.find(c => c.id === selectedCameraId.value)
    const fromQuery = items.find(c => c.id === queryCamera)
    if (!current) selectedCameraId.value = fromQuery?.id ?? items[0]?.id ?? ''
  } catch (error) {
    if (!isActive()) return
    toast.error('Gagal memuat kamera', { description: error instanceof Error ? error.message : 'Coba lagi.' })
  } finally { cameraLoading.value = false }
}

async function fetchContext(cameraId: string) {
  contextLoading.value = true
  contextError.value = ''
  context.value = null
  activeScale.value = null
  savedScales.value = []
  try {
    const ctx = await getDepthScaleContext(cameraId)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    context.value = ctx
    await Promise.all([fetchActiveScale(ctx), fetchSavedScales(ctx)])
  } catch (error) {
    if (!isActive() || cameraId !== selectedCameraId.value) return
    const msg = normalizeApiError(error).message
    contextError.value = msg
    toast.error('Gagal memuat konteks skala', { description: msg })
  } finally { if (isActive()) contextLoading.value = false }
}

async function fetchActiveScale(ctx: DepthScaleContext) {
  activeScaleLoading.value = true
  try {
    const scale = await getActiveDepthScale(ctx.groundModel.camera_id, ctx.groundModel.id)
    if (!isActive()) return
    if (scale.camera_id === ctx.groundModel.camera_id && scale.ground_model_id === ctx.groundModel.id && scale.is_active) {
      activeScale.value = scale
    }
  } catch (error) {
    if (!isActive()) return
    const apiError = normalizeApiError(error)
    if (apiError.status !== 404) toast.error('Gagal memuat skala aktif', { description: apiError.message })
  } finally { activeScaleLoading.value = false }
}

async function fetchSavedScales(ctx: DepthScaleContext) {
  savedScalesLoading.value = true
  try {
    const response = await listDepthScales(ctx.groundModel.camera_id, ctx.groundModel.id)
    if (!isActive()) return
    savedScales.value = response.items.filter(s => s.camera_id === ctx.groundModel.camera_id && s.ground_model_id === ctx.groundModel.id)
  } catch (error) {
    if (!isActive()) return
    toast.error('Gagal memuat daftar skala', { description: normalizeApiError(error).message })
  } finally { savedScalesLoading.value = false }
}

async function onCameraChange() {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (key !== 'camera' && typeof value === 'string') query[key] = value
  }
  if (selectedCameraId.value) query.camera = selectedCameraId.value
  await router.replace({ query })
  isCreateFormOpen.value = false
  createdScaleId.value = null
  await fetchContext(selectedCameraId.value)
}

function openCreateForm() {
  if (!context.value) return
  isCreateFormOpen.value = true
}

function closeCreateForm() {
  isCreateFormOpen.value = false
}

async function handleCreated(scale: DepthScale) {
  createdScaleId.value = scale.id
  isCreateFormOpen.value = false
  toast.success('Skala kedalaman dibuat dan diaktifkan', { description: `Fit lolos: mean residual ${scale.mean_residual_m?.toFixed(3) ?? '-'} m, max ${scale.max_residual_m?.toFixed(3) ?? '-'} m.` })
  await Promise.all([fetchActiveScale(context.value!), fetchSavedScales(context.value!)])
  showActiveTab.value = true
}

function handleContextChanged() {
  closeCreateForm()
  fetchContext(selectedCameraId.value)
}

function handleUncertain() {
  toast.warning('Hasil tidak pasti', { description: 'Periksa daftar skala dan skala aktif sebelum mencoba lagi.' })
  fetchSavedScales(context.value!)
}

async function handleActivate(scale: DepthScale) {
  if (!context.value) return
  try {
    const result = await activateDepthScale(context.value.groundModel.camera_id, context.value.groundModel.id, scale.id)
    if (!isActive()) return
    activeScale.value = result
    toast.success('Skala diaktifkan')
    await fetchSavedScales(context.value)
  } catch (error) {
    if (!isActive()) return
    toast.error('Gagal mengaktifkan skala', { description: normalizeApiError(error).message })
  }
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatNullable(value: number | null | undefined, digits: number): string {
  return value === null || value === undefined ? '-' : value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

watch(() => route.query.camera, (val) => {
  if (typeof val === 'string' && val !== selectedCameraId.value) {
    selectedCameraId.value = val
  }
}, { immediate: true })

watch(selectedCameraId, (id) => {
  if (id) fetchContext(id)
})

onMounted(fetchCameras)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-text">Skala Kedalaman</h1>
      <div class="flex items-center gap-2">
        <RouterLink to="/dashboard/predictions" class="btn btn-primary min-h-11" v-if="hasActiveContext">
          <Brain class="w-4 h-4" aria-hidden="true" />
          Lanjut ke Analisis Sampah
        </RouterLink>
      </div>
    </div>

    <div v-if="!hasApiKey" class="card border-warning-border bg-warning-bg/50">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="flex-1">
          <p class="font-medium text-text">API Key belum diatur</p>
          <p class="text-sm text-text-muted mt-1">
            Atur akses API sebelum mengelola skala kedalaman.
            <RouterLink to="/dashboard/settings" class="text-brand underline ml-1">Buka Pengaturan</RouterLink>
          </p>
        </div>
      </div>
    </div>

    <!-- Camera Selector -->
    <div v-else class="card">
      <Label for="depth-camera" class="label">Pilih Kamera</Label>
      <select
        id="depth-camera"
        v-model="selectedCameraId"
        @change="onCameraChange"
        :disabled="!hasApiKey || cameraLoading || !cameras.length"
        class="input w-full md:w-64"
        aria-describedby="depth-camera-help"
      >
        <option value="" disabled>Pilih kamera</option>
        <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
          {{ cam.name }} ({{ cam.resolution_w }}×{{ cam.resolution_h }})
        </option>
      </select>
      <p id="depth-camera-help" class="text-sm text-text-muted mt-1" v-if="selectedCameraId">
        Menampilkan skala kedalaman untuk {{ selectedCamera?.name }}
      </p>
      <div v-if="cameraLoading" class="loading-state mt-2" role="status">
        <div class="spinner" aria-hidden="true" />
        Memuat kamera...
      </div>
      <p v-else-if="hasApiKey && !cameras.length" class="text-sm text-text-muted mt-2">
        Belum ada kamera terdaftar.
        <RouterLink to="/dashboard/cameras" class="text-brand underline ml-1">Buka Manajemen Kamera</RouterLink>
      </p>
    </div>

    <!-- Context / Prerequisites -->
    <div v-if="selectedCameraId" class="card">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-text">Konteks aktif</h2>
          <p class="mt-1 text-sm text-text-muted">
            Skala kedalaman terikat pada kalibrasi aktif dan model ground yang cocok dengan referensi tanah aktif.
          </p>
        </div>
        <div v-if="contextLoading" class="flex shrink-0 items-center gap-2 text-sm text-text-muted" role="status">
          <div class="spinner" aria-hidden="true" />
          Memeriksa...
        </div>
      </div>

      <div v-if="contextError" class="mt-4 rounded-lg border border-negative-border bg-negative-bg/40 p-3" role="alert">
        <p class="text-sm text-negative">{{ contextError }}</p>
        <Button type="button" variant="outline" class="mt-2" @click="fetchContext(selectedCameraId)">Coba Lagi</Button>
      </div>

      <div v-else-if="!contextLoading && !context" class="loading-state mt-4" role="status">
        <div class="spinner" aria-hidden="true" />
        Memuat konteks...
      </div>

      <div v-else-if="context" class="mt-4 space-y-3">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-sheet-border bg-sheet p-4">
            <div class="flex items-center gap-2">
              <CheckCircle class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
              <p class="font-medium text-text">Kalibrasi aktif v{{ context.calibration.version }}</p>
            </div>
            <p class="mt-2 text-sm text-text-muted">{{ context.calibration.resolution_w }}×{{ context.calibration.resolution_h }} px, RMS {{ context.calibration.rms_reproj?.toFixed(3) ?? '-' }} px</p>
            <RouterLink :to="{ path: '/dashboard/calibrations', query: { camera: selectedCameraId } }" class="btn btn-ghost btn-sm mt-3 min-h-11 w-full justify-center">Kelola Kalibrasi</RouterLink>
          </div>

          <div class="rounded-lg border border-sheet-border bg-sheet p-4">
            <div class="flex items-center gap-2">
              <MapPin class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
              <p class="font-medium text-text">Referensi tanah aktif v{{ context.groundModel.ground_ref_id.slice(-4) }}</p>
            </div>
            <p class="mt-2 text-sm text-text-muted">Model ground v{{ context.groundModel.created_at.slice(0, 10) }}. Tinggi {{ context.groundModel.cam_height?.toFixed(1) ?? '-' }} m, pitch {{ context.groundModel.pitch_down_deg?.toFixed(1) ?? '-' }}°</p>
            <RouterLink :to="{ path: '/dashboard/ground-references', query: { camera: selectedCameraId } }" class="btn btn-ghost btn-sm mt-3 min-h-11 w-full justify-center">Kelola Referensi Tanah</RouterLink>
          </div>

          <div class="rounded-lg border border-sheet-border bg-sheet p-4">
            <div class="flex items-center gap-2">
              <Scale class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
              <p class="font-medium text-text">Skala kedalaman</p>
            </div>
            <p class="mt-2 text-sm text-text-muted">{{ activeScaleLoading ? 'Memeriksa...' : activeScale ? 'Ada skala aktif untuk model ground ini.' : 'Belum ada skala aktif. Buat skala baru di bawah.' }}</p>
            <Badge :class="activeScale ? 'badge-positive' : 'badge-negative'" class="mt-2">{{ activeScale ? 'Tersedia' : 'Tidak tersedia' }}</Badge>
          </div>
        </div>

        <!-- Active Scale Details -->
        <div v-if="activeScale" class="rounded-lg border border-positive-border bg-positive-bg/30 p-4 space-y-2">
          <h3 class="text-base font-semibold flex items-center gap-2"><Scale class="h-4 w-4" aria-hidden="true" />Skala kedalaman aktif</h3>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><span class="text-text-muted">Model depth</span> <p class="font-mono">{{ activeScale.depth_model }}</p></div>
            <div><span class="text-text-muted">Scale (s)</span> <p class="font-mono">{{ activeScale.scale_s.toFixed(6) }}</p></div>
            <div><span class="text-text-muted">Offset (b)</span> <p class="font-mono">{{ activeScale.offset_b.toFixed(6) }} m</p></div>
            <div><span class="text-text-muted">Rentang clip</span> <p class="font-mono">{{ activeScale.clip_min_m }}–{{ activeScale.clip_max_m }} m</p></div>
            <div class="sm:col-span-2"><span class="text-text-muted">Residual rata-rata</span> <p class="font-mono">{{ activeScale.mean_residual_m?.toFixed(3) ?? '-' }} m</p></div>
            <div class="sm:col-span-2"><span class="text-text-muted">Residual maksimum</span> <p class="font-mono">{{ activeScale.max_residual_m?.toFixed(3) ?? '-' }} m</p></div>
            <div class="sm:col-span-2"><span class="text-text-muted">Jumlah titik fit</span> <p class="font-mono">{{ activeScale.residuals?.length ?? '-' }}</p></div>
            <div class="sm:col-span-2"><span class="text-text-muted">Dibuat</span> <p>{{ formatDateTime(activeScale.created_at) }}</p></div>
          </div>
          <p class="text-xs text-text-muted">Label: fit lolos pemeriksaan backend. Validasi terpisah dengan pengukuran held-out diperlukan. Jika tidak cocok, gunakan tombol di bawah untuk membuat skala baru.</p>
        </div>

        <!-- Create Form -->
        <DepthScaleForm v-if="isCreateFormOpen && context" :camera-id="selectedCameraId" :context="context" @created="handleCreated" @busy="v => {}" @changed="handleContextChanged" @uncertain="handleUncertain" @reconcile="() => fetchSavedScales(context!)" @close="closeCreateForm" />

        <!-- Saved Scales Table -->
        <div class="border-t border-sheet-border pt-4">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-text">Skala tersimpan</h2>
              <Badge variant="outline" class="text-xs">{{ savedScales.length }}</Badge>
            </div>
            <Button variant="primary" :disabled="!hasActiveContext || contextLoading" @click="openCreateForm">
              <Plus class="w-4 h-4" aria-hidden="true" />
              Buat Skala Baru
            </Button>
          </div>

          <div class="table-container">
            <table class="table" aria-label="Daftar skala kedalaman tersimpan">
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Model</th>
                  <th scope="col" class="numeric">Scale</th>
                  <th scope="col" class="numeric">Offset</th>
                  <th scope="col" class="numeric">Clip (m)</th>
                  <th scope="col" class="numeric">Mean Res (m)</th>
                  <th scope="col" class="numeric">Max Res (m)</th>
                  <th scope="col">Status</th>
                  <th scope="col">Dibuat</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="savedScalesLoading && savedScales.length === 0">
                  <td colspan="10"><div class="loading-state" role="status"><div class="spinner" aria-hidden="true" />Memuat daftar skala...</div></td>
                </tr>
                <tr v-else-if="savedScales.length === 0">
                  <td colspan="10"><div class="empty-state py-8"><Scale class="empty-state-icon" aria-hidden="true" /><p class="empty-state-title">Belum ada skala tersimpan</p><p class="empty-state-description">Klik Buat Skala Baru untuk membuat dan mengaktifkan skala kedalaman pertama.</p></div></td>
                </tr>
                <tr v-for="scale in savedScales" :key="scale.id" :class="{ 'bg-positive-bg/30': scale.is_active }">
                  <td class="font-mono text-xs max-w-xs truncate">{{ scale.id }}</td>
                  <td class="font-mono text-sm">{{ scale.depth_model }}</td>
                  <td class="numeric tabular-nums">{{ scale.scale_s.toFixed(6) }}</td>
                  <td class="numeric tabular-nums">{{ scale.offset_b.toFixed(6) }}</td>
                  <td class="numeric tabular-nums">{{ scale.clip_min_m }}–{{ scale.clip_max_m }}</td>
                  <td class="numeric tabular-nums">{{ formatNullable(scale.mean_residual_m, 3) }}</td>
                  <td class="numeric tabular-nums">{{ formatNullable(scale.max_residual_m, 3) }}</td>
                  <td>
                    <Badge :class="scale.is_active ? 'badge-positive' : 'badge-neutral'">{{ scale.is_active ? 'Aktif' : 'Tersimpan' }}</Badge>
                  </td>
                  <td>{{ formatDateTime(scale.created_at) }}</td>
                  <td>
                    <div class="flex items-center gap-1">
                      <Button v-if="!scale.is_active" variant="ghost" size="sm" :disabled="savedScalesLoading" :aria-label="`Aktifkan skala ${scale.id.slice(0, 8)}`" @click="handleActivate(scale)"><RotateCcw class="h-3 w-3" aria-hidden="true" /> Aktifkan</Button>
                      <Button v-else variant="ghost" size="sm" disabled><CheckCircle class="h-3 w-3" aria-hidden="true" /> Aktif</Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>