<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-text">Manajemen Kalibrasi</h1>
      <div class="flex flex-wrap gap-2">
        <Button 
          variant="primary" 
          :disabled="!selectedCameraId || !hasApiKey || busy" 
          @click="openCaptureDialog"
          data-calibration-capture
        >
          <Video class="w-4 h-4" aria-hidden="true" />
          Mulai Capture
        </Button>
        <Button 
          variant="primary" 
          :disabled="!selectedCameraId || !hasApiKey || busy" 
          @click="openCreateDialog"
          data-calibration-create
        >
          <GitCompare class="w-4 h-4" aria-hidden="true" />
          Buat Kalibrasi Baru
        </Button>
      </div>
    </div>

    <div v-if="!hasApiKey" class="card border-warning-border bg-warning-bg/50">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="flex-1">
          <p class="font-medium text-text">API Key belum diatur</p>
          <p class="text-sm text-text-muted mt-1">
            Atur akses API sebelum memuat kamera dan kalibrasi.
            <RouterLink to="/dashboard/settings" class="text-brand underline ml-1">Buka Pengaturan</RouterLink>
          </p>
        </div>
      </div>
    </div>

    <!-- Camera Selector Card -->
    <div v-else class="card">
      <Label for="calibration-camera" class="label">Pilih Kamera</Label>
      <select
        id="calibration-camera"
        v-model="selectedCameraId"
        :disabled="!hasApiKey || cameraLoading || !cameras.length || busy || isCreateDialogOpen || isDeleteDialogOpen"
        class="input"
        aria-describedby="calibration-camera-help"
      >
        <option value="" disabled>Pilih kamera</option>
        <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
          {{ cam.name }} ({{ cam.resolution_w }}×{{ cam.resolution_h }})
        </option>
      </select>
      <p id="calibration-camera-help" class="text-sm text-text-muted mt-1 break-words">
        {{ selectedCamera ? `Kalibrasi untuk ${selectedCamera.name}.` : 'Pilih kamera sebelum membuat kalibrasi.' }}
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

    <!-- Preview URL -->
    <p v-if="previewUrl" role="status" class="text-sm text-text-muted">
      Preview v{{ previewVersion }} siap. Jika tab baru tidak terbuka,
      <a :href="previewUrl" target="_blank" rel="noopener noreferrer" class="text-brand underline">Buka Preview v{{ previewVersion }}</a>.
    </p>

    <!-- Calibrations Table -->
    <div class="card overflow-hidden">
      <div class="table-container">
        <table class="table" aria-label="Daftar kalibrasi">
          <thead>
            <tr>
              <th scope="col">Versi</th>
              <th scope="col" class="numeric">RMS Reprojection</th>
              <th scope="col" class="numeric">Chessboard</th>
              <th scope="col" class="numeric">Square Size</th>
              <th scope="col">Status</th>
              <th scope="col">Dibuat</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7">
                <div class="loading-state" role="status">
                  <div class="spinner" aria-hidden="true" />
                  Memuat kalibrasi...
                </div>
              </td>
            </tr>
            <tr v-else-if="loadError">
              <td colspan="7">
                <div class="error-state" role="alert">
                  <AlertCircle class="w-5 h-5" aria-hidden="true" />
                  <p class="font-medium text-text">Gagal memuat kalibrasi</p>
                  <p class="text-sm text-text-muted">{{ loadError }}</p>
                  <Button variant="outline" @click="fetchCalibrations" class="btn-sm mt-2">Coba Lagi</Button>
                </div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="calib in calibrations" :key="calib.id">
                <td class="font-mono tabular-nums">v{{ calib.version }}</td>
                <td class="numeric tabular-nums">{{ calib.rms_reproj == null ? '-' : `${calib.rms_reproj.toFixed(3)} px` }}</td>
                <td class="numeric tabular-nums text-text-muted">{{ calib.chessboard_cols ?? '-' }}×{{ calib.chessboard_rows ?? '-' }}</td>
                <td class="numeric tabular-nums text-text-muted">{{ calib.square_m == null ? '-' : `${(calib.square_m * 100).toFixed(1)} cm` }}</td>
                <td>
                  <Badge :class="calib.is_active ? 'badge-positive' : 'badge-neutral'">
                    {{ calib.is_active ? 'Aktif' : 'Nonaktif' }}
                  </Badge>
                </td>
                <td class="text-text-muted">{{ formatDate(calib.created_at) }}</td>
                <td>
                  <div class="flex flex-wrap gap-2">
                    <Button 
                      v-if="!calib.is_active" 
                      variant="ghost" 
                      size="sm"
                      :disabled="busy" 
                      :aria-busy="activatingId === calib.id" 
                      :aria-label="`Aktifkan kalibrasi v${calib.version}`" 
                      @click="activateCalibration(calib)"
                    >
                      {{ activatingId === calib.id ? 'Mengaktifkan...' : 'Aktifkan' }}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      :disabled="busy" 
                      :aria-busy="previewingId === calib.id" 
                      :aria-label="`Preview kalibrasi v${calib.version}`" 
                      @click="viewPreview(calib)"
                    >
                      {{ previewingId === calib.id ? 'Memuat preview...' : 'Preview' }}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      class="text-destructive hover:text-destructive" 
                      :disabled="busy || calib.is_active" 
                      :aria-describedby="calib.is_active ? `calibration-delete-help-${calib.id}` : undefined" 
                      :aria-label="`Hapus kalibrasi v${calib.version}`" 
                      @click="confirmDelete(calib)"
                    >
                      Hapus
                    </Button>
                  </div>
                  <p v-if="calib.is_active" :id="`calibration-delete-help-${calib.id}`" class="mt-1 text-xs text-text-muted">Aktifkan versi lain sebelum menghapus.</p>
                </td>
              </tr>
              <tr v-if="!calibrations.length">
                <td colspan="7" class="py-8 text-center text-text-muted">
                  {{ selectedCameraId ? 'Belum ada kalibrasi untuk kamera ini. Klik "Buat Kalibrasi Baru" untuk memulai.' : 'Pilih kamera terlebih dahulu untuk melihat kalibrasinya.' }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Calibration Dialog -->
    <Dialog
      v-model:open="isCreateDialogOpen"
      :show-close-button="!saving"
      :disabled="saving"
      content-class="max-w-2xl"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Kalibrasi Baru</DialogTitle>
          <DialogDescription class="break-words">Unggah gambar chessboard untuk {{ selectedCamera?.name }}.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveCalibration">
          <fieldset :disabled="saving" class="min-w-0 space-y-4">
            <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div class="space-y-2">
                <Label for="calibration-cols">Chessboard Cols</Label>
                <Input id="calibration-cols" v-model.number="calibForm.chessboard_cols" type="number" required min="3" max="50" step="1" class="input" />
              </div>
              <div class="space-y-2">
                <Label for="calibration-rows">Chessboard Rows</Label>
                <Input id="calibration-rows" v-model.number="calibForm.chessboard_rows" type="number" required min="3" max="50" step="1" class="input" />
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <div class="space-y-2">
                <Label for="calibration-square">Square Size (meter)</Label>
                <Input id="calibration-square" v-model.number="calibForm.square_m" type="number" required step="0.001" min="0.001" max="1" class="input" />
              </div>
              <div class="space-y-2">
                <Label for="calibration-alpha">Alpha (0-1)</Label>
                <Input id="calibration-alpha" v-model.number="calibForm.alpha" type="number" required step="0.01" min="0" max="1" class="input" />
              </div>
            </div>
            <div class="space-y-2">
              <Label for="calibration-notes">Catatan</Label>
              <textarea id="calibration-notes" v-model="calibForm.notes" rows="3" placeholder="Catatan opsional tentang kalibrasi ini..." class="input min-h-[80px] resize-y" />
            </div>
            <div class="space-y-2">
              <Label for="calibration-files">Gambar chessboard</Label>
              <input id="calibration-files" type="file" multiple accept="image/*" aria-describedby="calibration-files-help" @change="handleFileUpload" class="input" />
              <p id="calibration-files-help" class="text-sm text-text-muted">Minimal 10 gambar chessboard valid. Backend memeriksa gambar sebelum membuat kalibrasi.</p>
              <p v-if="uploadedFiles.length" role="status" class="text-sm font-medium">{{ uploadedFiles.length }} file terpilih</p>
              <ul v-if="uploadedFiles.length" aria-label="File terpilih" class="max-h-32 space-y-1 overflow-y-auto text-xs text-text-muted">
                <li v-for="(file, index) in uploadedFiles" :key="index" class="break-all">{{ file.name }}</li>
              </ul>
            </div>
          </fieldset>
          <div v-if="saveError" class="error-state" role="alert">
            <AlertCircle class="w-5 h-5" aria-hidden="true" />
            <p class="font-medium text-text">Gagal membuat kalibrasi</p>
            <p class="text-sm text-text-muted">{{ saveError }}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" :disabled="saving" @click="isCreateDialogOpen = false">Batal</Button>
            <Button type="submit" :disabled="saving" :aria-busy="saving" variant="primary">
              {{ saving ? 'Membuat kalibrasi...' : 'Buat Kalibrasi' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Delete Calibration Dialog -->
    <Dialog
      v-model:open="isDeleteDialogOpen"
      role="alertdialog"
      :show-close-button="!deleting"
      :disabled="deleting"
      content-class="max-w-md"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Kalibrasi?</DialogTitle>
          <DialogDescription class="break-words">Kalibrasi v{{ deletingCalibration?.version }} untuk {{ selectedCamera?.name }} akan dihapus. Tindakan ini tidak dapat dibatalkan.</DialogDescription>
        </DialogHeader>
        <div v-if="deleteError" class="error-state" role="alert">
          <AlertCircle class="w-5 h-5" aria-hidden="true" />
          <p class="font-medium text-text">Gagal menghapus kalibrasi</p>
          <p class="text-sm text-text-muted">{{ deleteError }}</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" :disabled="deleting" @click="isDeleteDialogOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="deleting" :aria-busy="deleting" @click="deleteCalibration">
            {{ deleting ? 'Menghapus kalibrasi...' : 'Hapus Kalibrasi' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Capture Dialog -->
    <Dialog
      :open="isCaptureDialogOpen"
      :show-close-button="!captureBusy"
      :disabled="captureBusy"
      content-class="max-w-[min(90vw,64rem)]"
      @update:open="setCaptureDialogOpen"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capture Kalibrasi</DialogTitle>
          <DialogDescription class="break-words">Ambil gambar chessboard secara otomatis untuk {{ selectedCamera?.name }}. Capture memerlukan stream enabled.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div v-if="captureError" class="error-state" role="alert">
            <AlertCircle class="w-5 h-5" aria-hidden="true" />
            <p class="font-medium text-text">Kesalahan Capture</p>
            <p class="text-sm text-text-muted">{{ captureError }}</p>
          </div>

          <div v-if="!captureSession" class="space-y-4">
            <fieldset :disabled="captureBusy" class="space-y-4">
              <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
                <div class="space-y-2">
                  <Label for="capture-cols">Chessboard Cols</Label>
                  <Input id="capture-cols" v-model="captureForm.chessboard_cols" type="number" required min="3" max="30" step="1" class="input" />
                </div>
                <div class="space-y-2">
                  <Label for="capture-rows">Chessboard Rows</Label>
                  <Input id="capture-rows" v-model="captureForm.chessboard_rows" type="number" required min="3" max="30" step="1" class="input" />
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
                <div class="space-y-2">
                  <Label for="capture-square">Square Size (meter)</Label>
                  <Input id="capture-square" v-model="captureForm.square_m" type="number" required step="0.001" min="0.001" max="1" class="input" />
                </div>
                <div class="space-y-2">
                  <Label for="capture-interval">Interval (detik)</Label>
                  <Input id="capture-interval" v-model="captureForm.interval_sec" type="number" required min="1" max="60" step="1" class="input" />
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
                <div class="space-y-2">
                  <Label for="capture-target">Target Gambar Diterima</Label>
                  <Input id="capture-target" v-model="captureForm.target_images" type="number" required min="1" max="100" step="1" class="input" />
                </div>
                <div class="space-y-2">
                  <Label for="capture-duration">Max Durasi (detik)</Label>
                  <Input id="capture-duration" v-model="captureForm.max_duration_sec" type="number" required min="1" max="900" step="1" class="input" />
                </div>
              </div>
              <div class="space-y-2">
                <Label for="capture-auto" class="flex items-center gap-2 cursor-pointer">
                  <input id="capture-auto" type="checkbox" v-model="captureForm.auto_calibrate" class="h-4 w-4 rounded border-control text-brand focus:ring-brand" />
                  <span>Auto-calibrate setelah capture selesai (hasil tetap inactive)</span>
                </Label>
              </div>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="secondary" :disabled="captureBusy" @click="isCaptureDialogOpen = false">Batal</Button>
              <Button type="button" :disabled="captureBusy" :aria-busy="captureBusy" @click="startCaptureSession" variant="primary">
                {{ captureBusy ? 'Memulai...' : 'Mulai Capture' }}
              </Button>
            </DialogFooter>
          </div>

          <div v-else class="space-y-4">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="space-y-1 text-sm">
                <span class="text-text-muted">Session ID</span>
                <code class="break-all font-mono">{{ captureSession.session_id }}</code>
              </div>
              <div class="space-y-1 text-sm">
                <span class="text-text-muted">Selection Version</span>
                <span>{{ captureSession.selection_version === 1 ? '1 (accepted frames)' : '0 (legacy stored frames)' }}</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div class="space-y-1"><span class="text-text-muted">Status Capture</span> <Badge :class="isCaptureTerminal(captureSession.status) ? 'badge-neutral' : 'badge-positive'">{{ captureSession.status }}</Badge></div>
              <div class="space-y-1"><span class="text-text-muted">Attempted</span> <span class="font-medium">{{ captureSession.attempted }}</span></div>
              <div class="space-y-1"><span class="text-text-muted">Captured</span> <span class="font-medium">{{ captureSession.captured }}</span></div>
              <div class="space-y-1"><span class="text-text-muted">Accepted</span> <span class="font-medium text-positive">{{ captureSession.accepted }}</span></div>
              <div class="space-y-1"><span class="text-text-muted">Rejected</span> <span class="font-medium text-negative">{{ captureSession.rejected }}</span></div>
              <div class="space-y-1"><span class="text-text-muted">Failed Attempts</span> <span class="font-medium">{{ captureSession.failed_attempts }}</span></div>
              <div class="space-y-1"><span class="text-text-muted">Status Compute</span> <Badge :class="isComputeTerminal(captureSession.compute_status) ? 'badge-neutral' : 'badge-positive'">{{ captureSession.compute_status }}</Badge></div>
              <div class="space-y-1"><span class="text-text-muted">Compute Error</span> <span>{{ captureSession.compute_error_code || '-' }}</span></div>
              <div class="space-y-1"><span class="text-text-muted">Resolution</span> <span>{{ captureSession.resolution_w ?? '-' }}×{{ captureSession.resolution_h ?? '-' }}</span></div>
              <div class="space-y-1"><span class="text-text-muted">Last Capture</span> <span>{{ captureSession.last_capture_at ? new Date(captureSession.last_capture_at).toLocaleTimeString() : '-' }}</span></div>
            </div>

            <div v-if="captureSession.rejection_counts && Object.keys(captureSession.rejection_counts).length" class="space-y-2">
              <span class="text-sm text-text-muted">Rejection counts:</span>
              <div class="flex flex-wrap gap-2">
                <Badge v-for="(count, reason) in captureSession.rejection_counts" :key="reason" variant="neutral">{{ reason }}: {{ count }}</Badge>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex flex-wrap gap-2">
                <Button variant="outline" :disabled="captureBusy || isCaptureTerminal(captureSession.status)" @click="stopCaptureSession">{{ captureBusy ? 'Menghentikan...' : 'Hentikan Capture' }}</Button>
                <Button :disabled="captureBusy || isComputeTerminal(captureSession.compute_status)" @click="computeCaptureSession" variant="primary">{{ captureBusy ? 'Memulai Compute...' : 'Mulai Compute' }}</Button>
                <Button type="button" variant="outline" :disabled="captureBusy" @click="refreshCapture">{{ captureBusy ? 'Memuat...' : 'Refresh Status' }}</Button>
              </div>

              <div v-if="captureImages.length || captureImageLoading" class="space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="font-medium text-text">Gambar Capture ({{ captureImages.length }} dari {{ captureTotal }})</h4>
                  <Button v-if="captureImages.length < captureTotal" type="button" variant="outline" :disabled="captureImageLoading" @click="loadMoreCaptureImages">{{ captureImageLoading ? 'Memuat...' : 'Muat Lebih Banyak' }}</Button>
                </div>
                <div v-if="captureImages.length" class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  <div v-for="img in captureImages" :key="img.id" class="space-y-1">
                    <Button
                      type="button"
                      variant="ghost"
                      class="relative aspect-square h-auto w-full overflow-hidden p-0"
                      :disabled="captureImageLoading"
                      :aria-label="`Buka gambar urutan ${img.sequence}`"
                      @click="openCaptureImage(img, false)"
                    >
                      <CaptureImageThumbnail
                        :camera-id="selectedCameraId"
                        :session-id="captureSession.session_id"
                        :image-id="img.id"
                        :alt="`Gambar capture urutan ${img.sequence}`"
                        class="absolute inset-0"
                      />
                      <span class="absolute right-1 top-1 z-10 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">{{ img.quality_status }}</span>
                    </Button>
                    <div class="space-y-0.5 text-xs text-text-muted">
                      <span>Urutan: {{ img.sequence }}</span>
                      <span>{{ img.width }}×{{ img.height }}</span>
                      <span v-if="img.sharpness != null">Ketajaman: {{ img.sharpness.toFixed(1) }}</span>
                      <span v-if="img.rejection_reason" class="text-negative">{{ img.rejection_reason }}</span>
                      <Button type="button" variant="ghost" size="sm" class="mt-1 w-full p-1" :disabled="captureImageLoading" @click="openCaptureImage(img, true)">Preview</Button>
                    </div>
                  </div>
                </div>
                <p v-else class="py-4 text-center text-sm text-text-muted">Belum ada gambar. Tunggu capture berjalan atau refresh status.</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { useCapturePolling } from '@/composables/useCapturePolling'
import { useApiStore } from '@/stores/api'
import { createCalibrationForm, calibrationPayload, type CalibrationForm } from '@/lib/calibration-form'
import type { CreateCalibrationPayload } from '@/services/calibrations'
import type { Calibration, Camera, CaptureCreate, CaptureResponse, CaptureImageResponse } from '@/types'
import {
  createCalibration as apiCreateCalibration,
  listCalibrations as apiListCalibrations,
  activateCalibration as apiActivateCalibration,
  getUndistortPreview as apiGetUndistortPreview,
  deleteCalibration as apiDeleteCalibration
} from '@/services/calibrations'
import { listCameras } from '@/services/cameras'
import {
  startCapture,
  stopCapture,
  computeCapture,
  listCaptureImages,
  getCaptureImageBlob,
  getCaptureSession,
  isCaptureTerminal,
  isComputeTerminal
} from '@/services/calibrationCaptures'

// UI Components
import { Button, Input, Textarea, Label, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui'

import { Video, GitCompare, AlertCircle } from '@lucide/vue'
import CaptureImageThumbnail from '@/components/media/CaptureImageThumbnail.vue'

const apiStore = useApiStore()
const toast = useToast()
const isActive = useConnectionScope()
const route = useRoute()
const router = useRouter()

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
const calibForm = ref<CalibrationForm>(createCalibrationForm())
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
const hasApiKey = computed(() => apiStore.hasApiKey)
const busy = computed(() => saving.value || deleting.value || !!activatingId.value || !!previewingId.value || captureBusy.value)

const captureSession = ref<CaptureResponse | null>(null)
const captureImages = ref<CaptureImageResponse[]>([])
const captureTotal = ref(0)
const captureLimit = 20
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

watch(selectedCameraId, (value) => {
  actionError.value = null
  clearPreview()
  previewVersion.value = null
  fetchCalibrations()

  if (value && route.query.camera !== value) {
    void router.replace({ query: { ...route.query, camera: value } })
  }
})

function handleFileUpload(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement) uploadedFiles.value = Array.from(target.files ?? [])
}

function openCreateDialog() {
  if (busy.value || !selectedCameraId.value) return
  calibForm.value = createCalibrationForm()
  uploadedFiles.value = []
  saveError.value = ''
  isCreateDialogOpen.value = true
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
  isCreateDialogOpen.value = false
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
    const url = replacePreview(blob)
    previewVersion.value = calib.version
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error: unknown) {
    if (!isActive() || cameraId !== selectedCameraId.value) return
    actionError.value = { title: `Gagal memuat preview kalibrasi v${calib.version}`, message: errorMessage(error) }
    toast.error(actionError.value.title, { description: actionError.value.message })
  } finally {
    previewingId.value = ''
  }
}

function confirmDelete(calib: Calibration) {
  if (busy.value || calib.is_active) return
  deletingCalibration.value = calib
  deleteError.value = ''
  isDeleteDialogOpen.value = true
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
  isDeleteDialogOpen.value = false
  if (cameraId === selectedCameraId.value) await fetchCalibrations()
  await nextTick()
  document.querySelector<HTMLElement>('[data-calibration-create]')?.focus()
}

function openCaptureDialog() {
  if (captureBusy.value || !selectedCameraId.value) return
  captureSession.value = null
  captureImages.value = []
  captureTotal.value = 0
  captureError.value = ''
  isCaptureDialogOpen.value = true
}

function setCaptureDialogOpen(open: boolean) {
  if (captureBusy.value) return
  isCaptureDialogOpen.value = open
  if (!open) {
    if (capturePollingStop) {
      capturePollingStop()
      capturePollingStop = null
    }
    captureSession.value = null
    captureImages.value = []
    captureTotal.value = 0
    captureError.value = ''
  }
}

async function startCaptureSession() {
  if (captureBusy.value || !selectedCameraId.value) return
  const payload = {
    ...captureForm.value,
    chessboard_cols: Number(captureForm.value.chessboard_cols),
    chessboard_rows: Number(captureForm.value.chessboard_rows),
    square_m: Number(captureForm.value.square_m),
    interval_sec: Number(captureForm.value.interval_sec),
    target_images: Number(captureForm.value.target_images),
    max_duration_sec: Number(captureForm.value.max_duration_sec),
  }
  if (Object.values(payload).some(value => typeof value === 'number' && !Number.isFinite(value))) {
    captureError.value = 'Isi semua parameter capture dengan angka yang valid.'
    return
  }

  captureBusy.value = true
  captureError.value = ''
  const cameraId = selectedCameraId.value
  try {
    const session = await startCapture(cameraId, payload)
    if (!isActive() || cameraId !== selectedCameraId.value) return
    captureSession.value = session
    captureTotal.value = 0
    await loadCaptureImages(false)
    if (capturePollingStop) capturePollingStop()
    const { stop, start } = useCapturePolling({
      cameraId,
      sessionId: session.session_id,
      onUpdate: (data) => {
        if (!isActive()) return
        const previousTotal = captureSession.value
          ? captureSession.value.accepted + captureSession.value.rejected
          : 0
        captureSession.value = data
        const nextTotal = data.accepted + data.rejected
        if (nextTotal !== previousTotal && !captureImageLoading.value) {
          void loadCaptureImages(false)
        }
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

async function refreshCapture() {
  await loadCaptureSession()
  await loadCaptureImages(false)
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

async function loadCaptureImages(append = false) {
  const activeSession = captureSession.value
  if (!activeSession) return

  const cameraId = selectedCameraId.value
  const sessionId = activeSession.session_id
  captureImageLoading.value = true
  try {
    const offset = append ? captureImages.value.length : 0
    const response = await listCaptureImages(cameraId, sessionId, offset, captureLimit)
    if (!isActive() || cameraId !== selectedCameraId.value || sessionId !== captureSession.value?.session_id) return

    const items = append ? [...captureImages.value, ...response.items] : response.items
    const uniqueImages = new Map(items.map(image => [image.id, image]))
    captureImages.value = Array.from(uniqueImages.values())
    captureTotal.value = response.total
  } catch (error) {
    if (!isActive()) return
    captureError.value = errorMessage(error)
  } finally {
    captureImageLoading.value = false
  }
}

async function loadMoreCaptureImages() {
  if (!captureSession.value || captureImageLoading.value) return
  if (captureImages.value.length >= captureTotal.value) return
  await loadCaptureImages(true)
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
onUnmounted(() => {
  loadVersion++
  if (capturePollingStop) {
    capturePollingStop()
    capturePollingStop = null
  }
})
</script>