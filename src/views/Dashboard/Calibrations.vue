<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Manajemen Kalibrasi</h1>
      <Button @click="openModal" variant="primary" :disabled="!selectedCameraId">
        Buat Kalibrasi Baru
      </Button>
    </div>

    <!-- Camera Selector -->
    <Card class="p-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Camera</label>
      <select v-model="selectedCameraId" @change="fetchCalibrations"
        class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary">
        <option value="">-- Pilih Camera --</option>
        <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
          {{ cam.name }} ({{ cam.resolution_w }}x{{ cam.resolution_h }})
        </option>
      </select>
      <p v-if="selectedCameraId" class="mt-2 text-sm text-gray-500">
        Menampilkan kalibrasi untuk camera terpilih
      </p>
    </Card>

    <!-- Calibration List -->
    <Card>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Versi</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMS
                Reprojection</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chessboard</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Square Size
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="calib in calibrations" :key="calib.id" class="hover:bg-gray-50">
              <td class="px-4 py-4 font-medium text-gray-900">v{{ calib.version }}</td>
              <td class="px-4 py-4 text-sm text-gray-900">
                {{ calib.rms_reproj ? calib.rms_reproj.toFixed(3) + ' px' : 'N/A' }}
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ calib.chessboard_cols }}x{{ calib.chessboard_rows }}
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ calib.square_m ? calib.square_m * 100 + ' cm' : 'N/A' }}
              </td>
              <td class="px-4 py-4">
                <span :class="calib.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ calib.is_active ? 'Aktif' : 'Non-Aktif' }}
                </span>
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ formatDate(calib.created_at) }}
              </td>
              <td class="px-4 py-4">
                <div class="flex space-x-2">
                  <Button v-if="!calib.is_active" variant="ghost" size="sm" @click="activateCalibration(calib.id)">
                    Aktifkan
                  </Button>
                  <Button variant="ghost" size="sm" @click="viewPreview(calib.id)">
                    Preview
                  </Button>
                  <Button variant="ghost" size="sm" @click="deleteCalibration(calib.id)"
                    class="text-destructive hover:text-destructive/80">
                    Hapus
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="!calibrations.length && selectedCameraId">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                Belum ada kalibrasi untuk camera ini. Klik "Buat Kalibrasi Baru" untuk memulai.
              </td>
            </tr>
            <tr v-if="!selectedCameraId">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                Pilih camera terlebih dahulu untuk melihat kalibrasinya.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Create Calibration Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeModal" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold mb-4">Buat Kalibrasi Baru</h2>

        <form @submit.prevent="saveCalibration">
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Chessboard Cols</label>
                <input v-model="calibForm.chessboard_cols" type="number" required min="3" max="50"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Chessboard Rows</label>
                <input v-model="calibForm.chessboard_rows" type="number" required min="3" max="50"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Square Size (meter)</label>
                <input v-model="calibForm.square_m" type="number" required step="0.001" min="0.001" max="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Alpha (0-1)</label>
                <input v-model="calibForm.alpha" type="number" step="0.01" min="0" max="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
              <textarea v-model="calibForm.notes" rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Catatan opsional tentang kalibrasi ini..." />
            </div>

            <div class="border border-dashed border-gray-300 rounded-lg p-4">
              <p class="text-sm text-gray-600 mb-2">Upload gambar chessboard (minimal 10 gambar):</p>
              <input type="file" multiple accept="image/*" @change="handleFileUpload" class="w-full text-sm" />
              <div v-if="uploadedFiles.length > 0" class="mt-2">
                <p class="text-sm font-medium text-gray-900">{{ uploadedFiles.length }} file terpilih</p>
                <div class="flex flex-wrap gap-2 mt-1">
                  <span v-for="file in uploadedFiles" :key="file.name"
                    class="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                    {{ file.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" @click="closeModal">Batal</Button>
            <Button type="submit" variant="primary" :isLoading="saving">
              Buat Kalibrasi
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
import { useModal } from '@/composables/useModal'
import { useToast } from '@/composables/useToast'
import { apiClient } from '@/services/api'
import { useApiStore } from '@/stores/api'
import { onMounted, ref } from 'vue'

