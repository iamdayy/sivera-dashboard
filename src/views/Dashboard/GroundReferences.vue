<template>
  <div ref="view" class="min-w-0 space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold">Referensi Tanah</h1>
      <Button data-ground-ref-create :disabled="!selectedCameraId || !apiStore.hasApiKey || busy" @click="openCreateDialog">
        Tambah Referensi Baru
      </Button>
    </div>

    <Alert v-if="!apiStore.hasApiKey">
      <AlertTitle>API Key belum diatur</AlertTitle>
      <AlertDescription>
        Atur akses API sebelum memuat kamera dan referensi tanah.
        <RouterLink to="/dashboard/settings" class="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Buka Pengaturan</RouterLink>
      </AlertDescription>
    </Alert>

    <Card class="min-w-0 gap-0 py-4">
      <CardContent class="space-y-2 px-4">
        <Label for="ground-ref-camera">Pilih Kamera</Label>
        <Select v-model="selectedCameraId" :disabled="!apiStore.hasApiKey || cameraLoading || !cameras.length || busy || isCreateDialogOpen">
          <SelectTrigger id="ground-ref-camera" class="md:max-w-lg" aria-describedby="ground-ref-camera-help">
            <SelectValue placeholder="Pilih kamera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="cam in cameras" :key="cam.id" :value="cam.id">
              {{ cam.name }} ({{ cam.resolution_w }}x{{ cam.resolution_h }})
            </SelectItem>
          </SelectContent>
        </Select>
        <p id="ground-ref-camera-help" class="break-words text-sm text-muted-foreground">
          {{ selectedCamera ? `Referensi tanah untuk ${selectedCamera.name}.` : 'Pilih kamera sebelum membuat referensi tanah.' }}
        </p>
        <p v-if="cameraLoading" role="status" class="text-sm text-muted-foreground">Memuat data kamera...</p>
        <Alert v-else-if="cameraError" variant="destructive">
          <AlertTitle>Gagal memuat data kamera</AlertTitle>
          <AlertDescription>
            <p>{{ cameraError }}</p>
            <Button variant="outline" class="mt-2 w-fit text-foreground" @click="fetchCameras">Coba Lagi</Button>
          </AlertDescription>
        </Alert>
        <p v-else-if="apiStore.hasApiKey && !cameras.length" class="text-sm text-muted-foreground">
          Belum ada kamera terdaftar.
          <RouterLink to="/dashboard/cameras" class="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Buka Manajemen Kamera</RouterLink>
        </p>
      </CardContent>
    </Card>

    <Alert v-if="actionError" variant="destructive">
      <AlertTitle>{{ actionError.title }}</AlertTitle>
      <AlertDescription>{{ actionError.message }}</AlertDescription>
    </Alert>

    <Card class="min-w-0 gap-0 py-0">
      <CardContent class="min-w-0 p-0">
        <Table aria-label="Daftar referensi tanah">
          <TableHeader>
            <TableRow>
              <TableHead>Versi</TableHead>
              <TableHead class="text-right">Jumlah Titik</TableHead>
              <TableHead>Satuan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="7">
                <div role="status" class="space-y-3">
                  <p class="text-muted-foreground">Memuat referensi tanah...</p>
                  <Skeleton class="h-5 w-full" />
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="loadError">
              <TableCell colspan="7" class="whitespace-normal">
                <Alert variant="destructive">
                  <AlertTitle>Gagal memuat referensi tanah</AlertTitle>
                  <AlertDescription>
                    <p>{{ loadError }}</p>
                    <Button variant="outline" class="mt-2 w-fit text-foreground" @click="fetchGroundReferences">Coba Lagi</Button>
                  </AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
            <template v-else>
              <TableRow v-for="ref in groundReferences" :key="ref.id">
                <TableCell class="font-medium tabular-nums">v{{ ref.version }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ ref.image_points?.length || 0 }} titik</TableCell>
                <TableCell class="text-muted-foreground">{{ ref.world_units }}</TableCell>
                <TableCell><Badge :variant="ref.is_active ? 'default' : 'secondary'">{{ ref.is_active ? 'Aktif' : 'Non-Aktif' }}</Badge></TableCell>
                <TableCell class="text-muted-foreground max-w-xs truncate">{{ ref.description || '-' }}</TableCell>
                <TableCell class="text-muted-foreground">{{ formatDate(ref.created_at) }}</TableCell>
                <TableCell>
                  <div class="flex gap-2">
                    <Button v-if="!ref.is_active" variant="ghost" :disabled="busy" :aria-busy="activatingId === ref.id" :aria-label="`Aktifkan referensi tanah v${ref.version}`" @click="activateReference(ref)">
                      {{ activatingId === ref.id ? 'Mengaktifkan...' : 'Aktifkan' }}
                    </Button>
                    <Button variant="ghost" :disabled="busy || !hasGroundModel(ref)" :aria-busy="viewingModelId === ref.id" :aria-label="`Lihat model ground v${ref.version}`" @click="viewGroundModel(ref)">
                      {{ viewingModelId === ref.id ? 'Memuat model...' : 'Model Ground' }}
                    </Button>
                    <Button variant="ghost" :disabled="busy || !hasGroundModel(ref)" :aria-busy="viewingBevId === ref.id" :aria-label="`BEV preview v${ref.version}`" @click="viewBevPreview(ref)">
                      {{ viewingBevId === ref.id ? 'Memuat preview...' : 'BEV Preview' }}
                    </Button>
                    <Button variant="ghost" class="text-destructive hover:text-destructive" :disabled="true" :aria-describedby="`ground-ref-delete-help-${ref.id}`" :aria-label="`Hapus referensi tanah v${ref.version}`">Hapus</Button>
                  </div>
                  <p :id="`ground-ref-delete-help-${ref.id}`" class="mt-1 text-xs text-muted-foreground">{{ ref.is_active ? 'Aktifkan versi lain sebelum menghapus.' : 'Hapus referensi tanah belum didukung backend.' }}</p>
                </TableCell>
              </TableRow>
              <TableRow v-if="!groundReferences.length">
                <TableCell colspan="7" class="py-8 text-center whitespace-normal text-muted-foreground">
                  {{ selectedCameraId ? 'Belum ada referensi tanah untuk kamera ini. Klik "Tambah Referensi Baru" untuk memulai.' : 'Pilih kamera terlebih dahulu untuk melihat referensi tanahnya.' }}
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog :open="isCreateDialogOpen" @update:open="setCreateDialogOpen">
      <DialogContent class="max-w-4xl" :show-close-button="!saving" @close-auto-focus="restoreFocus" @escape-key-down="preventWhileSaving" @interact-outside="preventWhileSaving">
        <DialogHeader>
          <DialogTitle>Tambah Referensi Tanah Baru</DialogTitle>
          <DialogDescription class="break-words">Tentukan pasangan titik image-dunia untuk {{ selectedCamera?.name }}.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveGroundReference">
          <fieldset :disabled="saving" class="min-w-0 space-y-4">
            <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div class="space-y-2">
                <Label for="ground-ref-units">Satuan Dunia</Label>
                <Select v-model="refForm.world_units" :disabled="saving">
                  <SelectTrigger id="ground-ref-units">
                    <SelectValue placeholder="Pilih satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meter">Meter</SelectItem>
                    <SelectItem value="metre">Metre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2">
                <Label for="ground-ref-desc">Deskripsi</Label>
                <Textarea id="ground-ref-desc" v-model="refForm.description" rows="3" placeholder="Catatan opsional tentang referensi ini..." />
              </div>
            </div>

            <!-- Calibration Image for Point Picking -->
            <div v-if="calibImageUrl" class="space-y-3 border border-border rounded-lg p-4">
              <p class="text-sm font-medium">Klik pada gambar untuk memilih titik image (u,v):</p>
              <div class="relative inline-block">
                <img ref="calibImageRef" :src="calibImageUrl" @click="pickImagePoint" tabindex="0" class="max-w-full h-auto cursor-crosshair border border-border" role="button" aria-label="Gambar kalibrasi untuk penentuan titik" />
                <div v-for="(pt, idx) in imagePoints" :key="idx" class="absolute w-3 h-3 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-background" :style="{ left: pt.u + 'px', top: pt.v + 'px' }" aria-hidden="true">
                  <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-primary">{{ idx + 1 }}</span>
                </div>
              </div>
              <p class="text-xs text-muted-foreground">{{ imagePoints.length }} titik dipilih (minimal 4)</p>
            </div>
            <div v-else class="text-center text-muted-foreground py-4">
              Memuat gambar kalibrasi...
            </div>

            <!-- Point Pairs Table -->
            <div v-if="imagePoints.length > 0" class="space-y-3 border-t pt-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium">Pasangan Titik (Image ↔ Dunia)</h4>
                <p class="text-xs text-muted-foreground">Klik gambar di atas untuk menambah titik. Koordinat dunia diisi di tabel.</p>
              </div>
              <Table aria-label="Pasangan titik image-dunia">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-12">#</TableHead>
                    <TableHead>Image (u, v)</TableHead>
                    <TableHead class="w-80">Dunia (X, Y) [{{ refForm.world_units }}]</TableHead>
                    <TableHead class="w-12">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(pt, idx) in imagePoints" :key="idx">
                    <TableCell class="font-medium tabular-nums">{{ idx + 1 }}</TableCell>
                    <TableCell class="font-mono text-muted-foreground">{{ pt.u.toFixed(1) }}, {{ pt.v.toFixed(1) }}</TableCell>
                    <TableCell>
                      <div class="flex gap-2">
                        <div class="space-y-1 w-32">
                          <Label :for="`world-x-${idx}`" class="sr-only">X</Label>
                          <Input :id="`world-x-${idx}`" v-model="getWorldPoint(idx).x" type="number" step="0.01" placeholder="X" :disabled="saving" />
                        </div>
                        <div class="space-y-1 w-32">
                          <Label :for="`world-y-${idx}`" class="sr-only">Y</Label>
                          <Input :id="`world-y-${idx}`" v-model="getWorldPoint(idx).y" type="number" step="0.01" placeholder="Y" :disabled="saving" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" :disabled="saving || imagePoints.length <= 4" :aria-label="`Hapus titik ${idx + 1}`" @click="removeImagePoint(idx)">
                        <X class="h-4 w-4" aria-hidden="true" />
                        <span class="sr-only">Hapus titik</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <p v-if="imagePoints.length > 0 && imagePoints.length < 4" class="text-amber-600 text-sm" role="status">
              Minimal 4 titik diperlukan (saat ini: {{ imagePoints.length }})
            </p>
          </fieldset>
          <Alert v-if="saveError" variant="destructive">
            <AlertTitle>Gagal membuat referensi tanah</AlertTitle>
            <AlertDescription>{{ saveError }}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" :disabled="saving" @click="setCreateDialogOpen(false)">Batal</Button>
            <Button type="submit" :disabled="saving || imagePoints.length < 4 || !worldPointsValid" :aria-busy="saving">{{ saving ? 'Menyimpan...' : 'Simpan Referensi' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { listCameras } from '@/services/cameras'
import { listGroundReferences, createGroundReference as apiCreateGroundReference, activateGroundReference as apiActivateGroundReference, getActiveGroundModel as apiGetActiveGroundModel, getGroundModelByRef as apiGetGroundModelByRef, getBEVPreview as apiGetBEVPreview } from '@/services/groundReferences'
import { getUndistortPreview as apiGetUndistortPreview, getActiveCalibration as apiGetActiveCalibration } from '@/services/calibrations'
import type { Camera, GroundReference } from '@/types'
import type { GroundModel } from '@/services/groundReferences'

const apiStore = useApiStore()
const toast = useToast()
const view = ref<HTMLElement | null>(null)
const calibImageRef = ref<HTMLImageElement | null>(null)
let dialogTrigger: HTMLElement | null = null

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
const calibImageUrl = ref<string | null>(null)
const imagePoints = ref<Array<{ u: number; v: number }>>([])
const worldPoints = ref<Array<{ x: number; y: number }>>([])
const saveError = ref('')
const activatingId = ref('')
const viewingModelId = ref('')
const viewingBevId = ref('')
const actionError = ref<{ title: string; message: string } | null>(null)
const busy = computed(() => saving.value || !!activatingId.value || !!viewingModelId.value || !!viewingBevId.value)

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Permintaan gagal. Coba kembali.'
}

const worldPointsValid = computed(() => {
  return worldPoints.value.every(p => p.x !== undefined && p.y !== undefined && !isNaN(p.x) && !isNaN(p.y))
})

function getWorldPoint(idx: number) {
  return worldPoints.value[idx] ?? { x: 0, y: 0 }
}

function hasGroundModel(ref: GroundReference): boolean {
  // We can't know without fetching; enable and let the service return 404 if none
  return true
}

async function fetchCameras() {
  if (!apiStore.hasApiKey || cameraLoading.value) return
  cameraLoading.value = true
  cameraError.value = ''
  try {
    const response = await listCameras()
    cameras.value = response.items
    if (!selectedCameraId.value) selectedCameraId.value = response.items[0]?.id ?? ''
  } catch (error: unknown) {
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
    if (version === loadVersion) groundReferences.value = response.items
  } catch (error: unknown) {
    if (version === loadVersion) loadError.value = errorMessage(error)
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

watch(selectedCameraId, () => {
  actionError.value = null
  void fetchGroundReferences()
})

function restoreFocus(event: Event) {
  event.preventDefault()
  const target = dialogTrigger?.isConnected ? dialogTrigger : view.value?.querySelector<HTMLElement>('[data-ground-ref-create]')
  target?.focus()
}

function openCreateDialog(event: MouseEvent) {
  if (busy.value || !selectedCameraId.value) return
  dialogTrigger = event.currentTarget as HTMLElement
  refForm.value = { world_units: 'meter', description: '' }
  imagePoints.value = []
  worldPoints.value = []
  calibImageUrl.value = null
  saveError.value = ''
  isCreateDialogOpen.value = true
  // Fetch active calibration for image preview after dialog opens
  nextTick().then(async () => {
    if (selectedCameraId.value) {
      try {
        const activeCalib = await apiGetActiveCalibration(selectedCameraId.value)
        if (activeCalib) {
          calibImageUrl.value = await apiGetUndistortPreview(selectedCameraId.value, activeCalib.id)
        }
      } catch {
        toast.warning('Tidak dapat memuat preview kalibrasi; koordinat image bisa diketik manual')
      }
    }
  })
}

function setCreateDialogOpen(open: boolean) {
  if (saving.value) return
  isCreateDialogOpen.value = open
  if (!open) {
    refForm.value = { world_units: 'meter', description: '' }
    imagePoints.value = []
    worldPoints.value = []
    calibImageUrl.value = null
    saveError.value = ''
  }
}

function preventWhileSaving(event: Event) {
  if (saving.value) event.preventDefault()
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
  const imagePointsArray = imagePoints.value.map(p => [p.u, p.v])
  const worldPointsArray = worldPoints.value.map(p => [p.x, p.y])

  saving.value = true
  try {
    await apiCreateGroundReference(cameraId, {
      image_points: imagePointsArray,
      world_points: worldPointsArray,
      world_units: refForm.value.world_units,
      description: refForm.value.description || undefined,
    })
    toast.success('Referensi tanah berhasil dibuat')
  } catch (error: unknown) {
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
    toast.success('Referensi tanah berhasil diaktifkan')
    if (cameraId === selectedCameraId.value) await fetchGroundReferences()
  } catch (error: unknown) {
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
    if (!model) {
      toast.warning('Model ground untuk referensi ini belum dibuat', { description: 'Aktifkan referensi ini terlebih dahulu untuk membuat model ground.' })
      return
    }
    toast.info('Model Ground', {
      description: `ID: ${model.id}, Reproj: ${model.reproj_err_px?.toFixed(2) ?? '-'} px, Tinggi: ${model.cam_height?.toFixed(2) ?? '-'} m`,
    })
  } catch (error: unknown) {
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
    if (!model) {
      toast.error('BEV preview tidak tersedia', { description: 'Model ground untuk referensi ini belum dibuat. Aktifkan referensi terlebih dahulu.' })
      return
    }
    const preview = await apiGetBEVPreview(cameraId, model.id)
    toast.success('BEV Preview siap', {
      description: `Gambar: ${preview.bev_image_url}`,
      action: { label: 'Buka', onClick: () => window.open(preview.bev_image_url, '_blank', 'noopener,noreferrer') },
    })
  } catch (error: unknown) {
    const msg = errorMessage(error)
    actionError.value = { title: `Gagal memuat BEV preview v${ref.version}`, message: msg }
    toast.error(actionError.value.title, { description: actionError.value.message })
  } finally {
    viewingBevId.value = ''
  }
}

function pickImagePoint(event: MouseEvent) {
  if (!calibImageRef.value) return
  const rect = calibImageRef.value.getBoundingClientRect()
  const u = event.clientX - rect.left
  const v = event.clientY - rect.top
  imagePoints.value.push({ u, v })
  worldPoints.value.push({ x: 0, y: 0 })
}

function removeImagePoint(idx: number) {
  imagePoints.value.splice(idx, 1)
  worldPoints.value.splice(idx, 1)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

import { nextTick } from 'vue'

onMounted(fetchCameras)
onUnmounted(() => { loadVersion++ })
</script>