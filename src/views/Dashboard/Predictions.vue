<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Prediksi Volume Sampah</h1>
      <Button @click="openCreateModal" variant="primary" :disabled="!selectedCameraId">
        Jalankan Prediksi Baru
      </Button>
    </div>

    <!-- Camera Selector -->
    <Card class="p-4">
      <label class="block text-sm font-medium text-gray-700 mb-2">Pilih Camera</label>
      <select v-model="selectedCameraId" @change="onCameraChange"
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
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model Segmen</th>
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
                <span :class="getStatusClass(displayStatus(job))"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full">
                  <span v-if="isPolling(job.camera_id, job.id)" class="animate-spin">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </span>
                  {{ formatStatus(displayStatus(job)) }}
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
    <div v-if="isCreateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeCreateModal" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold mb-4">Jalankan Prediksi Baru</h2>

        <form @submit.prevent="submitPrediction">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tipe Sumber</label>
              <select v-model="predForm.source_type"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="upload">Upload Gambar</option>
                <option value="rtsp_frame" disabled>Ambil Frame dari RTSP (belum didukung)</option>
                <option value="latest_rtsp" disabled>Ambil Frame Terbaru dari RTSP (belum didukung)</option>
              </select>
              <p v-if="predForm.source_type !== 'upload'" class="mt-1 text-xs text-amber-600">
                Backend belum mengimplementasikan sumber RTSP. Gunakan Upload Gambar.
              </p>
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
            <Button variant="secondary" @click="closeCreateModal">Batal</Button>
            <Button type="submit" variant="primary" :isLoading="submitting">
              {{ submitting ? 'Memproses...' : 'Jalankan Prediksi' }}
            </Button>
          </div>
        </form>
      </div>
    </div>

    <!-- Job Detail Modal with Gallery -->
    <div v-if="selectedJob" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/50" @click="closeJobDetail" />
      <div class="relative bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Detail Job Prediksi</h2>
          <Button variant="ghost" @click="closeJobDetail">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <!-- Job Metadata -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p class="text-sm text-gray-500">Job ID</p>
            <p class="font-mono text-sm">{{ selectedJob.id }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Status</p>
            <p><span :class="getStatusClass(selectedJob.status)"
                class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">{{ formatStatus(selectedJob.status) }}
              </span></p>
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

        <!-- Image Gallery -->
        <div v-if="jobOutputs.length > 0" class="border-t pt-6 mb-6">
          <h3 class="text-sm font-medium text-gray-900 mb-4">Output Gambar</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div v-for="output in jobOutputs" :key="output.id" class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="aspect-video bg-gray-100 relative">
                <img v-if="output.mime_type?.startsWith('image/')" :src="getOutputUrl(selectedJob.camera_id, selectedJob.id, output.output_type)" :alt="output.output_type" class="w-full h-full object-cover" @error="handleImageError(output)" />
                <div v-else class="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                  {{ output.output_type }} ({{ output.mime_type }})
                </div>
              </div>
              <div class="p-2 bg-gray-50">
                <p class="text-xs font-medium text-gray-900 truncate">{{ formatOutputType(output.output_type) }}</p>
                <p class="text-xs text-gray-500">{{ output.width }}x{{ output.height }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Instance Table -->
        <div v-if="jobInstances.length > 0" class="border-t pt-6 mb-6">
          <h3 class="text-sm font-medium text-gray-900 mb-4">Instance Terdeteksi</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kelas</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume (m³)</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Footprint (m²)</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tinggi Rata (m)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="inst in jobInstances" :key="inst.id" class="hover:bg-gray-50">
                  <td class="px-3 py-2 font-medium text-gray-900">{{ inst.cls_name }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ (inst.confidence * 100).toFixed(1) }}%</td>
                  <td class="px-3 py-2 text-gray-700">{{ inst.volume_m3?.toFixed(3) ?? '—' }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ inst.footprint_m2?.toFixed(3) ?? '—' }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ inst.height_mean_m?.toFixed(3) ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Volume Table -->
        <div v-if="jobVolumes.length > 0" class="border-t pt-6">
          <h3 class="text-sm font-medium text-gray-900 mb-4">Estimasi Volume</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metode</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume (m³)</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume (L)</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cell Size (m)</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grid Cells</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titik</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="vol in jobVolumes" :key="vol.id" class="hover:bg-gray-50">
                  <td class="px-3 py-2 font-medium text-gray-900">{{ vol.method }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ vol.volume_m3.toFixed(3) }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ vol.volume_liter.toFixed(0) }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ vol.cell_m?.toFixed(3) ?? '—' }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ vol.n_cells ?? '—' }}</td>
                  <td class="px-3 py-2 text-gray-700">{{ vol.n_points ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="jobOutputs.length === 0 && jobInstances.length === 0 && jobVolumes.length === 0" class="text-center text-gray-500 py-8">
          Belum ada output untuk job ini.
        </div>
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
import { listCameras as apiListCameras } from '@/services/cameras'
import { listPredictionJobs as apiListPredictionJobs, getPredictionJob as apiGetPredictionJob, submitPrediction as apiSubmitPrediction, listPredictionOutputs as apiListPredictionOutputs, getPredictionInstances as apiGetPredictionInstances, getPredictionVolumes as apiGetPredictionVolumes, getOutputUrl } from '@/services/predictions'
import { useJobPolling } from '@/composables/useJobPolling'
import type { Camera, PredictionJob, PredictionOutput, DetectedInstance, VolumeEstimate } from '@/types'

const apiStore = useApiStore()
const toast = useToast()

const cameras = ref<Camera[]>([])
const predictionJobs = ref<PredictionJob[]>([])
const selectedCameraId = ref('')
const loading = ref(false)
const submitting = ref(false)
const selectedJob = ref<PredictionJob | null>(null)
const isCreateModalOpen = ref(false)

// Job detail data
const jobOutputs = ref<PredictionOutput[]>([])
const jobInstances = ref<DetectedInstance[]>([])
const jobVolumes = ref<VolumeEstimate[]>([])
const loadingJobDetail = ref(false)

// Job polling
const { startPolling, isPolling, getPollingStatus, stopPolling } = useJobPolling(
  apiGetPredictionJob,
  async (updatedJob) => {
    toast.success('Prediksi selesai', {
      description: `Job ${updatedJob.id.substring(0, 8)}... ${updatedJob.status === 'done' ? 'berhasil' : 'gagal'}`,
    })
    await fetchPredictionJobs()
  }
)

const predForm = ref({
  source_type: 'upload',
  seg_conf: 0.25,
  volume_cell_m: 0.05,
  volume_min_pts_per_cell: 2,
  return_outputs: ['segmentation', 'bev', 'volume', 'instances'],
})

const uploadedImage = ref<File | null>(null)

const fetchCameras = async () => {
  if (!apiStore.hasApiKey) return
  try {
    const response = await apiListCameras()
    cameras.value = response.items
    if (cameras.value.length > 0 && !selectedCameraId.value) {
      selectedCameraId.value = cameras.value[0]!.id
    }
  } catch (error) {
    console.error('Failed to fetch cameras:', error)
    toast.error('Gagal memuat data camera')
  }
}

const fetchPredictionJobs = async () => {
  if (!selectedCameraId.value || !apiStore.hasApiKey) return
  loading.value = true
  try {
    const response = await apiListPredictionJobs(selectedCameraId.value)
    predictionJobs.value = response.items
    // Start polling for jobs that are still in progress
    for (const job of response.items) {
      if (job.status === 'pending' || job.status === 'processing') {
        startPolling(selectedCameraId.value, job.id)
      }
    }
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

const onCameraChange = () => {
  // Stop polling for previous camera's jobs
  stopPolling()
  fetchPredictionJobs()
}

const openCreateModal = () => {
  predForm.value = {
    source_type: 'upload',
    seg_conf: 0.25,
    volume_cell_m: 0.05,
    volume_min_pts_per_cell: 2,
    return_outputs: ['segmentation', 'bev', 'volume', 'instances'],
  }
  uploadedImage.value = null
  isCreateModalOpen.value = true
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
}

const submitPrediction = async () => {
  if (!selectedCameraId.value) return

  if (predForm.value.source_type !== 'upload') {
    toast.warning('Hanya tipe sumber Upload Gambar yang didukung saat ini')
    return
  }
  if (!uploadedImage.value) {
    toast.warning('Pilih gambar untuk diunggah')
    return
  }

  submitting.value = true
  try {
    const result = await apiSubmitPrediction(selectedCameraId.value, {
      source_type: predForm.value.source_type,
      seg_conf: predForm.value.seg_conf,
      volume_cell_m: predForm.value.volume_cell_m,
      volume_min_pts_per_cell: predForm.value.volume_min_pts_per_cell,
      return_outputs: predForm.value.return_outputs,
      file: uploadedImage.value,
    })

    toast.success('Prediksi berhasil dikirim', {
      description: `Job ID: ${result.job_id}`,
    })
    closeCreateModal()
    await fetchPredictionJobs()
    // Start polling for the new job
    startPolling(selectedCameraId.value, result.job_id)
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

const viewJobDetails = async (jobId: string) => {
  try {
    loadingJobDetail.value = true
    const [job, outputs, instances, volumes] = await Promise.all([
      apiGetPredictionJob(selectedCameraId.value, jobId),
      apiListPredictionOutputs(selectedCameraId.value, jobId),
      apiGetPredictionInstances(selectedCameraId.value, jobId),
      apiGetPredictionVolumes(selectedCameraId.value, jobId),
    ])
    selectedJob.value = job
    jobOutputs.value = outputs
    jobInstances.value = instances
    jobVolumes.value = volumes
    // Start polling if job is still in progress
    if (job.status === 'pending' || job.status === 'processing') {
      startPolling(selectedCameraId.value, jobId)
    }
  } catch (error) {
    console.error('Failed to fetch job details:', error)
    toast.error('Gagal memuat detail job')
  } finally {
    loadingJobDetail.value = false
  }
}

const deleteJob = async (jobId: string) => {
  if (confirm('Apakah Anda yakin ingin menghapus job prediksi ini?')) {
    toast.warning('Hapus job prediksi belum tersedia di API')
  }
}

const formatOutputType = (type: string) => {
  const labels: Record<string, string> = {
    mask: 'Mask Segmentasi',
    overlay: 'Overlay Segmentasi',
    instances_json: 'Instance JSON',
    depth_raw_vis: 'Depth Raw',
    depth_scaled_vis: 'Depth Terkalibrasi',
    depth_masked: 'Depth Termask',
    height_map: 'Height Map',
    lifted_points_npz: 'Titik 3D (NPZ)',
    volume_heatmap: 'Heatmap Volume',
    volume_result_npz: 'Volume Result (NPZ)',
    bev_image: 'BEV Image',
    bev_mask_proyeksi: 'BEV Mask',
    bev_overlay: 'BEV Overlay',
  }
  return labels[type] || type
}

const handleImageError = (output: PredictionOutput) => {
  console.warn('Failed to load image:', output.output_type)
}

const closeJobDetail = () => {
  selectedJob.value = null
  jobOutputs.value = []
  jobInstances.value = []
  jobVolumes.value = []
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
    done: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

const formatStatus = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    processing: 'Memproses',
    done: 'Selesai',
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

const displayStatus = (job: PredictionJob) => {
  const pollingStatus = getPollingStatus(job.camera_id, job.id)
  return pollingStatus ?? job.status
}

onMounted(async () => {
  if (apiStore.hasApiKey) {
    await fetchCameras()
  }
})
</script>