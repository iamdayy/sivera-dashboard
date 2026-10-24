<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-text">Referensi Tanah</h1>
      <Button 
        variant="primary" 
        :disabled="!selectedCameraId || !hasApiKey || busy" 
        @click="openCreateDialog"
        data-ground-ref-create
      >
        <MapPin class="w-4 h-4" aria-hidden="true" />
        Tambah Referensi Baru
      </Button>
    </div>

    <div v-if="!hasApiKey" class="card border-warning-border bg-warning-bg/50">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="flex-1">
          <p class="font-medium text-text">API Key belum diatur</p>
          <p class="text-sm text-text-muted mt-1">
            Atur akses API sebelum memuat kamera dan referensi tanah.
            <RouterLink to="/dashboard/settings" class="text-brand underline ml-1">Buka Pengaturan</RouterLink>
          </p>
        </div>
      </div>
    </div>

    <!-- Camera Selector Card -->
    <div v-else class="card">
      <Label for="ground-ref-camera" class="label">Pilih Kamera</Label>
      <select
        id="ground-ref-camera"
        v-model="selectedCameraId"
        :disabled="!hasApiKey || cameraLoading || !cameras.length || busy || isCreateDialogOpen"
        class="input"
        aria-describedby="ground-ref-camera-help"
      >
        <option value="" disabled>Pilih kamera</option>
        <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
          {{ cam.name }} ({{ cam.resolution_w }}×{{ cam.resolution_h }})
        </option>
      </select>
      <p id="ground-ref-camera-help" class="text-sm text-text-muted mt-1 break-words">
        {{ selectedCamera ? `Referensi tanah untuk ${selectedCamera.name}.` : 'Pilih kamera sebelum membuat referensi tanah.' }}
      </p>
      <div v-if="cameraLoading" class="loading-state mt-2" role="status">
        <div class="spinner" aria-hidden="true" />
        Memuat data kamera...
      </div>
      <div v-else-if="cameraError" class="error-state mt-2" role="alert">
        <AlertCircle class="w-5 h-5" aria-hidden="true" />
        <p class="font-medium text-text">Gagal memuat data kamera</p>
        <p class="text-sm text-text-muted">{{ cameraError }}</p>
        <Button variant="outline" @click="fetchCameras" class="btn-sm mt-2">Coba Lagi</Button>
      </div>
      <p v-else-if="hasApiKey && !cameras.length" class="text-sm text-text-muted mt-2">
        Belum ada kamera terdaftar.
        <RouterLink to="/dashboard/cameras" class="text-brand underline ml-1">Buka Manajemen Kamera</RouterLink>
      </p>
    </div>

    <!-- Action Error Alert -->
    <div v-if="actionError" class="error-state" role="alert">
      <AlertCircle class="w-5 h-5" aria-hidden="true" />
      <p class="font-medium text-text">{{ actionError.title }}</p>
      <p class="text-sm text-text-muted">{{ actionError.message }}</p>
    </div>

    <!-- Ground References Table -->
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table" aria-label="Daftar referensi tanah">
          <thead>
            <tr>
              <th scope="col">Versi</th>
              <th scope="col" class="numeric">Jumlah Titik</th>
              <th scope="col">Satuan</th>
              <th scope="col">Status</th>
              <th scope="col">Deskripsi</th>
              <th scope="col">Dibuat</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7">
                <div class="loading-state" role="status">
                  <div class="spinner" aria-hidden="true" />
                  Memuat referensi tanah...
                </div>
              </td>
            </tr>
            <tr v-else-if="loadError">
              <td colspan="7">
                <div class="error-state" role="alert">
                  <AlertCircle class="w-5 h-5" aria-hidden="true" />
                  <p class="font-medium text-text">Gagal memuat referensi tanah</p>
                  <p class="text-sm text-text-muted">{{ loadError }}</p>
                  <Button variant="outline" @click="fetchGroundReferences" class="btn-sm mt-2">Coba Lagi</Button>
                </div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="ref in groundReferences" :key="ref.id">
                <td class="font-mono tabular-nums">v{{ ref.version }}</td>
                <td class="numeric tabular-nums">{{ ref.image_points?.length || 0 }} titik</td>
                <td class="text-text-muted">{{ ref.world_units }}</td>
                <td>
                  <Badge :class="ref.is_active ? 'badge-positive' : 'badge-neutral'">
                    {{ ref.is_active ? 'Aktif' : 'Nonaktif' }}
                  </Badge>
                </td>
                <td class="text-text-muted max-w-xs truncate">{{ ref.description || '-' }}</td>
                <td class="text-text-muted">{{ formatDate(ref.created_at) }}</td>
                <td>
                  <div class="flex flex-wrap gap-2">
                    <Button 
                      v-if="!ref.is_active" 
                      variant="ghost" 
                      size="sm"
                      :disabled="busy" 
                      :aria-busy="activatingId === ref.id" 
                      :aria-label="`Aktifkan referensi tanah v${ref.version}`" 
                      @click="activateReference(ref)"
                    >
                      {{ activatingId === ref.id ? 'Mengaktifkan...' : 'Aktifkan' }}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      :disabled="busy" 
                      :aria-busy="viewingModelId === ref.id" 
                      :aria-label="`Lihat model ground v${ref.version}`" 
                      @click="viewGroundModel(ref)"
                    >
                      {{ viewingModelId === ref.id ? 'Memuat model...' : 'Model Ground' }}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      :disabled="busy" 
                      :aria-busy="viewingBevId === ref.id" 
                      :aria-label="`BEV preview v${ref.version}`" 
                      @click="viewBevPreview(ref)"
                    >
                      {{ viewingBevId === ref.id ? 'Memuat preview...' : 'BEV Preview' }}
                    </Button>
                  </div>
                </td>
              </tr>
              <tr v-if="!groundReferences.length">
                <td colspan="7" class="py-8 text-center text-text-muted">
                  {{ selectedCameraId ? 'Belum ada referensi tanah untuk kamera ini. Klik "Tambah Referensi Baru" untuk memulai.' : 'Pilih kamera terlebih dahulu untuk melihat referensi tanahnya.' }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Ground Reference Dialog -->
    <Dialog
      :open="isCreateDialogOpen"
      :show-close-button="!saving"
      :disabled="saving"
      content-class="max-w-4xl"
      @update:open="setCreateDialogOpen"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Referensi Tanah Baru</DialogTitle>
          <DialogDescription class="break-words">Tentukan pasangan titik image-dunia untuk {{ selectedCamera?.name }}.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveGroundReference">
          <fieldset :disabled="saving" class="min-w-0 space-y-4">
            <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div class="space-y-2">
                <Label for="ground-ref-units">Satuan Dunia</Label>
                <select
                  id="ground-ref-units"
                  v-model="refForm.world_units"
                  :disabled="saving"
                  class="input"
                >
                  <option value="meter">Meter</option>
                  <option value="metre">Metre</option>
                </select>
              </div>
              <div class="space-y-2">
                <Label for="ground-ref-desc">Deskripsi</Label>
                <textarea id="ground-ref-desc" v-model="refForm.description" rows="3" placeholder="Catatan opsional tentang referensi ini..." class="input min-h-[80px] resize-y" />
              </div>
            </div>

            <!-- Calibration Image for Point Picking -->
            <div v-if="calibImageUrl" class="space-y-3 border border-sheet-border rounded-lg p-4">
              <p class="text-sm font-medium text-text">Klik pada gambar untuk memilih titik image (u,v):</p>
              <div class="relative inline-block max-w-full">
                <img 
                  ref="calibImageRef" 
                  :src="calibImageUrl" 
                  @click="pickImagePoint" 
                  class="max-w-full h-auto cursor-crosshair border border-sheet-border" 
                  alt="Gambar kalibrasi untuk penentuan titik"
                />
                <div 
                  v-for="(pt, idx) in imagePoints" 
                  :key="idx" 
                  class="absolute w-3 h-3 bg-brand rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-sheet" 
                  :style="pointStyle(pt)" 
                  aria-hidden="true"
                >
                  <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-brand">{{ idx + 1 }}</span>
                </div>
              </div>
              <p class="text-xs text-text-muted">{{ imagePoints.length }} titik dipilih (minimal 4). Koordinat memakai piksel gambar asli.</p>
            </div>
            <div v-else-if="calibImageState === 'loading'" class="py-4 text-center text-text-muted" role="status">
              <div class="spinner mx-auto mb-2" aria-hidden="true" />
              Memuat gambar kalibrasi...
            </div>
            <div v-else-if="calibImageState === 'missing'" class="rounded-lg border border-warning-border bg-warning-bg/40 p-4 text-sm text-text-muted">
              Kamera ini belum memiliki kalibrasi aktif, jadi gambar titik tidak tersedia. Aktifkan kalibrasi terlebih dahulu.
              <RouterLink :to="{ path: '/dashboard/calibrations', query: { camera: selectedCameraId } }" class="ml-1 text-brand underline">Buka Kalibrasi</RouterLink>
            </div>
            <div v-else-if="calibImageState === 'error'" class="rounded-lg border border-negative-border bg-negative-bg/40 p-4 text-sm text-text-muted" role="alert">
              Gambar kalibrasi tidak dapat dimuat.
              <button type="button" class="ml-1 text-brand underline" @click="loadCalibrationPreview">Coba Lagi</button>
            </div>

            <!-- Point Pairs Table -->
            <div v-if="imagePoints.length > 0" class="space-y-3 border-t border-sheet-border pt-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium text-text">Pasangan Titik (Image ↔ Dunia)</h4>
                <p class="text-xs text-text-muted">Klik gambar di atas untuk menambah titik. Koordinat dunia diisi di tabel.</p>
              </div>
              <div class="table-container">
                <table class="table" aria-label="Pasangan titik image-dunia">
                  <thead>
                    <tr>
                      <th scope="col" class="w-12">#</th>
                      <th scope="col">Image (u, v)</th>
                      <th scope="col" class="w-80">Dunia (X, Y) [{{ refForm.world_units }}]</th>
                      <th scope="col" class="w-12">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(pt, idx) in imagePoints" :key="idx">
                      <td class="font-mono tabular-nums">{{ idx + 1 }}</td>
                      <td class="font-mono text-text-muted">{{ pt.u.toFixed(1) }}, {{ pt.v.toFixed(1) }}</td>
                      <td>
                        <div class="flex gap-2">
                          <div class="space-y-1 w-32">
                            <Label :for="`world-x-${idx}`" class="sr-only">X</Label>
                            <Input 
                              :id="`world-x-${idx}`" 
                              v-model="getWorldPoint(idx).x" 
                              type="number" 
                              step="0.01" 
                              placeholder="X" 
                              :disabled="saving" 
                              class="input"
                            />
                          </div>
                          <div class="space-y-1 w-32">
                            <Label :for="`world-y-${idx}`" class="sr-only">Y</Label>
                            <Input 
                              :id="`world-y-${idx}`" 
                              v-model="getWorldPoint(idx).y" 
                              type="number" 
                              step="0.01" 
                              placeholder="Y" 
                              :disabled="saving" 
                              class="input"
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          class="p-2"
                          :disabled="saving || imagePoints.length <= 4" 
                          :aria-label="`Hapus titik ${idx + 1}`" 
                          @click="removeImagePoint(idx)"
                        >
                          <X class="h-4 w-4" aria-hidden="true" />
                          <span class="sr-only">Hapus titik</span>
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p v-if="imagePoints.length > 0 && imagePoints.length < 4" class="text-warning text-sm" role="status">
              Minimal 4 titik diperlukan (saat ini: {{ imagePoints.length }})
            </p>
          </fieldset>
          <div v-if="saveError" class="error-state" role="alert">
            <AlertCircle class="w-5 h-5" aria-hidden="true" />
            <p class="font-medium text-text">Gagal membuat referensi tanah</p>
            <p class="text-sm text-text-muted">{{ saveError }}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" :disabled="saving" @click="setCreateDialogOpen(false)">Batal</Button>
            <Button type="submit" :disabled="saving || imagePoints.length < 4 || !worldPointsValid" :aria-busy="saving" variant="primary">
              {{ saving ? 'Menyimpan...' : 'Simpan Referensi' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { useApiStore } from '@/stores/api'
import { fetchArtifactBlob, requireImageBlob } from '@/services/artifacts'
import { listCameras } from '@/services/cameras'
import { 
  listGroundReferences, 
  createGroundReference as apiCreateGroundReference, 
  activateGroundReference as apiActivateGroundReference, 
  getActiveGroundModel as apiGetActiveGroundModel, 
  getGroundModelByRef as apiGetGroundModelByRef, 
  getBEVPreview as apiGetBEVPreview 
} from '@/services/groundReferences'
import { getUndistortPreview as apiGetUndistortPreview, getActiveCalibration as apiGetActiveCalibration } from '@/services/calibrations'
import type { Camera, GroundReference } from '@/types'
import type { GroundModel } from '@/services/groundReferences'

// UI Components
import { Button, Input, Textarea, Label, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui'

import { MapPin, AlertCircle, X } from '@lucide/vue'

const apiStore = useApiStore()
const toast = useToast()
const isActive = useConnectionScope()
const route = useRoute()
const router = useRouter()
const calibImageRef = ref<HTMLImageElement | null>(null)

const cameras = ref<Camera[]>([])
const selectedCameraId = ref('')
const selectedCamera = computed(() => cameras.value.find(camera => camera.id === selectedCameraId.value))
const cameraLoading = ref(false)
const cameraError = ref('')
const groundReferences = ref<GroundReference[]>([])
const loading = ref(false)
const loadError = ref('')
let loadVersion = 0
const saving = ref(false)
const isCreateDialogOpen = ref(false)
const refForm = ref({
  world_units: 'meter' as 'meter' | 'metre',
  description: '',
})
const { url: calibImageUrl, replace: replaceCalibPreview, clear: clearCalibPreview } = useObjectUrl()
const { replace: replaceBevPreview, clear: clearBevPreview } = useObjectUrl()
let previewVersion = 0
const calibImageState = ref<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle')
const imagePoints = ref<Array<{ u: number; v: number }>>([])
const worldPoints = ref<Array<{ x: string; y: string }>>([])
const saveError = ref('')
const activatingId = ref('')
const viewingModelId = ref('')
const viewingBevId = ref('')
const actionError = ref<{ title: string; message: string } | null>(null)
const hasApiKey = computed(() => apiStore.hasApiKey)
const busy = computed(() => saving.value || !!activatingId.value || !!viewingModelId.value || !!viewingBevId.value)

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Permintaan gagal. Coba kembali.'
}

const worldPointsValid = computed(() => {
  return worldPoints.value.every(point => {
    const x = point.x.trim()
    const y = point.y.trim()
    return x !== '' && y !== '' && Number.isFinite(Number(x)) && Number.isFinite(Number(y))
  })
})

function getWorldPoint(idx: number) {
  return worldPoints.value[idx] ?? { x: '', y: '' }
}

function pointStyle(point: { u: number; v: number }) {
  const width = calibImageRef.value?.naturalWidth ?? 0
  const height = calibImageRef.value?.naturalHeight ?? 0
  if (!width || !height) return {}
  return {
    left: `${(point.u / width) * 100}%`,
    top: `${(point.v / height) * 100}%`,
  }
}

async function fetchCameras() {
  if (!apiStore.hasApiKey || cameraLoading.value) return
  cameraLoading.value = true
  cameraError.value = ''
  try {
    const first = await listCameras(1, 100)
    const items = [...first.items]
    for (let page = 2; page <= first.total_pages; page += 1) {
      const next = await listCameras(page, 100)
      items.push(...next.items)
    }
    if (!isActive()) return
    cameras.value = items

    const queryCamera = typeof route.query.camera === 'string' ? route.query.camera : ''
    const current = items.find(camera => camera.id === selectedCameraId.value)
    const fromQuery = items.find(camera => camera.id === queryCamera)
    if (!current) {
      selectedCameraId.value = fromQuery?.id ?? items[0]?.id ?? ''
    }
  } catch (error: unknown) {
    if (!isActive()) return
    cameraError.value = errorMessage(error)
  } finally {
    cameraLoading.value = false
  }
}

async function fetchGroundReferences() {
  const cameraId = selectedCameraId.value
  const version = ++loadVersion
  groundReferences.value = []
  loadError.value = ''
  loading.value = !!cameraId && apiStore.hasApiKey
  if (!loading.value) return
  try {
    const response = await listGroundReferences(cameraId)
    if (isActive() && version === loadVersion) groundReferences.value = response.items
  } catch (error: unknown) {
    if (isActive() && version === loadVersion) loadError.value = errorMessage(error)
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

watch(selectedCameraId, (value) => {
  clearCalibPreview()
  clearBevPreview()
  previewVersion++
  calibImageState.value = 'idle'
  actionError.value = null
  fetchGroundReferences()

  if (value && route.query.camera !== value) {
    void router.replace({ query: { ...route.query, camera: value } })
  }
})

function openCreateDialog() {
  if (busy.value || !selectedCameraId.value) return
  refForm.value = { world_units: 'meter', description: '' }
  imagePoints.value = []
  worldPoints.value = []
  clearCalibPreview()
  calibImageState.value = 'idle'
  saveError.value = ''
  isCreateDialogOpen.value = true
  void loadCalibrationPreview()
}

async function loadCalibrationPreview() {
  const cameraId = selectedCameraId.value
  if (!cameraId) return

  const version = ++previewVersion
  clearCalibPreview()
  calibImageState.value = 'loading'
  try {
    const activeCalib = await apiGetActiveCalibration(cameraId)
    if (!isActive() || version !== previewVersion) return
    if (!activeCalib) {
      calibImageState.value = 'missing'
      return
    }

    const blob = await apiGetUndistortPreview(cameraId, activeCalib.id)
    if (!isActive() || version !== previewVersion) return
    replaceCalibPreview(blob)
    calibImageState.value = 'ready'
  } catch {
    if (!isActive() || version !== previewVersion) return
    calibImageState.value = 'error'
    toast.warning('Gambar kalibrasi tidak dapat dimuat', { description: 'Coba lagi atau periksa kalibrasi aktif kamera.' })
  }
}

function setCreateDialogOpen(open: boolean) {
  if (saving.value) return
  isCreateDialogOpen.value = open
  if (!open) {
    refForm.value = { world_units: 'meter', description: '' }
    imagePoints.value = []
    worldPoints.value = []
    previewVersion++
    calibImageState.value = 'idle'
    clearCalibPreview()
    saveError.value = ''
  }
}

async function saveGroundReference() {
  if (busy.value || !selectedCameraId.value) return
  if (imagePoints.value.length < 4) {
    toast.warning('Minimal 4 titik diperlukan')
    return
  }
  if (!worldPointsValid.value) {
    toast.warning('Isi semua koordinat dunia (X, Y)')
    return
  }

  saveError.value = ''
  const cameraId = selectedCameraId.value
  const imagePointsArray = imagePoints.value.map(point => [point.u, point.v])
  const worldPointsArray = worldPoints.value.map(point => [Number(point.x), Number(point.y)])

  saving.value = true
  try {
    await apiCreateGroundReference(cameraId, {
      image_points: imagePointsArray,
      world_points: worldPointsArray,
      world_units: refForm.value.world_units,
      description: refForm.value.description || undefined,
    })
    if (!isActive()) return
    toast.success('Referensi tanah berhasil dibuat')
  } catch (error: unknown) {
    if (!isActive()) return
    saveError.value = errorMessage(error)
    const err = error as { response?: { data?: { detail?: string } }; message?: string }
    toast.error('Gagal membuat referensi tanah', { description: err.response?.data?.detail || err.message })
    return
  } finally {
    saving.value = false
  }
  setCreateDialogOpen(false)
  if (cameraId === selectedCameraId.value) await fetchGroundReferences()
}

async function activateReference(ref: GroundReference) {
  if (busy.value || ref.is_active) return
  const cameraId = selectedCameraId.value
  activatingId.value = ref.id
  actionError.value = null
  try {
    await apiActivateGroundReference(cameraId, ref.id)
    if (!isActive()) return
    toast.success('Referensi tanah berhasil diaktifkan')
    if (cameraId === selectedCameraId.value) await fetchGroundReferences()
  } catch (error: unknown) {
    if (!isActive()) return
    actionError.value = { title: `Gagal mengaktifkan referensi tanah v${ref.version}`, message: errorMessage(error) }
    toast.error(actionError.value.title, { description: actionError.value.message })
  } finally {
    activatingId.value = ''
  }
}

async function viewGroundModel(ref: GroundReference) {
  if (busy.value) return
  const cameraId = selectedCameraId.value
  viewingModelId.value = ref.id
  actionError.value = null
  try {
    const model = await apiGetGroundModelByRef(cameraId, ref.id)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    if (!model) {
      toast.warning('Model ground untuk referensi ini belum dibuat', { description: 'Aktifkan referensi ini terlebih dahulu untuk membuat model ground.' })
      return
    }
    toast.info('Model Ground', {
      description: `ID: ${model.id}, Reproj: ${model.reproj_err_px?.toFixed(2) ?? '-'} px, Tinggi: ${model.cam_height?.toFixed(2) ?? '-'} m`,
    })
  } catch (error: unknown) {
    if (!isActive() || cameraId !== selectedCameraId.value) return
    actionError.value = { title: `Gagal memuat model ground v${ref.version}`, message: errorMessage(error) }
    toast.error(actionError.value.title, { description: actionError.value.message })
  } finally {
    viewingModelId.value = ''
  }
}

async function viewBevPreview(ref: GroundReference) {
  if (busy.value) return
  const cameraId = selectedCameraId.value
  viewingBevId.value = ref.id
  actionError.value = null
  try {
    const model = await apiGetGroundModelByRef(cameraId, ref.id)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    if (!model) {
      toast.error('BEV preview tidak tersedia', { description: 'Model ground untuk referensi ini belum dibuat. Aktifkan referensi terlebih dahulu.' })
      return
    }
    const preview = await apiGetBEVPreview(cameraId, model.id)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    const blob = requireImageBlob(await fetchArtifactBlob(preview.bev_image_url))
    if (!isActive() || cameraId !== selectedCameraId.value) return
    const url = replaceBevPreview(blob)
    toast.success('BEV Preview siap', {
      action: { label: 'Buka', onClick: () => { if (isActive()) window.open(url, '_blank', 'noopener,noreferrer') } },
    })
  } catch (error: unknown) {
    if (!isActive() || cameraId !== selectedCameraId.value) return
    const msg = errorMessage(error)
    actionError.value = { title: `Gagal memuat BEV preview v${ref.version}`, message: msg }
    toast.error(actionError.value.title, { description: actionError.value.message })
  } finally {
    viewingBevId.value = ''
  }
}

function pickImagePoint(event: MouseEvent) {
  const image = calibImageRef.value
  if (!image) return
  const rect = image.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const scaleX = (image.naturalWidth || rect.width) / rect.width
  const scaleY = (image.naturalHeight || rect.height) / rect.height
  const u = (event.clientX - rect.left) * scaleX
  const v = (event.clientY - rect.top) * scaleY

  imagePoints.value.push({ u, v })
  worldPoints.value.push({ x: '', y: '' })
}

function removeImagePoint(idx: number) {
  imagePoints.value.splice(idx, 1)
  worldPoints.value.splice(idx, 1)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(fetchCameras)
onUnmounted(() => {
  loadVersion++
  previewVersion++
})
</script>