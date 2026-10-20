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
            <p class="text-sm font-medium text-gray-500">Total Camera</p>
            <p class="text-3xl font-bold text-gray-900">{{ stats.total_cameras }}</p>
          </div>
          <div class="p-3 bg-blue-100 rounded-full text-blue-600">
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
          <span>Kelola Camera</span>
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

    <!-- Recent Activity -->
    <Card class="p-6">
      <h2 class="text-lg font-semibold mb-4">Aktivitas Terbaru</h2>
      <div v-if="recentActivity.length === 0" class="text-center text-gray-500 py-8">
        Belum ada aktivitas. Mulai dengan menambah camera pertama Anda.
      </div>
      <div v-else class="space-y-3">
        <div v-for="activity in recentActivity" :key="activity.id"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div class="flex items-center space-x-3">
            <div :class="getActivityIconClass(activity.type)" class="p-2 rounded-full">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  :d="getActivityIcon(activity.type)" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">{{ activity.message }}</p>
              <p class="text-xs text-gray-500">{{ formatDate(activity.timestamp) }}</p>
            </div>
          </div>
          <span :class="getActivityStatusClass(activity.status)" class="text-xs px-2 py-1 rounded-full">
            {{ activity.status }}
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
import { apiClient } from '@/services/api'
import { useApiStore } from '@/stores/api'
import type { Activity, Calibration, Icons } from '@/types'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const apiStore = useApiStore()
const router = useRouter()
const toast = useToast()

const stats = ref({
  total_cameras: 0,
  active_calibrations: 0,
  ground_references: 0,
  recent_predictions: 0,
})

const recentActivity = ref<Activity[]>([])
const loading = ref(false)

const fetchStats = async () => {
  if (!apiStore.isAuthenticated) return
  loading.value = true
  try {
    // Fetch cameras
    const camerasRes = await apiClient.get('/cameras')
    const cameras = camerasRes.data.items || camerasRes.data || []
    stats.value.total_cameras = cameras.length

    // Fetch calibrations for first camera
    if (cameras.length > 0) {
      const calibRes = await apiClient.get<{ items: Calibration[] }>(`/cameras/${cameras[0].id}/calibrations`)
      const calibrations = calibRes.data.items || calibRes.data || []
      stats.value.active_calibrations = calibrations.filter(c => c.is_active).length

      // Fetch ground references
      const groundRes = await apiClient.get(`/cameras/${cameras[0].id}/ground-references`)
      const groundRefs = groundRes.data.items || groundRes.data || []
      stats.value.ground_references = groundRefs.length

      // Fetch prediction jobs
      const predRes = await apiClient.get(`/cameras/${cameras[0].id}/predict`)
      const predictions = predRes.data || []
      stats.value.recent_predictions = predictions.length
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    toast.error('Gagal memuat statistik dashboard')
    // Reset stats on error
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

const getActivityIcon = (type: string) => {
  const icons: Icons = {
    camera_added: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    calibration_created: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    ground_ref_created: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z',
    prediction_completed: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  }
  return icons[type] || icons.camera_added
}

const getActivityIconClass = (type: string) => {
  const classes: Record<string, string> = {
    camera_added: 'bg-blue-100 text-blue-600',
    calibration_created: 'bg-green-100 text-green-600',
    ground_ref_created: 'bg-purple-100 text-purple-600',
    prediction_completed: 'bg-orange-100 text-orange-600',
  }
  return classes[type] || classes.camera_added
}

const getActivityStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    success: 'bg-green-100 text-green-700',
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  }
  return classes[status] || classes.info
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
  if (apiStore.isAuthenticated) {
    await fetchStats()
  }
})
</script>