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
      <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
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

            <!-- Calibration Image for Point Picking -->
            <div v-if="calibImageUrl" class="border border-gray-200 rounded-lg p-4">
              <p class="text-sm font-medium text-gray-900 mb-2">Klik pada gambar untuk memilih titik image (u,v):</p>
              <div class="relative inline-block">
                <img :src="calibImageUrl" @click="pickImagePoint" class="max-w-full h-auto cursor-crosshair border border-gray-300" />
                <div v-for="(pt, idx) in imagePoints" :key="idx" class="absolute w-3 h-3 bg-primary rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-white" :style="{ left: pt.u + 'px', top: pt.v + 'px' }">
                  <span class="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-primary">{{ idx + 1 }}</span>
                </div>
              </div>
              <p class="mt-2 text-xs text-gray-500">{{ imagePoints.length }} titik dipilih (minimal 4)</p>
            </div>
            <div v-else class="text-center text-gray-500 py-4">
              Memuat gambar kalibrasi...
            </div>

            <!-- Point Pairs Table -->
            <div v-if="imagePoints.length > 0" class="border-t pt-4">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Pasangan Titik (Image ↔ Dunia)</h4>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image (u, v)</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dunia (X, Y) [{{ refForm.world_units }}]</th>
                      <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="(pt, idx) in imagePoints" :key="idx" class="hover:bg-gray-50">
                      <td class="px-3 py-2 font-medium text-gray-900">{{ idx + 1 }}</td>
                      <td class="px-3 py-2 text-gray-700 font-mono">{{ pt.u.toFixed(1) }}, {{ pt.v.toFixed(1) }}</td>
                      <td class="px-3 py-2">
                        <div class="flex gap-2">
                          <input :value="getWorldPoint(idx).x" @input="setWorldPointX(idx, ($event.target as HTMLInputElement).valueAsNumber)" type="number" step="0.01" class="w-24 px-2 py-1 border border-gray-300 rounded text-sm" placeholder="X" />
                          <input :value="getWorldPoint(idx).y" @input="setWorldPointY(idx, ($event.target as HTMLInputElement).valueAsNumber)" type="number" step="0.01" class="w-24 px-2 py-1 border border-gray-300 rounded text-sm" placeholder="Y" />
                        </div>
                      </td>
                      <td class="px-3 py-2">
                        <Button variant="ghost" size="sm" @click="removeImagePoint(idx)" class="text-destructive hover:text-destructive/80 p-1">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="imagePoints.length > 0 && imagePoints.length < 4" class="text-amber-600 text-sm">
              Minimal 4 titik diperlukan (saat ini: {{ imagePoints.length }})
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" @click="closeCreateModal">Batal</Button>
            <Button type="submit" variant="primary" :isLoading="saving" :disabled="imagePoints.length < 4 || !worldPointsValid">
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
import { onMounted, ref, computed } from 'vue'
import { listCameras } from '@/services/cameras'
import { listGroundReferences, createGroundReference as apiCreateGroundReference, activateGroundReference as apiActivateGroundReference, getActiveGroundModel as apiGetActiveGroundModel, getBEVPreview as apiGetBEVPreview } from '@/services/groundReferences'
import { getUndistortPreview as apiGetUndistortPreview, getActiveCalibration as apiGetActiveCalibration } from '@/services/calibrations'
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
})

// Point picker state
const calibImageUrl = ref<string | null>(null)
const imagePoints = ref<Array<{ u: number; v: number }>>([])
const worldPoints = ref<Array<{ x: number; y: number }>>([])

// Safe accessor for worldPoints in template
function getWorldPoint(idx: number) {
  return worldPoints.value[idx] || { x: 0, y: 0 }
}

function setWorldPointX(idx: number, val: number) {
  if (worldPoints.value[idx]) worldPoints.value[idx].x = val
}

function setWorldPointY(idx: number, val: number) {
  if (worldPoints.value[idx]) worldPoints.value[idx].y = val
}

const worldPointsValid = computed(() => {
  return worldPoints.value.every(p => p.x !== undefined && p.y !== undefined && !isNaN(p.x) && !isNaN(p.y))
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

const openCreateModal = async () => {
  refForm.value = {
    world_units: 'meter',
    description: '',
  }
  imagePoints.value = []
  worldPoints.value = []
  calibImageUrl.value = null

  // Fetch active calibration for image preview
  if (selectedCameraId.value) {
    try {
      // First get active calibration
      const activeCalib = await apiGetActiveCalibration(selectedCameraId.value)
      if (activeCalib) {
        calibImageUrl.value = await apiGetUndistortPreview(selectedCameraId.value, activeCalib.id)
      }
    } catch {
      // Fallback: no image preview available
      toast.warning('Tidak dapat memuat preview kalibrasi, gunakan input manual')
    }
  }

  isCreateModalOpen.value = true
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
  calibImageUrl.value = null
  imagePoints.value = []
  worldPoints.value = []
}

const pickImagePoint = (event: MouseEvent) => {
  const img = event.currentTarget as HTMLImageElement
  const rect = img.getBoundingClientRect()
  const u = event.clientX - rect.left
  const v = event.clientY - rect.top
  imagePoints.value.push({ u, v })
  worldPoints.value.push({ x: 0, y: 0 })
}

const removeImagePoint = (idx: number) => {
  imagePoints.value.splice(idx, 1)
  worldPoints.value.splice(idx, 1)
}

const saveGroundReference = async () => {
  if (!selectedCameraId.value) return
  if (imagePoints.value.length < 4) {
    toast.warning('Minimal 4 titik diperlukan')
    return
  }
  if (!worldPointsValid.value) {
    toast.warning('Isi semua koordinat dunia (X, Y)')
    return
  }

  // Convert to number[][] for API
  const imagePointsArray = imagePoints.value.map(p => [p.u, p.v])
  const worldPointsArray = worldPoints.value.map(p => [p.x, p.y])

  saving.value = true
  try {
    await apiCreateGroundReference(selectedCameraId.value, {
      image_points: imagePointsArray,
      world_points: worldPointsArray,
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