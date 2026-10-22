<template>
  <div ref="view" class="min-w-0 space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold">Manajemen Kalibrasi</h1>
      <div class="flex flex-wrap gap-2">
        <Button data-calibration-capture :disabled="!selectedCameraId || !apiStore.hasApiKey || busy" @click="openCaptureDialog">
          Mulai Capture
        </Button>
        <Button data-calibration-create :disabled="!selectedCameraId || !apiStore.hasApiKey || busy" @click="openCreateDialog">
          Buat Kalibrasi Baru
        </Button>
      </div>
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

    <Dialog :open="isCaptureDialogOpen" @update:open="setCaptureDialogOpen">
      <DialogContent class="max-w-[90vw] max-h-[90vh]" :show-close-button="!captureBusy" @close-auto-focus="restoreCaptureFocus" @escape-key-down="e => { if (captureBusy) e.preventDefault() }">
        <DialogHeader>
          <DialogTitle>Capture Kalibrasi</DialogTitle>
          <DialogDescription class="break-words">
            Ambil gambar chessboard secara otomatis untuk {{ selectedCamera?.name }}. Capture memerlukan stream enabled.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <Alert v-if="captureError" variant="destructive">
            <AlertTitle>Kesalahan Capture</AlertTitle>
            <AlertDescription>{{ captureError }}</AlertDescription>
          </Alert>

          <div v-if="!captureSession" class="space-y-4">
            <fieldset :disabled="captureBusy" class="space-y-4">
              <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
                <div class="space-y-2">
                  <Label for="capture-cols">Chessboard Cols</Label>
                  <Input id="capture-cols" v-model="captureForm.chessboard_cols" type="number" required min="3" max="30" step="1" />
                </div>
                <div class="space-y-2">
                  <Label for="capture-rows">Chessboard Rows</Label>
                  <Input id="capture-rows" v-model="captureForm.chessboard_rows" type="number" required min="3" max="30" step="1" />
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
                <div class="space-y-2">
                  <Label for="capture-square">Square Size (meter)</Label>
                  <Input id="capture-square" v-model="captureForm.square_m" type="number" required step="0.001" min="0.001" max="1" />
                </div>
                <div class="space-y-2">
                  <Label for="capture-interval">Interval (detik)</Label>
                  <Input id="capture-interval" v-model="captureForm.interval_sec" type="number" required min="1" max="60" step="1" />
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
                <div class="space-y-2">
                  <Label for="capture-target">Target Gambar Diterima</Label>
                  <Input id="capture-target" v-model="captureForm.target_images" type="number" required min="1" max="100" step="1" />
                </div>
                <div class="space-y-2">
                  <Label for="capture-duration">Max Durasi (detik)</Label>
                  <Input id="capture-duration" v-model="captureForm.max_duration_sec" type="number" required min="1" max="900" step="1" />
                </div>
              </div>
              <div class="space-y-2">
                <Label for="capture-auto" class="flex items-center gap-2">
                  <input id="capture-auto" type="checkbox" v-model="captureForm.auto_calibrate" class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span>Auto-calibrate setelah capture selesai (hasil tetap inactive)</span>
                </Label>
              </div>
            </fieldset>
            <DialogFooter>
              <Button variant="outline" :disabled="captureBusy" @click="setCaptureDialogOpen(false)">Batal</Button>
              <Button type="button" :disabled="captureBusy" :aria-busy="captureBusy" @click="startCaptureSession">{{ captureBusy ? 'Memulai...' : 'Mulai Capture' }}</Button>
            </DialogFooter>
          </div>

          <div v-else class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="space-y-1 text-sm">
                <span class="text-muted-foreground">Session ID</span>
                <code class="break-all">{{ captureSession.session_id }}</code>
              </div>
              <div class="space-y-1 text-sm">
                <span class="text-muted-foreground">Selection Version</span>
                <span>{{ captureSession.selection_version === 1 ? '1 (accepted frames)' : '0 (legacy stored frames)' }}</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div class="space-y-1"><span class="text-muted-foreground">Status Capture</span> <Badge :variant="isCaptureTerminal(captureSession.status) ? 'secondary' : 'default'">{{ captureSession.status }}</Badge></div>
              <div class="space-y-1"><span class="text-muted-foreground">Attempted</span> <span class="font-medium">{{ captureSession.attempted }}</span></div>
              <div class="space-y-1"><span class="text-muted-foreground">Captured</span> <span class="font-medium">{{ captureSession.captured }}</span></div>
              <div class="space-y-1"><span class="text-muted-foreground">Accepted</span> <span class="font-medium text-green-600">{{ captureSession.accepted }}</span></div>
              <div class="space-y-1"><span class="text-muted-foreground">Rejected</span> <span class="font-medium text-red-600">{{ captureSession.rejected }}</span></div>
              <div class="space-y-1"><span class="text-muted-foreground">Failed Attempts</span> <span class="font-medium">{{ captureSession.failed_attempts }}</span></div>
              <div class="space-y-1"><span class="text-muted-foreground">Status Compute</span> <Badge :variant="isComputeTerminal(captureSession.compute_status) ? 'secondary' : 'default'">{{ captureSession.compute_status }}</Badge></div>
              <div class="space-y-1"><span class="text-muted-foreground">Compute Error</span> <span>{{ captureSession.compute_error_code || '—' }}</span></div>
              <div class="space-y-1"><span class="text-muted-foreground">Resolution</span> <span>{{ captureSession.resolution_w ?? '—' }}x{{ captureSession.resolution_h ?? '—' }}</span></div>
              <div class="space-y-1"><span class="text-muted-foreground">Last Capture</span> <span>{{ captureSession.last_capture_at ? new Date(captureSession.last_capture_at).toLocaleTimeString() : '—' }}</span></div>
            </div>

            <div v-if="captureSession.rejection_counts && Object.keys(captureSession.rejection_counts).length" class="space-y-2">
              <span class="text-sm text-muted-foreground">Rejection counts:</span>
              <div class="flex flex-wrap gap-2">
                <Badge v-for="(count, reason) in captureSession.rejection_counts" :key="reason" variant="secondary">{{ reason }}: {{ count }}</Badge>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex gap-2 flex-wrap">
                <Button variant="outline" :disabled="captureBusy || isCaptureTerminal(captureSession.status)" @click="stopCaptureSession">{{ captureBusy ? 'Menghentikan...' : 'Hentikan Capture' }}</Button>
                <Button :disabled="captureBusy || isComputeTerminal(captureSession.compute_status)" @click="computeCaptureSession">{{ captureBusy ? 'Memulai Compute...' : 'Mulai Compute' }}</Button>
                <Button variant="outline" :disabled="captureBusy" @click="loadCaptureSession">{{ captureBusy ? 'Memuat...' : 'Refresh Status' }}</Button>
              </div>

              <div v-if="captureImages.length || captureLoading" class="space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="font-medium">Gambar Capture ({{ captureImages.length }} dari {{ captureSession.accepted + captureSession.rejected }})</h4>
                  <Button v-if="captureImages.length >= captureLimit" variant="outline" :disabled="captureImageLoading" @click="loadMoreCaptureImages">{{ captureImageLoading ? 'Memuat...' : 'Muat Lebih Banyak' }}</Button>
                </div>
                <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" v-if="captureImages.length">
                  <div v-for="img in captureImages" :key="img.id" class="space-y-1">
                    <div class="relative aspect-square bg-gray-100 rounded overflow-hidden">
                      <Button class="absolute inset-0 p-0 m-0" variant="ghost" :disabled="captureImageLoading" @click="openCaptureImage(img, false)">
                        <span class="sr-only">Buka gambar {{ img.sequence }}</span>
                      </Button>
                      <span class="absolute top-1 right-1 px-1.5 py-0.5 text-xs bg-black/60 text-white rounded">
                        {{ img.quality_status }}
                      </span>
                    </div>
                    <div class="text-xs text-muted-foreground space-y-0.5">
                      <span>Seq: {{ img.sequence }}</span>
                      <span>{{ img.width }}x{{ img.height }}</span>
                      <span v-if="img.sharpness != null">Sharp: {{ img.sharpness.toFixed(1) }}</span>
                      <span v-if="img.rejection_reason" class="text-red-600">{{ img.rejection_reason }}</span>
                      <Button variant="ghost" size="sm" class="w-full mt-1 p-1" :disabled="captureImageLoading" @click="openCaptureImage(img, true)">Preview</Button>
                    </div>
                  </div>
                </div>
                <p v-else class="text-sm text-muted-foreground text-center py-4">Belum ada gambar. Tunggu capture berjalan atau refresh status.</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
