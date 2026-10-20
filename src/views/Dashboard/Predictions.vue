<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Prediksi Volume Sampah</h1>
      <Button @click="openModal" variant="primary" :disabled="!selectedCameraId">
        Jalankan Prediksi Baru
      </Button>
    </div>

    <!-- Camera Selector -->
    <Card class="p-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Camera</label>
      <select v-model="selectedCameraId" @change="fetchPredictionJobs"
        class="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary">
        <option value="">-- Pilih Camera --</option>
        <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
          {{ cam.name }} ({{ cam.resolution_w }}x{{ cam.resolution_h }})
        </option>
      </select>
      <p v-if="selectedCameraId" class="mt-2 text-sm text-gray-500">
        Menampilkan prediksi untuk camera terpilih
      </p>
    </Card>

    <!-- Prediction Jobs List -->
    <Card>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sumber</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model Segmen
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selesai</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="job in predictionJobs" :key="job.id" class="hover:bg-gray-50">
              <td class="px-4 py-4 font-mono text-sm text-gray-900">
                {{ job.id.substring(0, 8) }}...
              </td>
              <td class="px-4 py-4 text-sm text-gray-900">
                <span :class="getSourceTypeClass(job.source_type)">
                  {{ formatSourceType(job.source_type) }}
                </span>
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ job.seg_model || 'default' }}
              </td>
              <td class="px-4 py-4">
                <span :class="getStatusClass(job.status)"
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
                  {{ formatStatus(job.status) }}
                </span>
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ formatDate(job.created_at) }}
              </td>
              <td class="px-4 py-4 text-sm text-gray-500">
                {{ job.completed_at ? formatDate(job.completed_at) : '-' }}
              </td>
              <td class="px-4 py-4">
                <div class="flex space-x-2">
                  <Button variant="ghost" size="sm" @click="viewJobDetails(job.id)"
                    :disabled="job.status === 'processing'">
                    Detail
                  </Button>
                  <Button variant="ghost" size="sm" @click="viewOutputs(job.id)" :disabled="job.status !== 'completed'">
                    Output
                  </Button>
                  <Button variant="ghost" size="sm" @click="viewInstances(job.id)"
                    :disabled="job.status !== 'completed'">
                    Instance
                  </Button>
                  <Button variant="ghost" size="sm" @click="viewVolumes(job.id)" :disabled="job.status !== 'completed'">
                    Volume
                  </Button>
                  <Button variant="ghost" size="sm" @click="deleteJob(job.id)"
                    class="text-destructive hover:text-destructive/80">
                    Hapus
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="!predictionJobs.length && selectedCameraId">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                Belum ada job prediksi untuk camera ini. Klik "Jalankan Prediksi Baru" untuk memulai.
              </td>
            </tr>
            <tr v-if="!selectedCameraId">
              <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                Pilih camera terlebih dahulu untuk melihat job prediksinya.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Create Prediction Modal -->
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeModal()" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold mb-4">Jalankan Prediksi Baru</h2>

        <form @submit.prevent="submitPrediction">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tipe Sumber</label>
              <select v-model="predForm.source_type"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="upload">Upload Gambar</option>
                <option value="rtsp_frame">Ambil Frame dari RTSP</option>
                <option value="latest_rtsp">Ambil Frame Terbaru dari RTSP</option>
              </select>
            </div>

            <div v-if="predForm.source_type === 'upload'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Upload Gambar</label>
              <input type="file" accept="image/*" @change="handleImageUpload" class="w-full text-sm" />
              <p v-if="uploadedImage" class="mt-1 text-sm text-green-600">
                Gambar terpilih: {{ uploadedImage.name }} ({{ formatBytes(uploadedImage.size) }})
              </p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Confidence Threshold</label>
                <input v-model="predForm.seg_conf" type="number" step="0.01" min="0" max="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Cell Size (meter)</label>
                <input v-model="predForm.volume_cell_m" type="number" step="0.01" min="0.01" max="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Min Points per Cell</label>
              <input v-model="predForm.volume_min_pts_per_cell" type="number" min="1" max="10"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Output yang Dikembalikan</label>
              <div class="flex flex-wrap gap-2">
                <label class="inline-flex items-center">
                  <input type="checkbox" value="segmentation" v-model="predForm.return_outputs" class="mr-2" />
                  Segmentation Mask
                </label>
                <label class="inline-flex items-center">
                  <input type="checkbox" value="depth" v-model="predForm.return_outputs" class="mr-2" />
                  Depth Map
                </label>
                <label class="inline-flex items-center">
                  <input type="checkbox" value="bev" v-model="predForm.return_outputs" class="mr-2" />
                  BEV
                </label>
                <label class="inline-flex items-center">
                  <input type="checkbox" value="volume" v-model="predForm.return_outputs" class="mr-2" />
                  Volume Grid
                </label>
                <label class="inline-flex items-center">
                  <input type="checkbox" value="instances" v-model="predForm.return_outputs" class="mr-2" />
                  Instances
                </label>
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end space-x-3">
            <Button variant="secondary" @click="closeModal">Batal</Button>
            <Button type="submit" variant="primary" :isLoading="submitting">
              {{ submitting ? 'Memproses...' : 'Jalankan Prediksi' }}
            </Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Job Detail Modal -->
    <div v-if="selectedJob" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeJobDetail" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Detail Job Prediksi</h2>
          <Button variant="ghost" @click="closeJobDetail">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p class="text-sm text-gray-500">Job ID</p>
            <p class="font-mono text-sm">{{ selectedJob.id }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Status</p>
            <p><span :class="getStatusClass(selectedJob.status)"
                class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">{{ formatStatus(selectedJob.status)
                }}</span></p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Sumber</p>
            <p>{{ formatSourceType(selectedJob.source_type) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Model Segmen</p>
            <p>{{ selectedJob.seg_model || 'default' }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Confidence</p>
            <p>{{ selectedJob.seg_conf }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Dibuat</p>
            <p>{{ formatDate(selectedJob.created_at) }}</p>
          </div>
          <div v-if="selectedJob.completed_at">
            <p class="text-sm text-gray-500">Selesai</p>
            <p>{{ formatDate(selectedJob.completed_at) }}</p>
          </div>
          <div v-if="selectedJob.error_msg">
            <p class="text-sm text-gray-500">Error</p>
            <p class="text-destructive">{{ selectedJob.error_msg }}</p>
          </div>
        </div>

        <div v-if="selectedJob.result" class="border-t pt-4">
          <h3 class="text-sm font-medium text-gray-900 mb-2">Hasil</h3>
          <pre
            class="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">{{ JSON.stringify(selectedJob.result, null, 2) }}</pre>
        </div>
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
import type { Camera, PredictionJob } from '@/types'
import { onMounted, ref } from 'vue'

const apiStore = useApiStore()
const toast = useToast()

const cameras = ref<Camera[]>([])
const predictionJobs = ref<PredictionJob[]>([])
const selectedCameraId = ref('')
const loading = ref(false)
const { isOpen, openModal, closeModal: closeModalFromComposable } = useModal()

const submitting = ref(false)
const selectedJob = ref<PredictionJob | null>(null)

const predForm = ref({
  source_type: 'upload',
  seg_conf: 0.25,
  volume_cell_m: 0.05,
  volume_min_pts_per_cell: 2,
  return_outputs: ['segmentation', 'bev', 'volume', 'instances'],
})

const uploadedImage = ref<File | null>(null)

const fetchCameras = async () => {
  if (!apiStore.isAuthenticated) return
  try {
    const response = await apiClient.get('/cameras')
    cameras.value = response.data.items || response.data || []
    if (cameras.value.length > 0 && !selectedCameraId.value) {
      selectedCameraId.value = cameras.value[0]!.id
    }
  } catch (error) {
    console.error('Failed to fetch cameras:', error)
    toast.error('Gagal memuat data camera')
  }
}

const fetchPredictionJobs = async () => {
  if (!selectedCameraId.value || !apiStore.isAuthenticated) return
  loading.value = true
  try {
    const response = await apiClient.get(`/cameras/${selectedCameraId.value}/predict`)
    predictionJobs.value = response.data || []
  } catch (error) {
    console.error('Failed to fetch prediction jobs:', error)
    toast.error('Gagal memuat data prediksi')
  } finally {
    loading.value = false
  }
}

const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (file) {
    uploadedImage.value = file
  }
}

const submitPrediction = async () => {
  if (!selectedCameraId.value) return

  const formData = new FormData()
  formData.append('source_type', predForm.value.source_type)
  formData.append('seg_conf', predForm.value.seg_conf.toString())
  formData.append('volume_cell_m', predForm.value.volume_cell_m.toString())
  formData.append('volume_min_pts_per_cell', predForm.value.volume_min_pts_per_cell.toString())
  formData.append('return_outputs', JSON.stringify(predForm.value.return_outputs))

  if (predForm.value.source_type === 'upload' && uploadedImage.value) {
    formData.append('file', uploadedImage.value)
  }

  submitting.value = true
  try {
    const response = await apiClient.post(
      `/cameras/${selectedCameraId.value}/predict`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    )

    toast.success('Prediksi berhasil dikirim', {
      description: `Job ID: ${response.data.job_id}`,
    })
    closeModal()
    await fetchPredictionJobs()
  } catch (error: unknown) {
    console.error('Failed to submit prediction:', error)
    const err = error as { response?: { data?: { detail?: string } }; message?: string }
    toast.error('Gagal menjalankan prediksi', {
      description: err.response?.data?.detail || err.message,
    })
  } finally {
    submitting.value = false
  }
}

const closeModal = () => {
  showCreateModal.value = false
  predForm.value = {
    source_type: 'upload',
    seg_conf: 0.25,
    volume_cell_m: 0.05,
    volume_min_pts_per_cell: 2,
    return_outputs: ['segmentation', 'bev', 'volume', 'instances'],
  }
  uploadedImage.value = null
}

const viewJobDetails = async (jobId: string) => {
  try {
    const response = await apiClient.get(`/cameras/${selectedCameraId.value}/predict/${jobId}`)
    selectedJob.value = response.data
  } catch (error) {
    console.error('Failed to fetch job details:', error)
    toast.error('Gagal memuat detail job')
  }
}

const viewOutputs = async (jobId: string) => {
  try {
    const response = await apiClient.get(`/cameras/${selectedCameraId.value}/predict/${jobId}/outputs`)
    toast.info('Outputs', {
      description: JSON.stringify(response.data, null, 2),
    })
  } catch (error) {
    console.error('Failed to fetch outputs:', error)
    toast.error('Gagal memuat outputs')
  }
}

const viewInstances = async (jobId: string) => {
  try {
    const response = await apiClient.get(`/cameras/${selectedCameraId.value}/predict/${jobId}/instances`)
    toast.info('Instances', {
      description: JSON.stringify(response.data, null, 2),
    })
  } catch (error) {
    console.error('Failed to fetch instances:', error)
    toast.error('Gagal memuat instances')
  }
}

const viewVolumes = async (jobId: string) => {
  try {
    const response = await apiClient.get(`/cameras/${selectedCameraId.value}/predict/${jobId}/volumes`)
    toast.info('Volumes', {
      description: JSON.stringify(response.data, null, 2),
    })
  } catch (error) {
    console.error('Failed to fetch volumes:', error)
    toast.error('Gagal memuat volumes')
  }
}

const deleteJob = async (jobId: string) => {
  if (confirm('Apakah Anda yakin ingin menghapus job prediksi ini?')) {
    // TODO: Implement delete prediction job API
    toast.warning('Fitur hapus job prediksi belum diimplementasikan')
  }
}

const closeJobDetail = () => {
  selectedJob.value = null
}

const getSourceTypeClass = (type: string) => {
  const classes: Record<string, string> = {
    upload: 'bg-blue-100 text-blue-700',
    rtsp_frame: 'bg-purple-100 text-purple-700',
    latest_rtsp: 'bg-indigo-100 text-indigo-700',
  }
  return classes[type] || 'bg-gray-100 text-gray-700'
}

const formatSourceType = (type: string) => {
  const labels: Record<string, string> = {
    upload: 'Upload Gambar',
    rtsp_frame: 'Frame RTSP',
    latest_rtsp: 'Frame Terbaru RTSP',
  }
  return labels[type] || type
}

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

const formatStatus = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    processing: 'Memproses',
    completed: 'Selesai',
    failed: 'Gagal',
  }
  return labels[status] || status
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

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(async () => {
  if (apiStore.isAuthenticated) {
    await fetchCameras()
  }
})
</script>