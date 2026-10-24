<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-text">Manajemen Kamera</h1>
      <Button 
        variant="primary" 
        :disabled="!hasApiKey" 
        @click="openCreateDialog"
        data-camera-create
      >
        <Video class="w-4 h-4" aria-hidden="true" />
        Tambah Kamera
      </Button>
    </div>

    <div v-if="!hasApiKey" class="card border-warning-border bg-warning-bg/50">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="flex-1">
          <p class="font-medium text-text">API Key belum diatur</p>
          <p class="text-sm text-text-muted mt-1">
            Atur akses API sebelum memuat atau menambahkan kamera.
            <RouterLink to="/dashboard/settings" class="text-brand underline ml-1">Buka Pengaturan</RouterLink>
          </p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="loading-state" role="status" aria-label="Memuat daftar kamera">
      <div class="spinner" aria-hidden="true" />
      Memuat data kamera...
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="error-state" role="alert">
      <AlertCircle class="w-6 h-6" aria-hidden="true" />
      <p class="error-state-title">Gagal memuat data kamera</p>
      <p class="error-state-description">{{ loadError }}</p>
      <Button variant="outline" @click="fetchCameras" class="btn-sm">Coba Lagi</Button>
    </div>

    <!-- Camera Table -->
    <div v-else class="card overflow-hidden">
      <div class="table-container">
        <table class="table" aria-label="Daftar kamera">
          <thead>
            <tr>
              <th scope="col">Nama</th>
              <th scope="col" class="numeric">Resolusi</th>
              <th scope="col" class="numeric">FPS</th>
              <th scope="col" class="numeric">Lokasi</th>
              <th scope="col">Status Kalibrasi</th>
              <th scope="col">Status Stream</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="camera in cameras" :key="camera.id">
              <td class="min-w-[200px] max-w-[300px]">
                <div class="font-medium text-text truncate">{{ camera.name }}</div>
                <div class="font-mono text-xs text-text-muted truncate">{{ camera.id }}</div>
              </td>
              <td class="numeric tabular-nums">{{ camera.resolution_w }} × {{ camera.resolution_h }}</td>
              <td class="numeric tabular-nums">{{ camera.fps }}</td>
              <td class="numeric tabular-nums text-text-muted">
                {{ camera.latitude !== null && camera.longitude !== null 
                  ? `${camera.latitude.toFixed(4)}, ${camera.longitude.toFixed(4)}` 
                  : '-' }}
              </td>
              <td>
                <Badge :class="getCalibrationBadgeClass(camera.id)">
                  {{ getCalibrationStatusText(camera.id) }}
                </Badge>
              </td>
              <td>
                <Badge :class="camera.stream_enabled ? 'badge-positive' : 'badge-neutral'">
                  {{ camera.stream_enabled ? 'Aktif' : 'Nonaktif' }}
                </Badge>
              </td>
              <td>
                <div class="flex flex-wrap gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    :aria-label="`Pratinjau ${camera.name}`"
                    @click="openPreview(camera)"
                    :disabled="!camera.stream_enabled"
                  >
                    Pratinjau
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    :aria-label="`Ambil Snapshot ${camera.name}`"
                    @click="openSnapshot(camera)"
                    :disabled="!camera.stream_enabled || loading"
                  >
                    Snapshot
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    :aria-label="`${camera.stream_enabled ? 'Nonaktifkan' : 'Aktifkan'} Stream ${camera.name}`"
                    @click="toggleStream(camera)"
                    :disabled="loading || togglingStreamId === camera.id"
                  >
                    {{ togglingStreamId === camera.id ? 'Memproses...' : (camera.stream_enabled ? 'Nonaktifkan' : 'Aktifkan') }}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    :aria-label="`Edit ${camera.name}`"
                    :data-camera-edit="camera.id"
                    @click="editCamera(camera)"
                  >
                    Edit
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    class="text-destructive hover:text-destructive"
                    :aria-label="`Hapus ${camera.name}`" 
                    @click="confirmDelete(camera)"
                  >
                    Hapus
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="cameras.length === 0">
              <td colspan="7" class="py-8 text-center text-text-muted">
                Belum ada kamera terdaftar. Klik "Tambah Kamera" untuk memulai.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create/Edit Camera Dialog -->
    <Dialog
      v-model:open="isCameraDialogOpen"
      :show-close-button="!saving"
      :disabled="saving"
      content-class="max-w-lg"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingCamera ? 'Edit Kamera' : 'Tambah Kamera Baru' }}</DialogTitle>
          <DialogDescription>Atur identitas, resolusi, dan lokasi kamera.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveCamera">
          <div class="space-y-2">
            <Label for="camera-name">Nama Kamera</Label>
            <input id="camera-name" v-model="form.name" required maxlength="100" class="input" />
          </div>
          <div class="space-y-2">
            <Label for="camera-rtsp">RTSP URL</Label>
            <input 
  id="camera-rtsp" 
  v-model="form.rtsp_url" 
  type="password" 
  autocomplete="new-password"
  :spellcheck="false" 
  maxlength="500" 
  aria-describedby="camera-rtsp-help" 
  class="input"