import { startCapture, stopCapture, computeCapture, listCaptureImages, getCaptureImageBlob, getCaptureSession, isCaptureTerminal, isComputeTerminal } from '@/services/calibrationCaptures'
import { useCapturePolling } from '@/composables/useCapturePolling'
import type { CreateCalibrationPayload } from '@/services/calibrations'
import type { Calibration, Camera, CaptureCreate, CaptureResponse, CaptureImageResponse } from '@/types'

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
const busy = computed<boolean>(() => saving.value || deleting.value || !!activatingId.value || !!previewingId.value || captureBusy.value)

const captureSession = ref<CaptureResponse | null>(null)
const captureImages = ref<CaptureImageResponse[]>([])
const captureOffset = ref(0)
const captureLimit = 20
const captureLoading = ref(false)
const captureImageLoading = ref(false)
const captureError = ref('')
const captureBusy = ref(false)
const isCaptureDialogOpen = ref(false)
const captureForm = ref<CaptureCreate>({
  chessboard_cols: 9,
  chessboard_rows: 6,
  square_m: 0.025,
  interval_sec: 2,
  target_images: 20,
  max_duration_sec: 300,
  auto_calibrate: false,
})
let captureDialogTrigger: HTMLElement | null = null
let capturePollingStop: (() => void) | null = null

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

