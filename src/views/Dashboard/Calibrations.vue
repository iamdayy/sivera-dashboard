<template>
  <div ref="view" class="min-w-0 space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold">Manajemen Kalibrasi</h1>
      <Button data-calibration-create :disabled="!selectedCameraId || !apiStore.hasApiKey || busy" @click="openCreateDialog">
        Buat Kalibrasi Baru
      </Button>
    </div>

    <Alert v-if="!apiStore.hasApiKey">
      <AlertTitle>API Key belum diatur</AlertTitle>
      <AlertDescription>
        Atur akses API sebelum memuat kamera dan kalibrasi.
        <RouterLink to="/dashboard/settings" class="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Buka Pengaturan</RouterLink>
      </AlertDescription>
    </Alert>

    <Card class="min-w-0 gap-0 py-4">
      <CardContent class="space-y-2 px-4">
        <Label for="calibration-camera">Pilih Kamera</Label>
        <Select v-model="selectedCameraId" :disabled="!apiStore.hasApiKey || cameraLoading || !cameras.length || busy || isCreateDialogOpen || isDeleteDialogOpen">
          <SelectTrigger id="calibration-camera" class="md:max-w-lg" aria-describedby="calibration-camera-help">
            <SelectValue placeholder="Pilih kamera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="cam in cameras" :key="cam.id" :value="cam.id">
              {{ cam.name }} ({{ cam.resolution_w }}x{{ cam.resolution_h }})
            </SelectItem>
          </SelectContent>
        </Select>
        <p id="calibration-camera-help" class="break-words text-sm text-muted-foreground">
          {{ selectedCamera ? `Kalibrasi untuk ${selectedCamera.name}.` : 'Pilih kamera sebelum membuat kalibrasi.' }}
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
    <p v-if="previewUrl" role="status" class="text-sm text-muted-foreground">
      Preview v{{ previewVersion }} siap. Jika tab baru tidak terbuka,
      <a :href="previewUrl" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Buka Preview v{{ previewVersion }}</a>.
    </p>

    <Card class="min-w-0 gap-0 py-0">
      <CardContent class="min-w-0 p-0">
        <Table aria-label="Daftar kalibrasi">
          <TableHeader>
            <TableRow>
              <TableHead>Versi</TableHead>
              <TableHead class="text-right">RMS Reprojection</TableHead>
              <TableHead class="text-right">Chessboard</TableHead>
              <TableHead class="text-right">Square Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dibuat</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="7">
                <div role="status" class="space-y-3">
                  <p class="text-muted-foreground">Memuat kalibrasi...</p>
                  <Skeleton class="h-5 w-full" />
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="loadError">
              <TableCell colspan="7" class="whitespace-normal">
                <Alert variant="destructive">
                  <AlertTitle>Gagal memuat kalibrasi</AlertTitle>
                  <AlertDescription>
                    <p>{{ loadError }}</p>
                    <Button variant="outline" class="mt-2 w-fit text-foreground" @click="fetchCalibrations">Coba Lagi</Button>
                  </AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
            <template v-else>
              <TableRow v-for="calib in calibrations" :key="calib.id">
                <TableCell class="font-medium tabular-nums">v{{ calib.version }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ calib.rms_reproj == null ? '-' : `${calib.rms_reproj.toFixed(3)} px` }}</TableCell>
                <TableCell class="text-right tabular-nums text-muted-foreground">{{ calib.chessboard_cols ?? '-' }}x{{ calib.chessboard_rows ?? '-' }}</TableCell>
                <TableCell class="text-right tabular-nums text-muted-foreground">{{ calib.square_m == null ? '-' : `${calib.square_m * 100} cm` }}</TableCell>
                <TableCell><Badge :variant="calib.is_active ? 'default' : 'secondary'">{{ calib.is_active ? 'Aktif' : 'Non-Aktif' }}</Badge></TableCell>
                <TableCell class="text-muted-foreground">{{ formatDate(calib.created_at) }}</TableCell>
                <TableCell>
                  <div class="flex gap-2">
                    <Button v-if="!calib.is_active" variant="ghost" :disabled="busy" :aria-busy="activatingId === calib.id" :aria-label="`Aktifkan kalibrasi v${calib.version}`" @click="activateCalibration(calib)">
                      {{ activatingId === calib.id ? 'Mengaktifkan...' : 'Aktifkan' }}
                    </Button>
                    <Button variant="ghost" :disabled="busy" :aria-busy="previewingId === calib.id" :aria-label="`Preview kalibrasi v${calib.version}`" @click="viewPreview(calib)">
                      {{ previewingId === calib.id ? 'Memuat preview...' : 'Preview' }}
                    </Button>
                    <Button variant="ghost" class="text-destructive hover:text-destructive" :disabled="busy || calib.is_active" :aria-describedby="calib.is_active ? `calibration-delete-help-${calib.id}` : undefined" :aria-label="`Hapus kalibrasi v${calib.version}`" @click="confirmDelete(calib, $event)">Hapus</Button>
                  </div>
                  <p v-if="calib.is_active" :id="`calibration-delete-help-${calib.id}`" class="mt-1 text-xs text-muted-foreground">Aktifkan versi lain sebelum menghapus.</p>
                </TableCell>
              </TableRow>
              <TableRow v-if="!calibrations.length">
                <TableCell colspan="7" class="py-8 text-center whitespace-normal text-muted-foreground">
                  {{ selectedCameraId ? 'Belum ada kalibrasi untuk kamera ini. Klik "Buat Kalibrasi Baru" untuk memulai.' : 'Pilih kamera terlebih dahulu untuk melihat kalibrasinya.' }}
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog :open="isCreateDialogOpen" @update:open="setCreateDialogOpen">
      <DialogContent class="max-w-2xl" :show-close-button="!saving" @close-auto-focus="restoreFocus" @escape-key-down="preventWhileSaving" @interact-outside="preventWhileSaving">
        <DialogHeader>
          <DialogTitle>Buat Kalibrasi Baru</DialogTitle>
          <DialogDescription class="break-words">Unggah gambar chessboard untuk {{ selectedCamera?.name }}.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveCalibration">
          <fieldset :disabled="saving" class="min-w-0 space-y-4">
            <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div class="space-y-2">
                <Label for="calibration-cols">Chessboard Cols</Label>
                <Input id="calibration-cols" v-model="calibForm.chessboard_cols" type="number" required min="3" max="50" step="1" />
              </div>
              <div class="space-y-2">
                <Label for="calibration-rows">Chessboard Rows</Label>
                <Input id="calibration-rows" v-model="calibForm.chessboard_rows" type="number" required min="3" max="50" step="1" />
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div class="space-y-2">
                <Label for="calibration-square">Square Size (meter)</Label>
                <Input id="calibration-square" v-model="calibForm.square_m" type="number" required step="0.001" min="0.001" max="1" />
              </div>
              <div class="space-y-2">
                <Label for="calibration-alpha">Alpha (0-1)</Label>
                <Input id="calibration-alpha" v-model="calibForm.alpha" type="number" required step="0.01" min="0" max="1" />
              </div>
            </div>
            <div class="space-y-2">
              <Label for="calibration-notes">Catatan</Label>
              <Textarea id="calibration-notes" v-model="calibForm.notes" rows="3" placeholder="Catatan opsional tentang kalibrasi ini..." />
            </div>
            <div class="space-y-2">
              <Label for="calibration-files">Gambar chessboard</Label>
              <Input id="calibration-files" type="file" multiple accept="image/*" aria-describedby="calibration-files-help" @change="handleFileUpload" />
              <p id="calibration-files-help" class="text-sm text-muted-foreground">Minimal 10 gambar chessboard valid. Backend memeriksa gambar sebelum membuat kalibrasi.</p>
              <p v-if="uploadedFiles.length" role="status" class="text-sm font-medium">{{ uploadedFiles.length }} file terpilih</p>
              <ul v-if="uploadedFiles.length" aria-label="File terpilih" class="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                <li v-for="(file, index) in uploadedFiles" :key="index" class="break-all">{{ file.name }}</li>
              </ul>
            </div>
          </fieldset>
          <Alert v-if="saveError" variant="destructive">
            <AlertTitle>Gagal membuat kalibrasi</AlertTitle>
            <AlertDescription>{{ saveError }}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" :disabled="saving" @click="setCreateDialogOpen(false)">Batal</Button>
            <Button type="submit" :disabled="saving" :aria-busy="saving">{{ saving ? 'Membuat kalibrasi...' : 'Buat Kalibrasi' }}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="isDeleteDialogOpen" @update:open="setDeleteDialogOpen">
      <AlertDialogContent @close-auto-focus="restoreFocus" @escape-key-down="preventWhileDeleting">
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Kalibrasi?</AlertDialogTitle>
          <AlertDialogDescription class="break-words">Kalibrasi v{{ deletingCalibration?.version }} untuk {{ selectedCamera?.name }} akan dihapus. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
        </AlertDialogHeader>
        <Alert v-if="deleteError" variant="destructive">
          <AlertTitle>Gagal menghapus kalibrasi</AlertTitle>
          <AlertDescription>{{ deleteError }}</AlertDescription>
        </Alert>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">Batal</AlertDialogCancel>
          <Button variant="destructive" :disabled="deleting" :aria-busy="deleting" @click="deleteCalibration">{{ deleting ? 'Menghapus kalibrasi...' : 'Hapus Kalibrasi' }}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/composables/useToast'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { useApiStore } from '@/stores/api'