const apiStore = useApiStore()
const toast = useToast()
const { isOpen, openModal, closeModal } = useModal()

import type { Calibration, Camera } from '@/types'

const cameras = ref<Camera[]>([])
const calibrations = ref<Calibration[]>([])
const selectedCameraId = ref('')
const loading = ref(false)
const saving = ref(false)

const calibForm = ref({
  chessboard_cols: 9,
  chessboard_rows: 6,
  square_m: 0.025,
  alpha: 0.0,
  notes: '',
})

const uploadedFiles = ref<File[]>([])

const fetchCameras = async () => {
  if (!apiStore.isAuthenticated) return
  try {
    const response = await apiClient.get('/cameras')
    cameras.value = response.data.items || response.data || []
    // Auto-select first camera if available
    if (cameras.value.length > 0 && !selectedCameraId.value) {
      selectedCameraId.value = cameras.value[0]!.id
    }
  } catch (error) {
    console.error('Failed to fetch cameras:', error)
    toast.error('Gagal memuat data camera')
  }
}

const fetchCalibrations = async () => {
  if (!selectedCameraId.value || !apiStore.isAuthenticated) return
  loading.value = true
  try {
    const response = await apiClient.get(`/cameras/${selectedCameraId.value}/calibrations`)
    calibrations.value = response.data.items || response.data || []
  } catch (error) {
    console.error('Failed to fetch calibrations:', error)
    toast.error('Gagal memuat data kalibrasi')
  } finally {
    loading.value = false
  }
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  uploadedFiles.value = files
}

const saveCalibration = async () => {
  if (!selectedCameraId.value) return
  if (uploadedFiles.value.length < 10) {
    toast.warning('Minimal 10 gambar chessboard diperlukan')
    return
  }

  saving.value = true
  try {
    const formData = new FormData()
    formData.append('chessboard_cols', calibForm.value.chessboard_cols.toString())
    formData.append('chessboard_rows', calibForm.value.chessboard_rows.toString())
    formData.append('square_m', calibForm.value.square_m.toString())
    formData.append('alpha', calibForm.value.alpha.toString())
    if (calibForm.value.notes) {
      formData.append('notes', calibForm.value.notes)
    }
    uploadedFiles.value.forEach(file => {
      formData.append('files', file)
    })

    await apiClient.post(
      `/cameras/${selectedCameraId.value}/calibrations`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    )

    toast.success('Kalibrasi berhasil dibuat')
    closeModal()
    await fetchCalibrations()
  } catch (error: unknown) {
    console.error('Failed to create calibration:', error)
    const err = error as { response?: { data?: { detail?: string } }; message?: string }
    toast.error('Gagal membuat kalibrasi', {
      description: err.response?.data?.detail || err.message,
    })
  } finally {
    saving.value = false
  }
}

const closeModal = () => {
  showCreateModal.value = false
  calibForm.value = {
    chessboard_cols: 9,
    chessboard_rows: 6,
    square_m: 0.025,
    alpha: 0.0,
    notes: '',
  }
  uploadedFiles.value = []
}

const activateCalibration = async (calibId: string) => {
  try {
    await apiClient.post(
      `/cameras/${selectedCameraId.value}/calibrations/${calibId}/activate`
    )
    toast.success('Kalibrasi berhasil diaktifkan')
    await fetchCalibrations()
  } catch (error) {
    console.error('Failed to activate calibration:', error)
    toast.error('Gagal mengaktifkan kalibrasi')
  }
}

const viewPreview = (calibId: string) => {
  // TODO: Implement preview functionality
  toast.info('Preview kalibrasi', {
    description: `Preview untuk kalibrasi: ${calibId}`,
  })
}

const deleteCalibration = async (calibId: string) => {
  if (confirm('Apakah Anda yakin ingin menghapus kalibrasi ini?')) {
    // TODO: Implement delete calibration API
    toast.warning('Fitur hapus kalibrasi belum diimplementasikan')
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
  if (apiStore.isAuthenticated) {
    await fetchCameras()
  }
})
</script>