/>
            <p id="camera-rtsp-help" class="text-xs text-text-muted">
              {{ editingCamera
                ? `Sumber ${editingCamera.rtsp_configured ? 'sudah' : 'belum'} dikonfigurasi. Kosong berarti tidak diubah; isi hanya untuk mengganti sumber.`
                : 'Opsional. URL hanya dikirim ke backend saat disimpan, tidak ditampilkan kembali.' }}
            </p>
            <Button 
              v-if="editingCamera?.rtsp_configured" 
              type="button"
              variant="outline" 
              class="text-destructive"
              :disabled="saving || removingSource" 
              data-hapus-sumber="true"
              @click="confirmRemoveSource"
            >
              Hapus Sumber RTSP
            </Button>
          </div>
          <div class="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
            <div class="space-y-2">
              <Label for="camera-width">Resolusi W</Label>
              <Input id="camera-width" v-model="form.resolution_w" type="number" required min="1" max="10000" step="1" class="input" />
            </div>
            <div class="space-y-2">
              <Label for="camera-height">Resolusi H</Label>
              <Input id="camera-height" v-model="form.resolution_h" type="number" required min="1" max="10000" step="1" class="input" />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="camera-fps">FPS</Label>
            <Input id="camera-fps" v-model="form.fps" type="number" required min="1" max="120" step="1" class="input" />
          </div>
          <div class="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2" aria-describedby="camera-location-help">
            <div class="space-y-2">
              <Label for="camera-latitude">Latitude</Label>
              <Input id="camera-latitude" v-model="form.latitude" type="number" min="-90" max="90" step="any" class="input" />
            </div>
            <div class="space-y-2">
              <Label for="camera-longitude">Longitude</Label>
              <Input id="camera-longitude" v-model="form.longitude" type="number" min="-180" max="180" step="any" class="input" />
            </div>
          </div>
          <p id="camera-location-help" class="text-xs text-text-muted">Opsional. Koordinat kosong tidak dikirim.</p>
          
          <div v-if="saveError" class="error-state" role="alert">
            <AlertCircle class="w-5 h-5" aria-hidden="true" />
            <p class="font-medium text-text">Gagal menyimpan kamera</p>
            <p class="text-sm text-text-muted">{{ saveError }}</p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="secondary" :disabled="saving || removingSource" @click="isCameraDialogOpen = false">Batal</Button>
            <Button type="submit" :disabled="saving || removingSource" :aria-busy="saving" variant="primary">
              {{ saving ? 'Menyimpan kamera...' : (editingCamera ? 'Simpan Perubahan' : 'Tambah Kamera') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Remove RTSP Source Dialog -->
    <Dialog
      v-model:open="isRemoveSourceDialogOpen"
      role="alertdialog"
      :show-close-button="!removingSource"
      :disabled="removingSource"
      content-class="max-w-md"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Sumber RTSP?</DialogTitle>
          <DialogDescription>Sumber untuk {{ editingCamera?.name }} akan dihapus dan stream dinonaktifkan. Draf metadata belum disimpan.</DialogDescription>
        </DialogHeader>
        <div v-if="removeSourceError" class="error-state" role="alert">
          <AlertCircle class="w-5 h-5" aria-hidden="true" />
          <p class="font-medium text-text">Gagal menghapus sumber</p>
          <p class="text-sm text-text-muted">{{ removeSourceError }}</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" :disabled="removingSource" @click="isRemoveSourceDialogOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="removingSource" :aria-busy="removingSource" @click="removeSource">
            {{ removingSource ? 'Menghapus sumber...' : 'Hapus Sumber' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Camera Dialog -->
    <Dialog
      v-model:open="isDeleteDialogOpen"
      role="alertdialog"
      :show-close-button="!deleting"
      :disabled="deleting"
      content-class="max-w-md"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Kamera?</DialogTitle>
          <DialogDescription class="break-words">Kamera "{{ deletingCamera?.name }}" beserta kalibrasi dan job terkait akan dihapus. Tindakan ini tidak dapat dibatalkan.</DialogDescription>
        </DialogHeader>
        <div v-if="deleteError" class="error-state" role="alert">
          <AlertCircle class="w-5 h-5" aria-hidden="true" />
          <p class="font-medium text-text">Gagal menghapus kamera</p>
          <p class="text-sm text-text-muted">{{ deleteError }}</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" :disabled="deleting" @click="isDeleteDialogOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="deleting" :aria-busy="deleting" @click="deleteCamera">
            {{ deleting ? 'Menghapus kamera...' : 'Hapus Kamera' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Preview Dialog -->
    <Dialog
      v-model:open="isPreviewDialogOpen"
      :show-close-button="!previewLoading"
      :disabled="previewLoading"
      content-class="max-w-4xl"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pratinjau Stream: {{ previewCamera?.name }}</DialogTitle>
          <DialogDescription>Stream WHEP receive-only. Gunakan tombol Reconnect jika koneksi terputus.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div v-if="previewLoading" class="aspect-video bg-neutral-bg rounded-lg flex items-center justify-center">
            <div class="text-center text-text">
              <div class="spinner mx-auto mb-3" style="width: 2.5rem; height: 2.5rem; border-width: 3px;" />
              <p>Memuat stream...</p>
            </div>
          </div>
          <div v-else-if="previewError || !streamState?.whep_url" class="aspect-video bg-neutral-bg rounded-lg flex items-center justify-center p-4">
            <div class="text-center text-text">
              <XCircle class="w-12 h-12 text-negative mx-auto mb-3" aria-hidden="true" />
              <p class="mb-3">{{ previewError || 'Stream tidak tersedia. Aktifkan stream pada kamera ini.' }}</p>
              <Button variant="outline" @click="loadStream">Coba Lagi</Button>
            </div>
          </div>
          <WhepPlayer v-else :camera-id="previewCamera!.id" :whep-path="streamState!.whep_url!" :context="apiContext" class="aspect-video" />
          <div v-if="streamState" class="flex flex-wrap gap-4 text-sm text-text-muted">
            <span>Status: <span class="text-text capitalize">{{ streamState.status }}</span></span>
            <span>Synced: <span class="text-text">{{ streamState.synced ? 'Ya' : 'Tidak' }}</span></span>
            <span>Tracks: <span class="text-text">{{ streamState.tracks.join(', ') || '-' }}</span></span>
            <span>Checked: <span class="text-text">{{ new Date(streamState.checked_at).toLocaleTimeString() }}</span></span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="isPreviewDialogOpen = false">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Snapshot Dialog -->
    <Dialog
      v-model:open="isSnapshotDialogOpen"
      :show-close-button="!snapshotLoading"
      :disabled="snapshotLoading"
      content-class="max-w-2xl"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snapshot: {{ snapshotCamera?.name }}</DialogTitle>
          <DialogDescription>Snapshot terbaru dari kamera. Gunakan "Ambil Snapshot Baru" untuk memotret ulang.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div v-if="snapshotError" class="error-state" role="alert">
            <AlertCircle class="w-5 h-5" aria-hidden="true" />
            <p class="font-medium text-text">Gagal memuat snapshot</p>
            <p class="text-sm text-text-muted">{{ snapshotError }}</p>
          </div>

          <div v-if="snapshotLoading" class="aspect-video bg-neutral-bg rounded-lg flex items-center justify-center">
            <div class="text-center text-text">
              <div class="spinner mx-auto mb-3" style="width: 2.5rem; height: 2.5rem; border-width: 3px;" />
              <p>{{ latestSnapshot ? 'Memuat snapshot...' : 'Mengambil snapshot baru...' }}</p>
            </div>
          </div>

          <div v-else-if="snapshotError || !latestSnapshot" class="aspect-video bg-neutral-bg rounded-lg flex items-center justify-center p-4">
            <div class="text-center text-text">
              <XCircle class="w-12 h-12 text-negative mx-auto mb-3" aria-hidden="true" />
              <p class="mb-3">{{ snapshotError || 'Belum ada snapshot. Klik "Ambil Snapshot Baru" untuk memotret.' }}</p>
              <Button variant="primary" @click="takeNewSnapshot">
                {{ latestSnapshot ? 'Ambil Snapshot Baru' : 'Ambil Snapshot' }}
              </Button>
            </div>
          </div>

          <div v-else class="space-y-4">
            <AuthenticatedArtifact :path="latestSnapshot!.image_url" label="Snapshot" />
            <div class="grid grid-cols-2 gap-4 text-sm text-text-muted">
              <div><span class="text-text">Dimensi: </span>{{ latestSnapshot!.width }}×{{ latestSnapshot!.height }}</div>
              <div><span class="text-text">Ukuran: </span>{{ (latestSnapshot!.size_bytes / 1024).toFixed(1) }} KB</div>
              <div><span class="text-text">Diambil: </span>{{ formatDate(latestSnapshot!.captured_at) }}</div>
              <div><span class="text-text">ID: </span><code class="break-all font-mono text-xs">{{ latestSnapshot!.id }}</code></div>
            </div>
            <div class="flex gap-2">
              <Button variant="primary" @click="takeNewSnapshot">Ambil Snapshot Baru</Button>
              <Button variant="outline" @click="loadLatestSnapshot">Refresh</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="isSnapshotDialogOpen = false">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { cameraPayload, createCameraForm } from '@/lib/camera-form'
import { useApiStore } from '@/stores/api'
import type { Camera, SnapshotResponse, StreamResponse } from '@/types'
import {
  createCamera as apiCreateCamera,
  deleteCamera as apiDeleteCamera,
  updateCamera as apiUpdateCamera,
  getCamera,
  listCameras,
} from '@/services/cameras'
import { getLatestSnapshot, takeSnapshot } from '@/services/snapshots'
import { getStream, updateStream } from '@/services/streams'
import AuthenticatedArtifact from '@/components/AuthenticatedArtifact.vue'
import WhepPlayer from '@/components/media/WhepPlayer.vue'

// UI Components
import { Button, Input, Label, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui'

import { Video, AlertCircle, CheckCircle, XCircle } from '@lucide/vue'

const apiStore = useApiStore()
const toast = useToast()
const isActive = useConnectionScope()

const cameras = ref<Camera[]>([])
const loading = ref(false)
const loadError = ref('')
const cameraStatuses = ref<Record<string, 'active' | 'none' | 'loading' | 'error'>>({})
const isCameraDialogOpen = ref(false)
const editingCamera = ref<Camera | null>(null)
const form = ref(createCameraForm())
const saving = ref(false)
const saveError = ref('')
const isDeleteDialogOpen = ref(false)
const deletingCamera = ref<Camera | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const isRemoveSourceDialogOpen = ref(false)
const removingSource = ref(false)
const removeSourceError = ref('')

const isPreviewDialogOpen = ref(false)
const previewCamera = ref<Camera | null>(null)
const streamState = ref<StreamResponse | null>(null)
const previewLoading = ref(false)
const previewError = ref('')

const isSnapshotDialogOpen = ref(false)
const snapshotCamera = ref<Camera | null>(null)
const latestSnapshot = ref<SnapshotResponse | null>(null)
const snapshotLoading = ref(false)
const snapshotError = ref('')

const togglingStreamId = ref<string | null>(null)

const hasApiKey = computed(() => apiStore.hasApiKey)
const apiContext = computed(() => apiStore.connectionContext)

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message
  return 'Permintaan gagal. Coba kembali.'
}

async function fetchCameras() {
  if (!hasApiKey.value || loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const first = await listCameras(1, 100)
    const items = [...first.items]
    for (let page = 2; page <= first.total_pages; page += 1) {
      const next = await listCameras(page, 100)
      items.push(...next.items)
    }
    if (!isActive()) return
    cameras.value = items
    cameraStatuses.value = Object.fromEntries(
      items.map((camera) => [camera.id, 'loading']),
    )
  } catch (error: unknown) {
    if (!isActive()) return
    loadError.value = errorMessage(error)
  } finally {
    loading.value = false
  }
  if (loadError.value) return

  await Promise.allSettled(cameras.value.map(async (camera) => {
    try {
      const detail = await getCamera(camera.id)
      if (!isActive()) return
      cameraStatuses.value[camera.id] = detail.active_calibration_id ? 'active' : 'none'
    } catch {
      if (!isActive()) return
      cameraStatuses.value[camera.id] = 'error'
    }
  }))
}

function getCalibrationBadgeClass(cameraId: string): string {
  const status = cameraStatuses.value[cameraId]
  switch (status) {
    case 'active': return 'badge-positive'
    case 'loading': return 'badge-warning'
    case 'error': return 'badge-negative'
    default: return 'badge-neutral'
  }
}

function getCalibrationStatusText(cameraId: string): string {
  const status = cameraStatuses.value[cameraId]
  switch (status) {
    case 'active': return 'Kalibrasi aktif'
    case 'loading': return 'Memeriksa...'
    case 'error': return 'Gagal diperiksa'
    default: return 'Belum Dikalibrasi'
  }
}

function openCreateDialog() {
  editingCamera.value = null
  form.value = createCameraForm()
  saveError.value = ''
  isCameraDialogOpen.value = true
}

function editCamera(camera: Camera) {
  editingCamera.value = camera
  form.value = createCameraForm(camera)
  saveError.value = ''
  isCameraDialogOpen.value = true
}

async function saveCamera() {
  if (saving.value || removingSource.value || isRemoveSourceDialogOpen.value) return
  saveError.value = ''
  saving.value = true
  try {
    const payload = cameraPayload(form.value, !!editingCamera.value)
    if (editingCamera.value) {
      await apiUpdateCamera(editingCamera.value.id, payload)
      if (!isActive()) return
      toast.success('Kamera berhasil diperbarui')
    } else {
      await apiCreateCamera(payload)
      if (!isActive()) return
      toast.success('Kamera berhasil ditambahkan')
    }
  } catch (error: unknown) {
    if (!isActive()) return
    saveError.value = errorMessage(error)
    toast.error('Gagal menyimpan kamera', { description: saveError.value })
    return
  } finally {
    saving.value = false
  }
  const editedId = editingCamera.value?.id
  isCameraDialogOpen.value = false
  await fetchCameras()
  if (editedId) {
    await nextTick()
    document.querySelector<HTMLElement>(`[data-camera-edit="${editedId}"]`)?.focus()
  }
}

function confirmDelete(camera: Camera) {
  deletingCamera.value = camera
  deleteError.value = ''
  isDeleteDialogOpen.value = true
}

async function deleteCamera() {
  if (deleting.value || !deletingCamera.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await apiDeleteCamera(deletingCamera.value.id)
    if (!isActive()) return
    toast.success('Kamera berhasil dihapus')
  } catch (error: unknown) {
    if (!isActive()) return
    deleteError.value = errorMessage(error)
    toast.error('Gagal menghapus kamera', { description: deleteError.value })
    return
  } finally {
    deleting.value = false
  }
  isDeleteDialogOpen.value = false
  await fetchCameras()
  await nextTick()
  document.querySelector<HTMLElement>('[data-camera-create]')?.focus()
}

function confirmRemoveSource() {
  removeSourceError.value = ''
  isRemoveSourceDialogOpen.value = true
}

async function removeSource() {
  if (!editingCamera.value || removingSource.value) return
  removingSource.value = true
  removeSourceError.value = ''
  try {
    const camera = await apiUpdateCamera(editingCamera.value.id, { rtsp_url: null })
    if (!isActive()) return
    editingCamera.value = camera
    form.value.rtsp_url = ''
    cameras.value = cameras.value.map(item => item.id === camera.id ? camera : item)
    isRemoveSourceDialogOpen.value = false
    await nextTick()
    document.querySelector<HTMLElement>('[data-hapus-sumber]')?.focus() || document.getElementById('camera-rtsp')?.focus()
    toast.success('Sumber RTSP dihapus')
  } catch (error) {
    if (isActive()) removeSourceError.value = errorMessage(error)
  } finally {
    removingSource.value = false
  }
}

async function loadStream() {
  if (!previewCamera.value) return
  previewLoading.value = true
  previewError.value = ''
  try {
    streamState.value = await getStream(previewCamera.value.id)
  } catch (error) {
    previewError.value = errorMessage(error)
  } finally {
    previewLoading.value = false
  }
}

function openPreview(camera: Camera) {
  previewCamera.value = camera
  streamState.value = null
  previewError.value = ''
  isPreviewDialogOpen.value = true
  loadStream()
}

async function loadLatestSnapshot() {
  if (!snapshotCamera.value) return
  snapshotLoading.value = true
  snapshotError.value = ''
  try {
    latestSnapshot.value = await getLatestSnapshot(snapshotCamera.value.id, { max_frame_age_sec: 30 })
  } catch (error) {
    snapshotError.value = errorMessage(error)
  } finally {
    snapshotLoading.value = false
  }
}

async function takeNewSnapshot() {
  if (!snapshotCamera.value || snapshotLoading.value) return
  snapshotLoading.value = true
  snapshotError.value = ''
  try {
    const snapshot = await takeSnapshot(snapshotCamera.value.id)
    latestSnapshot.value = snapshot
    toast.success('Snapshot berhasil diambil')
  } catch (error) {
    snapshotError.value = errorMessage(error)
  } finally {
    snapshotLoading.value = false
  }
}

function openSnapshot(camera: Camera) {
  snapshotCamera.value = camera
  latestSnapshot.value = null
  snapshotError.value = ''
  isSnapshotDialogOpen.value = true
  loadLatestSnapshot()
}

async function toggleStream(camera: Camera) {
  if (loading.value || togglingStreamId.value) return
  togglingStreamId.value = camera.id
  try {
    const updated = await updateStream(camera.id, !camera.stream_enabled)
    if (!isActive()) return
    cameras.value = cameras.value.map(c => c.id === camera.id ? { ...c, stream_enabled: updated.enabled } : c)
    toast.success(updated.enabled ? 'Stream diaktifkan' : 'Stream dinonaktifkan')
  } catch (error) {
    if (!isActive()) return
    toast.error('Gagal mengubah status stream', { description: errorMessage(error) })
  } finally {
    togglingStreamId.value = null
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', { 
    year: 'numeric', month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  })
}

onMounted(fetchCameras)
</script>