import { createCalibration as apiCreateCalibration, listCalibrations as apiListCalibrations, activateCalibration as apiActivateCalibration, getUndistortPreview as apiGetUndistortPreview, deleteCalibration as apiDeleteCalibration } from '@/services/calibrations'
import { listCameras } from '@/services/cameras'
import { calibrationPayload, createCalibrationForm } from '@/lib/calibration-form'
import type { CreateCalibrationPayload } from '@/services/calibrations'
import type { Calibration, Camera } from '@/types'

const apiStore = useApiStore()
const toast = useToast()
const isActive = useConnectionScope()
const view = ref<HTMLElement | null>(null)
let dialogTrigger: HTMLElement | null = null
const cameras = ref<Camera[]>([])
const selectedCameraId = ref('')
const selectedCamera = computed(() => cameras.value.find(camera => camera.id === selectedCameraId.value))
const cameraLoading = ref(false)
const cameraError = ref('')
const calibrations = ref<Calibration[]>([])
const loading = ref(false)
const loadError = ref('')
let loadVersion = 0
const saving = ref(false)
const isCreateDialogOpen = ref(false)
const calibForm = ref(createCalibrationForm())
const uploadedFiles = ref<File[]>([])
const saveError = ref('')
const isDeleteDialogOpen = ref(false)
const deletingCalibration = ref<Calibration | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const activatingId = ref('')
const previewingId = ref('')
const actionError = ref<{ title: string; message: string } | null>(null)
const { url: previewUrl, replace: replacePreview, clear: clearPreview } = useObjectUrl()
const previewVersion = ref<number | null>(null)
const busy = computed(() => saving.value || deleting.value || !!activatingId.value || !!previewingId.value)

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Permintaan gagal. Coba kembali.'
}

