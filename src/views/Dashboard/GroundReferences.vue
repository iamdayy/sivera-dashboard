<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Referensi Tanah</h1>
      <Button @click="openCreateModal" variant="primary" :disabled="!selectedCameraId">
        Tambah Referensi Baru
      </Button>
    </div>

    <!-- Camera Selector -->
    <Card class="p-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Camera</label>
      <select v-model="selectedCameraId" @change="fetchGroundReferences"
        class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary">
        <option value="">-- Pilih Camera --</option>
        <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
          {{ cam.name }} ({{ cam.resolution_w }}x{{ cam.resolution_h }})
        </option>
      </select>
      <p v-if="selectedCameraId" class="mt-2 text-sm text-gray-500">
        Menampilkan referensi tanah untuk camera terpilih
      </p>
    </Card>

    <!-- Ground Reference List -->
    <Card>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Versi</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Titik</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satuan</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="ref in groundReferences" :key="ref.id" class="hover:bg-gray-50">
              <td class="px-4 py-4 font-medium text-gray-900">v{{ ref.version }}</td>
              <td class="px-4 py-4 text-sm text-gray-900">
                {{ ref.image_points?.length || 0 }} titik
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">{{ ref.world_units }}</td>
              <td class="px-4 py-4">
                <span :class="ref.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ ref.is_active ? 'Aktif' : 'Non-Aktif' }}
                </span>
              </td>
              <td class="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">
                {{ ref.description || '-' }}
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ formatDate(ref.created_at) }}
              </td>
              <td class="px-4 py-4">
                <div class="flex space-x-2">
                  <Button v-if="!ref.is_active" variant="ghost" size="sm" @click="activateReference(ref.id)">
                    Aktifkan
                  </Button>
                  <Button variant="ghost" size="sm" @click="viewGroundModel(ref.id)">
                    Model Ground
                  </Button>
                  <Button variant="ghost" size="sm" @click="viewBevPreview(ref.id)">
                    BEV Preview
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="!groundReferences.length && selectedCameraId">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                Belum ada referensi tanah untuk camera ini. Klik "Tambah Referensi Baru" untuk memulai.
              </td>
            </tr>
            <tr v-if="!selectedCameraId">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                Pilih camera terlebih dahulu untuk melihat referensi tanahnya.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Create Ground Reference Modal -->
    <div v-if="isCreateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeCreateModal" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold mb-4">Tambah Referensi Tanah Baru</h2>

        <form @submit.prevent="saveGroundReference">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Satuan Dunia</label>
              <select v-model="refForm.world_units"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="meter">Meter</option>
                <option value="metre">Metre</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea v-model="refForm.description" rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Catatan opsional tentang referensi ini..." />
            </div>

            <div class="border border-dashed border-gray-300 rounded-lg p-4">
              <p class="text-sm text-gray-600 mb-2">
                Titik Image (format: [[u1,v1], [u2,v2], ...]):<br />
                <span class="text-xs text-gray-400">Contoh: [[100,200], [300,400], [500,600], [700,800]]</span>
              </p>
              <textarea v-model="refForm.image_points_json" rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                placeholder="[[u1,v1], [u2,v2], [u3,v3], [u4,v4]]" />
            </div>

            <div class="border border-dashed border-gray-300 rounded-lg p-4">
              <p class="text-sm text-gray-600 mb-2">
                Titik Dunia (format: [[X1,Y1], [X2,Y2], ...]):<br />
                <span class="text-xs text-gray-400">Contoh: [[0,0], [10,0], [10,10], [0,10]]</span>
              </p>
              <textarea v-model="refForm.world_points_json" rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                placeholder="[[X1,Y1], [X2,Y2], [X3,Y3], [X4,Y4]]" />
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" @click="closeCreateModal">Batal</Button>
            <Button type="submit" variant="primary" :isLoading="saving">
              Simpan Referensi
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
import { listCameras } from '@/services/cameras'
import { listGroundReferences, createGroundReference as apiCreateGroundReference, activateGroundReference as apiActivateGroundReference, getActiveGroundModel as apiGetActiveGroundModel, getBEVPreview as apiGetBEVPreview } from '@/services/groundReferences'
import type { Camera, GroundReference } from '@/types'

