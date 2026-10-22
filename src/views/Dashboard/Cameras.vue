<template>
  <div ref="view" class="min-w-0 space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold">Manajemen Kamera</h1>
      <Button data-camera-create :disabled="!apiStore.hasApiKey" @click="openCreateDialog">
        Tambah Kamera
      </Button>
    </div>

    <Alert v-if="!apiStore.hasApiKey">
      <AlertTitle>API Key belum diatur</AlertTitle>
      <AlertDescription>
        Atur akses API sebelum memuat atau menambahkan kamera.
        <RouterLink
          to="/dashboard/settings"
          class="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
        >
          Buka Pengaturan
        </RouterLink>
      </AlertDescription>
    </Alert>

    <Card class="min-w-0 gap-0 py-0">
      <CardContent class="min-w-0 p-0">
        <Table aria-label="Daftar kamera">
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead class="text-right">Resolusi</TableHead>
              <TableHead class="text-right">FPS</TableHead>
              <TableHead class="text-right">Lokasi</TableHead>
              <TableHead>Status Kalibrasi</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="6">
                <div role="status" class="space-y-3">
                  <p class="text-muted-foreground">Memuat data kamera...</p>
                  <Skeleton class="h-5 w-full" />
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-else-if="loadError">
              <TableCell colspan="6" class="whitespace-normal">
                <Alert variant="destructive">
                  <AlertTitle>Gagal memuat data kamera</AlertTitle>
                  <AlertDescription>
                    <p>{{ loadError }}</p>
                    <Button
                      variant="outline"
                      class="mt-2 w-fit text-foreground"
                      @click="fetchCameras"
                      >Coba Lagi</Button
                    >
                  </AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
            <TableRow v-for="camera in loadError ? [] : cameras" :key="camera.id">
              <TableCell class="min-w-52 max-w-80 whitespace-normal">
                <div class="break-words font-medium">{{ camera.name }}</div>
                <div class="break-all text-xs text-muted-foreground">{{ camera.id }}</div>
              </TableCell>
              <TableCell class="text-right tabular-nums"
                >{{ camera.resolution_w }}x{{ camera.resolution_h }}</TableCell
              >
              <TableCell class="text-right tabular-nums">{{ camera.fps }}</TableCell>
              <TableCell class="text-right tabular-nums text-muted-foreground">
                {{ camera.latitude?.toFixed(4) ?? '-' }}, {{ camera.longitude?.toFixed(4) ?? '-' }}
              </TableCell>
              <TableCell>
                <Badge v-if="cameraStatuses[camera.id] === 'active'">Kalibrasi aktif</Badge>
                <Badge v-else-if="cameraStatuses[camera.id] === 'loading'" variant="secondary"
                  >Memeriksa...</Badge
                >
                <Badge v-else-if="cameraStatuses[camera.id] === 'error'" variant="destructive"
                  >Gagal diperiksa</Badge
                >
                <Badge v-else variant="secondary">Belum Dikalibrasi</Badge>
              </TableCell>
              <TableCell>
                <div class="flex gap-2">
                  <Button
                    variant="ghost"
                    :aria-label="`Edit ${camera.name}`"
                    @click="editCamera(camera, $event)"
                    >Edit</Button
                  >
                  <Button
                    variant="ghost"
                    class="text-destructive hover:text-destructive"
                    :aria-label="`Hapus ${camera.name}`"
                    @click="confirmDelete(camera, $event)"
                    >Hapus</Button
                  >
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="!loading && !loadError && apiStore.hasApiKey && !cameras.length">
              <TableCell
                colspan="6"
                class="py-8 text-center whitespace-normal text-muted-foreground"
              >
                Belum ada kamera terdaftar. Klik "Tambah Kamera" untuk memulai.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog :open="isCameraDialogOpen" @update:open="setCameraDialogOpen">
      <DialogContent
        :show-close-button="!saving && !removingSource"
        @close-auto-focus="restoreFocus"
        @escape-key-down="preventWhileSaving"
        @interact-outside="preventWhileSaving"
      >
        <DialogHeader>
          <DialogTitle>{{ editingCamera ? 'Edit Kamera' : 'Tambah Kamera Baru' }}</DialogTitle>
          <DialogDescription>Atur identitas, resolusi, dan lokasi kamera.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="saveCamera">
          <fieldset :disabled="saving || removingSource" class="min-w-0 space-y-4">
            <div class="space-y-2">
              <Label for="camera-name">Nama Kamera</Label>
              <Input id="camera-name" v-model="form.name" required maxlength="100" />
            </div>
            <div class="space-y-2">
              <Label for="camera-rtsp">RTSP URL</Label>
              <Input
                id="camera-rtsp"
                v-model="form.rtsp_url"
                type="password"
                autocomplete="new-password"
                spellcheck="false"
                maxlength="500"
                aria-describedby="camera-rtsp-help"
              />
              <p id="camera-rtsp-help" class="text-xs text-muted-foreground">
                {{ editingCamera ? `Sumber ${editingCamera.rtsp_configured ? 'sudah' : 'belum'} dikonfigurasi. Kosong berarti tidak diubah; isi hanya untuk mengganti sumber.` : 'Opsional. URL hanya dikirim ke backend saat disimpan, tidak ditampilkan kembali.' }}
              </p>
              <Button v-if="editingCamera?.rtsp_configured" variant="outline" class="text-destructive" :disabled="saving || removingSource" @click="confirmRemoveSource">Hapus Sumber RTSP</Button>
            </div>
            <div class="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
              <div class="space-y-2">
                <Label for="camera-width">Resolusi W</Label>
                <Input
                  id="camera-width"
                  v-model="form.resolution_w"
                  type="number"
                  required
                  min="1"
                  max="10000"
                  step="1"
                />
              </div>
              <div class="space-y-2">
                <Label for="camera-height">Resolusi H</Label>
                <Input
                  id="camera-height"
                  v-model="form.resolution_h"
                  type="number"
                  required
                  min="1"
                  max="10000"
                  step="1"
                />
              </div>
            </div>
            <div class="space-y-2">
              <Label for="camera-fps">FPS</Label>
              <Input
                id="camera-fps"
                v-model="form.fps"
                type="number"
                required
                min="1"
                max="120"
                step="1"
              />
            </div>
            <div
              class="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2"
              aria-describedby="camera-location-help"
            >
              <div class="space-y-2">
                <Label for="camera-latitude">Latitude</Label>
                <Input
                  id="camera-latitude"
                  v-model="form.latitude"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  aria-describedby="camera-location-help"
                />
              </div>
              <div class="space-y-2">
                <Label for="camera-longitude">Longitude</Label>
                <Input
                  id="camera-longitude"
                  v-model="form.longitude"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  aria-describedby="camera-location-help"
                />
              </div>
            </div>
            <p id="camera-location-help" class="text-xs text-muted-foreground">
              Opsional. Koordinat kosong tidak dikirim.
            </p>
          </fieldset>
          <Alert v-if="saveError" variant="destructive">
            <AlertTitle>Gagal menyimpan kamera</AlertTitle>
            <AlertDescription>{{ saveError }}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" :disabled="saving || removingSource" @click="setCameraDialogOpen(false)"
              >Batal</Button
            >
            <Button type="submit" :disabled="saving || removingSource" :aria-busy="saving">
              {{
                saving
                  ? 'Menyimpan kamera...'
                  : editingCamera
                    ? 'Simpan Perubahan'
                    : 'Tambah Kamera'
              }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="isRemoveSourceDialogOpen" @update:open="value => { if (!removingSource) isRemoveSourceDialogOpen = value }">
      <AlertDialogContent @close-auto-focus="restoreSourceFocus" @escape-key-down="event => { if (removingSource) event.preventDefault() }">
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Sumber RTSP?</AlertDialogTitle>
          <AlertDialogDescription>Sumber untuk {{ editingCamera?.name }} akan dihapus dan stream dinonaktifkan. Draf metadata belum disimpan.</AlertDialogDescription>
        </AlertDialogHeader>
        <Alert v-if="removeSourceError" variant="destructive"><AlertTitle>Gagal menghapus sumber</AlertTitle><AlertDescription>{{ removeSourceError }}</AlertDescription></Alert>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="removingSource">Batal</AlertDialogCancel>
          <Button variant="destructive" :disabled="removingSource" :aria-busy="removingSource" @click="removeSource">{{ removingSource ? 'Menghapus sumber...' : 'Hapus Sumber' }}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="isDeleteDialogOpen" @update:open="setDeleteDialogOpen">
      <AlertDialogContent @close-auto-focus="restoreFocus" @escape-key-down="preventWhileDeleting">
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Kamera?</AlertDialogTitle>
          <AlertDialogDescription class="break-words">
            Kamera "{{ deletingCamera?.name }}" beserta kalibrasi dan job terkait akan dihapus.
            Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert v-if="deleteError" variant="destructive">
          <AlertTitle>Gagal menghapus kamera</AlertTitle>
          <AlertDescription>{{ deleteError }}</AlertDescription>
        </Alert>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">Batal</AlertDialogCancel>
          <Button
            variant="destructive"
            :disabled="deleting"
            :aria-busy="deleting"
            @click="deleteCamera"
          >
            {{ deleting ? 'Menghapus kamera...' : 'Hapus Kamera' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/composables/useToast'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { useApiStore } from '@/stores/api'
import {
  listCameras,
  getCamera,
  createCamera as apiCreateCamera,
  updateCamera as apiUpdateCamera,
  deleteCamera as apiDeleteCamera,
} from '@/services/cameras'
import { cameraPayload, createCameraForm } from '@/lib/camera-form'
import type { Camera } from '@/types'

const apiStore = useApiStore()
const toast = useToast()
const isActive = useConnectionScope()
const view = ref<HTMLElement | null>(null)
let dialogTrigger: HTMLElement | null = null
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
let sourceTrigger: HTMLElement | null = null

function confirmRemoveSource(event: MouseEvent) {
  sourceTrigger = event.currentTarget as HTMLElement
  removeSourceError.value = ''
  isRemoveSourceDialogOpen.value = true
}

function restoreSourceFocus(event: Event) {
  event.preventDefault()
  const target = sourceTrigger?.isConnected ? sourceTrigger : document.getElementById('camera-rtsp')
  target?.focus()
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message
  return 'Permintaan gagal. Coba kembali.'
}

async function fetchCameras() {
  if (!apiStore.hasApiKey || loading.value) return
  loading.value = true
  loadError.value = ''
  try {
    const response = await listCameras()
    if (!isActive()) return
    cameras.value = response.items
    cameraStatuses.value = Object.fromEntries(
      response.items.map((camera) => [camera.id, 'loading']),
    )
  } catch (error: unknown) {
    if (!isActive()) return
    loadError.value = errorMessage(error)
  } finally {
    loading.value = false
  }
  if (loadError.value) return
  for (const camera of cameras.value) {
    if (!isActive()) return
    try {
      const detail = await getCamera(camera.id)
      if (!isActive()) return
      cameraStatuses.value[camera.id] = detail.active_calibration_id ? 'active' : 'none'
    } catch {
      if (!isActive()) return
      cameraStatuses.value[camera.id] = 'error'
    }
  }
}

function restoreFocus(event: Event) {
  event.preventDefault()
  const target = dialogTrigger?.isConnected
    ? dialogTrigger
    : view.value?.querySelector<HTMLElement>('[data-camera-create]')
  target?.focus()
}

function openCreateDialog(event: MouseEvent) {
  dialogTrigger = event.currentTarget as HTMLElement
  editingCamera.value = null
  form.value = createCameraForm()
  saveError.value = ''
  isCameraDialogOpen.value = true
}

function editCamera(camera: Camera, event: MouseEvent) {
  dialogTrigger = event.currentTarget as HTMLElement
  editingCamera.value = camera
  form.value = createCameraForm(camera)
  saveError.value = ''
  isCameraDialogOpen.value = true
}

function setCameraDialogOpen(open: boolean) {
  if (saving.value || removingSource.value || isRemoveSourceDialogOpen.value) return
  isCameraDialogOpen.value = open
  if (!open) {
    editingCamera.value = null
    form.value = createCameraForm()
    saveError.value = ''
  }
}

function preventWhileSaving(event: Event) {
  if (saving.value || removingSource.value || isRemoveSourceDialogOpen.value) event.preventDefault()
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
  setCameraDialogOpen(false)
  await fetchCameras()
}

function confirmDelete(camera: Camera, event: MouseEvent) {
  dialogTrigger = event.currentTarget as HTMLElement
  deletingCamera.value = camera
  deleteError.value = ''
  isDeleteDialogOpen.value = true
}

function setDeleteDialogOpen(open: boolean) {
  if (deleting.value) return
  isDeleteDialogOpen.value = open
  if (!open) {
    deletingCamera.value = null
    deleteError.value = ''
  }
}

function preventWhileDeleting(event: Event) {
  if (deleting.value) event.preventDefault()
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
  dialogTrigger = null
  setDeleteDialogOpen(false)
  await fetchCameras()
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
    toast.success('Sumber RTSP dihapus')
  } catch (error) {
    if (isActive()) removeSourceError.value = errorMessage(error)
  } finally {
    removingSource.value = false
  }
}

onMounted(fetchCameras)
</script>
