<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Manajemen Camera</h1>
      <Button @click="showCreateModal = true" variant="primary">
        Tambah Camera
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
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                {{ camera.latitude?.toFixed(4) }}, {{ camera.longitude?.toFixed(4) }}
              </td>
              <td class="px-4 py-4">
                <span
                  :class="camera.has_active_calibration ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ camera.has_active_calibration ? 'Siap' : 'Belum Dikalibrasi' }}
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
                Belum ada camera terdaftar. Klik "Tambah Camera" untuk memulai.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeModal" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 class="text-lg font-semibold mb-4">{{ editingCamera ? 'Edit Camera' : 'Tambah Camera Baru' }}</h2>

        <form @submit.prevent="saveCamera">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nama Camera</label>
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
            <Button variant="secondary" @click="closeModal">Batal</Button>
            <Button type="submit" variant="primary" :isLoading="saving">
              {{ editingCamera ? 'Simpan Perubahan' : 'Tambah Camera' }}
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
import { apiClient } from '@/services/api'
import { useApiStore } from '@/stores/api'
import type { Camera } from '@/types'
import { onMounted, ref } from 'vue'

const apiStore = useApiStore()
const toast = useToast()

const cameras = ref<Camera[]>([])
const loading = ref(false)
const showCreateModal = ref(false)
const editingCamera = ref<Camera | null>(null)
const saving = ref(false)

const form = ref({
  name: '',
  rtsp_url: '',
  resolution_w: 1920,
  resolution_h: 1080,
  fps: 15,
  latitude: 0,
  longitude: 0,
})

const fetchCameras = async () => {
  if (!apiStore.isAuthenticated) return
  loading.value = true
  try {
    const response = await apiClient.get('/cameras')
    cameras.value = response.data.items || response.data || []
  } catch (error) {
    console.error('Failed to fetch cameras:', error)
    toast.error('Gagal memuat data camera')
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
    latitude: 0,
    longitude: 0,
  }
  showCreateModal.value = true
}

const editCamera = (camera: Camera) => {
  editingCamera.value = camera
  form.value = {
    name: camera.name,
    rtsp_url: camera.rtsp_url || '',
    resolution_w: camera.resolution_w,
    resolution_h: camera.resolution_h,
    fps: camera.fps,
    latitude: camera.latitude,
    longitude: camera.longitude,
  }
  showCreateModal.value = true
}

const closeModal = () => {
  showCreateModal.value = false
  editingCamera.value = null
}

const saveCamera = async () => {
  saving.value = true
  try {
    if (editingCamera.value) {
      await apiClient.patch(`/cameras/${editingCamera.value.id}`, form.value)
      toast.success('Camera berhasil diperbarui')
    } else {
      await apiClient.post('/cameras', form.value)
      toast.success('Camera berhasil ditambahkan')
    }
    closeModal()
    await fetchCameras()
  } catch (error: any) {
    console.error('Failed to save camera:', error)
    toast.error('Gagal menyimpan camera', {
      description: error.response?.data?.detail || error.message,
    })
  } finally {
    saving.value = false
  }
}

const deleteCamera = async (camera: Camera) => {
  if (confirm(`Apakah Anda yakin ingin menghapus camera "${camera.name}"?`)) {
    try {
      await apiClient.delete(`/cameras/${camera.id}`)
      toast.success('Camera berhasil dihapus')
      await fetchCameras()
    } catch (error) {
      console.error('Failed to delete camera:', error)
      toast.error('Gagal menghapus camera')
    }
  }
}

onMounted(async () => {
  if (apiStore.isAuthenticated) {
    await fetchCameras()
  }
})
</script>