function restoreCaptureFocus(event: Event) {
  event.preventDefault()
  const target = captureDialogTrigger?.isConnected ? captureDialogTrigger : view.value?.querySelector<HTMLElement>('[data-calibration-create]')
  target?.focus()
}

function openCaptureDialog(event: MouseEvent) {
  if (captureBusy.value || !selectedCameraId.value) return
  captureDialogTrigger = event.currentTarget as HTMLElement
  captureSession.value = null
  captureImages.value = []
  captureOffset.value = 0
  captureError.value = ''
  isCaptureDialogOpen.value = true
}

function setCaptureDialogOpen(open: boolean) {
  if (captureBusy.value) return
  isCaptureDialogOpen.value = open
  if (!open) {
    captureDialogTrigger = null
    if (capturePollingStop) {
      capturePollingStop()
      capturePollingStop = null
    }
    captureSession.value = null
    captureImages.value = []
    captureOffset.value = 0
    captureError.value = ''
  }
}

async function startCaptureSession() {
  if (captureBusy.value || !selectedCameraId.value) return
  captureBusy.value = true
  captureError.value = ''
  const cameraId = selectedCameraId.value
  try {
    const session = await startCapture(cameraId, captureForm.value)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    captureSession.value = session
    captureOffset.value = 0
    await loadCaptureImages()
    if (capturePollingStop) capturePollingStop()
    const { stop, start } = useCapturePolling({
      cameraId,
      sessionId: session.session_id,
      onUpdate: (data) => {
        if (!isActive()) return
        captureSession.value = data
      },
      onError: (err) => {
        if (!isActive()) return
        captureError.value = err.message
      },
    })
    capturePollingStop = stop
    start()
  } catch (error) {
    if (!isActive()) return
    captureError.value = errorMessage(error)
  } finally {
    captureBusy.value = false
  }
}

async function stopCaptureSession() {
  if (!captureSession.value || captureBusy.value) return
  captureBusy.value = true
  captureError.value = ''
  const cameraId = selectedCameraId.value
  try {
    await stopCapture(cameraId, captureSession.value.session_id)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    toast.success('Capture dihentikan')
    await loadCaptureSession()
    await loadCaptureImages()
  } catch (error) {
    if (!isActive()) return
    captureError.value = errorMessage(error)
  } finally {
    captureBusy.value = false
  }
}

async function computeCaptureSession() {
  if (!captureSession.value || captureBusy.value) return
  captureBusy.value = true
  captureError.value = ''
  const cameraId = selectedCameraId.value
  try {
    await computeCapture(cameraId, captureSession.value.session_id)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    toast.success('Compute dimulai')
    await loadCaptureSession()
  } catch (error) {
    if (!isActive()) return
    captureError.value = errorMessage(error)
  } finally {
    captureBusy.value = false
  }
}

async function loadCaptureSession() {
  if (!captureSession.value) return
  const cameraId = selectedCameraId.value
  try {
    const session = await getCaptureSession(cameraId, captureSession.value.session_id)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    captureSession.value = session
  } catch (error) {
    if (!isActive()) return
    captureError.value = errorMessage(error)
  }
}

async function loadCaptureImages() {
  if (!captureSession.value) return
  captureImageLoading.value = true
  try {
    const response = await listCaptureImages(selectedCameraId.value, captureSession.value.session_id, captureOffset.value, captureLimit)
    if (!isActive()) return
    captureImages.value = response.items
  } catch (error) {
    if (!isActive()) return
    captureError.value = errorMessage(error)
  } finally {
    captureImageLoading.value = false
  }
}

async function loadMoreCaptureImages() {
  if (!captureSession.value || captureImageLoading.value) return
  captureOffset.value += captureLimit
  await loadCaptureImages()
}

async function openCaptureImage(image: CaptureImageResponse, preview = false) {
  if (captureImageLoading.value) return
  captureImageLoading.value = true
  try {
    const blob = await getCaptureImageBlob(selectedCameraId.value, captureSession.value!.session_id, image.id, preview)
    if (!isActive()) return
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  } catch (error) {
    if (!isActive()) return
    captureError.value = errorMessage(error)
  } finally {
    captureImageLoading.value = false
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(fetchCameras)
onUnmounted(() => { loadVersion++ })
</script>
