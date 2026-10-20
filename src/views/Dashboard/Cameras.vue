<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Manajemen Kamera</h1>
      <Button @click="openCreateModal" variant="primary">
        Tambah Kamera
      </Button>
    </div>

    <!-- Camera Table -->
    <Card>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resolusi</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FPS</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokasi</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Kalibrasi</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="camera in cameras" :key="camera.id" class="hover:bg-gray-50">
              <td class="px-4 py-4">
                <div class="font-medium text-gray-900">{{ camera.name }}</div>
                <div class="text-sm text-gray-500">{{ camera.id }}</div>
              </td>
              <td class="px-4 py-4 text-sm text-gray-900">
                {{ camera.resolution_w }}x{{ camera.resolution_h }}
              </td>
              <td class="px-4 py-4 text-sm text-gray-900">{{ camera.fps }}</td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ camera.latitude?.toFixed(4) ?? '-' }}, {{ camera.longitude?.toFixed(4) ?? '-' }}
              </td>
              <td class="px-4 py-4">
                <span v-if="cameraStatuses[camera.id] === 'active'" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                  Siap
                </span>
                <span v-else-if="cameraStatuses[camera.id] === 'loading'" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                  Memeriksa...
                </span>
                <span v-else class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                  Belum Dikalibrasi
                </span>
              </td>
              <td class="px-4 py-4">
                <div class="flex space-x-2">
                  <Button variant="ghost" size="sm" @click="editCamera(camera)">
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" @click="deleteCamera(camera)"
                    class="text-destructive hover:text-destructive/80">
                    Hapus
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="!cameras.length">
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                Belum ada kamera terdaftar. Klik "Tambah Kamera" untuk memulai.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Create/Edit Modal -->
    <div v-if="isCreateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeCreateModal" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 class="text-lg font-semibold mb-4">{{ editingCamera ? 'Edit Kamera' : 'Tambah Kamera Baru' }}</h2>

        <form @submit.prevent="saveCamera">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Kamera</label>
              <input v-model="form.name" type="text" required
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Contoh: Kamera Utama" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">RTSP URL</label>
              <input v-model="form.rtsp_url" type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="rtsp://user:pass@ip:port/stream" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Resolusi W</label>
                <input v-model="form.resolution_w" type="number" required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="1920" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Resolusi H</label>
                <input v-model="form.resolution_h" type="number" required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="1080" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">FPS</label>
              <input v-model="form.fps" type="number" required
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="15" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input v-model="form.latitude" type="number" step="any"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="-6.9271" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input v-model="form.longitude" type="number" step="any"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="110.4215" />
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" @click="closeCreateModal">Batal</Button>
            <Button type="submit" variant="primary" :isLoading="saving">
              {{ editingCamera ? 'Simpan Perubahan' : 'Tambah Kamera' }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { onMounted, ref } from 'vue'
import { listCameras, getCamera, createCamera as apiCreateCamera, updateCamera as apiUpdateCamera, deleteCamera as apiDeleteCamera } from '@/services/cameras'
import type { Camera, CameraDetail, CreateCameraPayload, UpdateCameraPayload } from '@/types'

const apiStore = useApiStore()
const toast = useToast()

const cameras = ref<Camera[]>([])
const loading = ref(false)
const isCreateModalOpen = ref(false)
const editingCamera = ref<Camera | null>(null)
const saving = ref(false)
const cameraStatuses = ref<Record<string, 'active' | 'none' | 'loading'>>({})

const form = ref<CreateCameraPayload>({
  name: '',
  rtsp_url: '',
  resolution_w: 1920,
  resolution_h: 1080,
  fps: 15,
  latitude: undefined,
  longitude: undefined,
})

const fetchCameras = async () => {
  if (!apiStore.hasApiKey) return
  loading.value = true
  try {
    const response = await listCameras()
    cameras.value = response.items
    // Check calibration status for each camera
    for (const cam of cameras.value) {
      cameraStatuses.value[cam.id] = 'loading'
      try {
        const detail = await getCamera(cam.id)
        cameraStatuses.value[cam.id] = detail.active_calibration_id ? 'active' : 'none'
      } catch {
        cameraStatuses.value[cam.id] = 'none'
      }
    }
  } catch (error) {
    console.error('Failed to fetch cameras:', error)
    toast.error('Gagal memuat data kamera')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  editingCamera.value = null
  form.value = {
    name: '',
    rtsp_url: '',
    resolution_w: 1920,
    resolution_h: 1080,
    fps: 15,
    latitude: undefined,
    longitude: undefined,
  }
  isCreateModalOpen.value = true
}

const editCamera = (camera: Camera) => {
  editingCamera.value = camera
  form.value = {
    name: camera.name,
    rtsp_url: camera.rtsp_url || '',
    resolution_w: camera.resolution_w,
    resolution_h: camera.resolution_h,
    fps: camera.fps,
    latitude: camera.latitude ?? undefined,
    longitude: camera.longitude ?? undefined,
  }
  isCreateModalOpen.value = true
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
  editingCamera.value = null
}

const saveCamera = async () => {
  saving.value = true
  try {
    if (editingCamera.value) {
      const payload: UpdateCameraPayload = {
        name: form.value.name,
        rtsp_url: form.value.rtsp_url || undefined,
        resolution_w: form.value.resolution_w,
        resolution_h: form.value.resolution_h,
        fps: form.value.fps,
        latitude: form.value.latitude,
        longitude: form.value.longitude,
      }
      await apiUpdateCamera(editingCamera.value.id, payload)
      toast.success('Kamera berhasil diperbarui')
    } else {
      await apiCreateCamera(form.value)
      toast.success('Kamera berhasil ditambahkan')
    }
    closeCreateModal()
    await fetchCameras()
  } catch (error: unknown) {
    console.error('Failed to save camera:', error)
    const err = error as { response?: { data?: { detail?: string } }; message?: string }
    toast.error('Gagal menyimpan kamera', {
      description: err.response?.data?.detail || err.message,
    })
  } finally {
    saving.value = false
  }
}

const deleteCamera = async (camera: Camera) => {
  if (confirm(`Apakah Anda yakin ingin menghapus kamera "${camera.name}"?`)) {
    try {
      await apiDeleteCamera(camera.id)
      toast.success('Kamera berhasil dihapus')
      await fetchCameras()
    } catch (error) {
      console.error('Failed to delete camera:', error)
      toast.error('Gagal menghapus kamera')
    }
  }
}

onMounted(async () => {
  if (apiStore.hasApiKey) {
    await fetchCameras()
  }
})
</script>