async function fetchCameras() {
  if (!apiStore.hasApiKey || cameraLoading.value) return
  cameraLoading.value = true
  cameraError.value = ''
  try {
    const response = await listCameras()
    if (!isActive()) return
    cameras.value = response.items
    if (!selectedCameraId.value) selectedCameraId.value = response.items[0]?.id ?? ''
  } catch (error: unknown) {
    if (!isActive()) return
    cameraError.value = errorMessage(error)
  } finally {
    cameraLoading.value = false
  }
}

async function fetchCalibrations() {
  const cameraId = selectedCameraId.value
  const version = ++loadVersion
  calibrations.value = []
  loadError.value = ''
  loading.value = !!cameraId && apiStore.hasApiKey
  if (!loading.value) return
  try {
    const response = await apiListCalibrations(cameraId)
    if (isActive() && version === loadVersion) calibrations.value = response.items
  } catch (error: unknown) {
    if (isActive() && version === loadVersion) loadError.value = errorMessage(error)
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

watch(selectedCameraId, () => {
  actionError.value = null
  clearPreview()
  previewVersion.value = null
  void fetchCalibrations()
})

function handleFileUpload(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement) uploadedFiles.value = Array.from(target.files ?? [])
}

function restoreFocus(event: Event) {
  event.preventDefault()
  const target = dialogTrigger?.isConnected ? dialogTrigger : view.value?.querySelector<HTMLElement>('[data-calibration-create]')
  target?.focus()
}

function openCreateDialog(event: MouseEvent) {
  if (busy.value || !selectedCameraId.value) return
  dialogTrigger = event.currentTarget as HTMLElement
  calibForm.value = createCalibrationForm()
  uploadedFiles.value = []
  saveError.value = ''
  isCreateDialogOpen.value = true
}

function setCreateDialogOpen(open: boolean) {
  if (saving.value) return
  isCreateDialogOpen.value = open
  if (!open) {
    calibForm.value = createCalibrationForm()
    uploadedFiles.value = []
    saveError.value = ''
  }
}

function preventWhileSaving(event: Event) {
  if (saving.value) event.preventDefault()
}

async function saveCalibration() {
  if (busy.value || !selectedCameraId.value) return
  saveError.value = ''
  let payload: CreateCalibrationPayload
  try {
    payload = calibrationPayload(calibForm.value, uploadedFiles.value)
  } catch (error: unknown) {
    saveError.value = errorMessage(error)
    return
  }
  const cameraId = selectedCameraId.value
  saving.value = true
  try {
    await apiCreateCalibration(cameraId, payload)
    if (!isActive()) return
    toast.success('Kalibrasi berhasil dibuat')
  } catch (error: unknown) {
    if (!isActive()) return
    saveError.value = errorMessage(error)
    toast.error('Gagal membuat kalibrasi', { description: saveError.value })
    return
  } finally {
    saving.value = false
  }
  setCreateDialogOpen(false)
  if (cameraId === selectedCameraId.value) await fetchCalibrations()
}

async function activateCalibration(calib: Calibration) {
  if (busy.value || calib.is_active) return
  const cameraId = selectedCameraId.value
  activatingId.value = calib.id
  actionError.value = null
  try {
    await apiActivateCalibration(cameraId, calib.id)
    if (!isActive()) return
    toast.success('Kalibrasi berhasil diaktifkan')
    if (cameraId === selectedCameraId.value) await fetchCalibrations()
  } catch (error: unknown) {
    if (!isActive()) return
    actionError.value = { title: `Gagal mengaktifkan kalibrasi v${calib.version}`, message: errorMessage(error) }
    toast.error(actionError.value.title, { description: actionError.value.message })
  } finally {
    activatingId.value = ''
  }
}

async function viewPreview(calib: Calibration) {
  if (busy.value) return
  previewingId.value = calib.id
  actionError.value = null
  clearPreview()
  const cameraId = selectedCameraId.value
  try {
    const blob = await apiGetUndistortPreview(cameraId, calib.id)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    replacePreview(blob)
    previewVersion.value = calib.version
    window.open(previewUrl.value, '_blank', 'noopener,noreferrer')
  } catch (error: unknown) {
    if (!isActive() || cameraId !== selectedCameraId.value) return
    actionError.value = { title: `Gagal memuat preview kalibrasi v${calib.version}`, message: errorMessage(error) }
    toast.error(actionError.value.title, { description: actionError.value.message })
  } finally {
    previewingId.value = ''
  }
}

function confirmDelete(calib: Calibration, event: MouseEvent) {
  if (busy.value || calib.is_active) return
  dialogTrigger = event.currentTarget as HTMLElement
  deletingCalibration.value = calib
  deleteError.value = ''
  isDeleteDialogOpen.value = true
}

function setDeleteDialogOpen(open: boolean) {
  if (deleting.value) return
  isDeleteDialogOpen.value = open
  if (!open) {
    deletingCalibration.value = null
    deleteError.value = ''
  }
}

function preventWhileDeleting(event: Event) {
  if (deleting.value) event.preventDefault()
}

async function deleteCalibration() {
  if (busy.value || !deletingCalibration.value) return
  const cameraId = selectedCameraId.value
  deleting.value = true
  deleteError.value = ''
  try {
    await apiDeleteCalibration(cameraId, deletingCalibration.value.id)
    if (!isActive()) return
    toast.success('Kalibrasi berhasil dihapus')
  } catch (error: unknown) {
    if (!isActive()) return
    deleteError.value = errorMessage(error)
    toast.error('Gagal menghapus kalibrasi', { description: deleteError.value })
    return
  } finally {
    deleting.value = false
  }
  dialogTrigger = null
  setDeleteDialogOpen(false)
  if (cameraId === selectedCameraId.value) await fetchCalibrations()
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(fetchCameras)
onUnmounted(() => { loadVersion++ })
</script>