const apiStore = useApiStore()
const toast = useToast()

const cameras = ref<Camera[]>([])
const groundReferences = ref<GroundReference[]>([])
const selectedCameraId = ref('')
const loading = ref(false)
const isCreateModalOpen = ref(false)
const saving = ref(false)

const refForm = ref({
  world_units: 'meter',
  description: '',
  image_points_json: '',
  world_points_json: '',
})

const fetchCameras = async () => {
  if (!apiStore.hasApiKey) return
  try {
    const response = await listCameras()
    cameras.value = response.items
    if (cameras.value.length > 0 && !selectedCameraId.value) {
      selectedCameraId.value = cameras.value[0]!.id
    }
  } catch (error) {
    console.error('Failed to fetch cameras:', error)
    toast.error('Gagal memuat data kamera')
  }
}

const fetchGroundReferences = async () => {
  if (!selectedCameraId.value || !apiStore.hasApiKey) return
  loading.value = true
  try {
    const response = await listGroundReferences(selectedCameraId.value)
    groundReferences.value = response.items
  } catch (error) {
    console.error('Failed to fetch ground references:', error)
    toast.error('Gagal memuat data referensi tanah')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  refForm.value = {
    world_units: 'meter',
    description: '',
    image_points_json: '',
    world_points_json: '',
  }
  isCreateModalOpen.value = true
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
}

const saveGroundReference = async () => {
  if (!selectedCameraId.value) return

  let imagePoints, worldPoints
  try {
    imagePoints = JSON.parse(refForm.value.image_points_json)
    worldPoints = JSON.parse(refForm.value.world_points_json)
  } catch (e) {
    toast.error('Format JSON tidak valid')
    return
  }

  if (imagePoints.length !== worldPoints.length) {
    toast.error('Jumlah titik image dan dunia harus sama')
    return
  }

  if (imagePoints.length < 4) {
    toast.warning('Minimal 4 titik diperlukan')
    return
  }

  saving.value = true
  try {
    await apiCreateGroundReference(selectedCameraId.value, {
      image_points: imagePoints,
      world_points: worldPoints,
      world_units: refForm.value.world_units as 'meter' | 'metre',
      description: refForm.value.description || undefined,
    })
    toast.success('Referensi tanah berhasil dibuat')
    closeCreateModal()
    await fetchGroundReferences()
  } catch (error: unknown) {
    console.error('Failed to create ground reference:', error)
    const err = error as { response?: { data?: { detail?: string } }; message?: string }
    toast.error('Gagal membuat referensi tanah', {
      description: err.response?.data?.detail || err.message,
    })
  } finally {
    saving.value = false
  }
}

const activateReference = async (refId: string) => {
  try {
    await apiActivateGroundReference(selectedCameraId.value, refId)
    toast.success('Referensi tanah berhasil diaktifkan')
    await fetchGroundReferences()
  } catch (error) {
    console.error('Failed to activate ground reference:', error)
    toast.error('Gagal mengaktifkan referensi tanah')
  }
}

const viewGroundModel = async (refId: string) => {
  try {
    const model = await apiGetActiveGroundModel(selectedCameraId.value)
    toast.info('Model Ground Aktif', {
      description: `ID: ${model.id}, Versi: ${model.ground_ref_id}`,
    })
  } catch (error) {
    console.error('Failed to get ground model:', error)
    toast.error('Gagal memuat ground model')
  }
}

const viewBevPreview = async (refId: string) => {
  try {
    const preview = await apiGetBEVPreview(selectedCameraId.value, refId)
    toast.info('BEV Preview tersedia', {
      description: `Buka: ${preview.bev_image_url}`,
    })
  } catch (error) {
    console.error('Failed to get BEV preview:', error)
    toast.error('Gagal memuat BEV preview')
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(async () => {
  if (apiStore.hasApiKey) {
    await fetchCameras()
  }
})
</script>