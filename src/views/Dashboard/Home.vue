<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p class="text-gray-600 mt-1">Ringkasan sistem monitoring CCTV dan estimasi volume sampah</p>
    </div>

    <!-- Quick Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card class="p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Total Kamera</p>
            <p class="text-3xl font-bold text-gray-900">{{ stats.total_cameras }}</p>
          </div>
          <div class="p-3 bg-primary/10 rounded-full text-primary">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        </div>
      </Card>

      <Card class="p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Kalibrasi Aktif</p>
            <p class="text-3xl font-bold text-gray-900">{{ stats.active_calibrations }}</p>
          </div>
          <div class="p-3 bg-green-100 rounded-full text-green-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </Card>

      <Card class="p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Referensi Tanah</p>
            <p class="text-3xl font-bold text-gray-900">{{ stats.ground_references }}</p>
          </div>
          <div class="p-3 bg-purple-100 rounded-full text-purple-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
        </div>
      </Card>

      <Card class="p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Prediksi Terakhir</p>
            <p class="text-3xl font-bold text-gray-900">{{ stats.recent_predictions }}</p>
          </div>
          <div class="p-3 bg-orange-100 rounded-full text-orange-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
      </Card>
    </div>

    <!-- Quick Actions -->
    <Card class="p-6">
      <h2 class="text-lg font-semibold mb-4">Aksi Cepat</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" class="h-24 flex flex-col items-center justify-center gap-2"
          @click="$router.push('/dashboard/cameras')">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Kelola Kamera</span>
        </Button>

        <Button variant="outline" class="h-24 flex flex-col items-center justify-center gap-2"
          @click="$router.push('/dashboard/calibrations')">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Kalibrasi</span>
        </Button>

        <Button variant="outline" class="h-24 flex flex-col items-center justify-center gap-2"
          @click="$router.push('/dashboard/predictions')">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Jalankan Prediksi</span>
        </Button>
      </div>
    </Card>

    <!-- Recent Prediction Jobs -->
    <Card class="p-6">
      <h2 class="text-lg font-semibold mb-4">Job Prediksi Terbaru</h2>
      <div v-if="recentJobs.length === 0" class="text-center text-gray-500 py-8">
        Belum ada job prediksi. Jalankan prediksi pertama Anda.
      </div>
      <div v-else class="space-y-3">
        <div v-for="job in recentJobs" :key="job.id"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div class="flex items-center space-x-3">
            <div class="p-2 rounded-full" :class="getJobStatusColorClass(job.status)">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  :d="getJobStatusIcon(job.status)" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">{{ job.id.substring(0, 8) }}...</p>
              <p class="text-xs text-gray-500">{{ formatDate(job.created_at) }}</p>
            </div>
          </div>
          <span :class="getJobStatusClass(job.status)" class="text-xs px-2 py-1 rounded-full">
            {{ formatJobStatus(job.status) }}
          </span>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import { useToast } from '@/composables/useToast'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { useApiStore } from '@/stores/api'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listCameras, getCamera } from '@/services/cameras'
import { listCalibrations } from '@/services/calibrations'
import { listGroundReferences } from '@/services/groundReferences'
import { listPredictionJobs } from '@/services/predictions'
import type { Calibration, Camera, GroundReference, PredictionJob } from '@/types'

const apiStore = useApiStore()
const router = useRouter()
const toast = useToast()
const isActive = useConnectionScope()

const stats = ref({
  total_cameras: 0,
  active_calibrations: 0,
  ground_references: 0,
  recent_predictions: 0,
})

const recentJobs = ref<PredictionJob[]>([])
const loading = ref(false)

const fetchStats = async () => {
  if (!apiStore.hasApiKey) return
  loading.value = true
  try {
    // Fetch cameras
    const camerasRes = await listCameras()
    if (!isActive()) return
    const cameras = camerasRes.items
    stats.value.total_cameras = cameras.length

    if (cameras.length > 0) {
      // Fetch stats for all cameras (use first for quick stats, but check all)
      let totalActiveCalib = 0
      let totalGroundRefs = 0
      let totalJobs = 0

      for (const cam of cameras) {
        if (!isActive()) return
        // Active calibrations
        const calibRes = await listCalibrations(cam.id)
        if (!isActive()) return
        totalActiveCalib += calibRes.items.filter(c => c.is_active).length

        // Ground references
        const groundRes = await listGroundReferences(cam.id)
        if (!isActive()) return
        totalGroundRefs += groundRes.items.length

        // Prediction jobs
        const predRes = await listPredictionJobs(cam.id, 1, 5)
        if (!isActive()) return
        totalJobs += predRes.items.length
        // Collect recent jobs
        for (const job of predRes.items.slice(0, 3)) {
          recentJobs.value.push(job)
        }
      }

      stats.value.active_calibrations = totalActiveCalib
      stats.value.ground_references = totalGroundRefs
      stats.value.recent_predictions = totalJobs

      // Sort recent jobs by date, keep top 5
      recentJobs.value.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      recentJobs.value = recentJobs.value.slice(0, 5)
    }
  } catch (error) {
    if (!isActive()) return
    toast.error('Gagal memuat statistik dashboard')
    stats.value = {
      total_cameras: 0,
      active_calibrations: 0,
      ground_references: 0,
      recent_predictions: 0,
    }
  } finally {
    loading.value = false
  }
}

const getJobStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    pending: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    processing: 'M12 4v16m8-8H4',
    done: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    failed: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  }
  return icons[status] || icons.pending
}

const getJobStatusColorClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-600',
    processing: 'bg-blue-100 text-blue-600',
    done: 'bg-green-100 text-green-600',
    failed: 'bg-red-100 text-red-600',
  }
  return classes[status] || classes.pending
}

const getJobStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

const formatJobStatus = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    processing: 'Memproses',
    done: 'Selesai',
    failed: 'Gagal',
  }
  return labels[status] || status
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(async () => {
  if (apiStore.hasApiKey) {
    await fetchStats()
  }
})
</script>
