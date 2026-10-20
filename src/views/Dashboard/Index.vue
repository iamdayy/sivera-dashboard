<template>
  <div class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1 p-4">
      <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card class="p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-500">Total Kamera</p>
                <p class="text-3xl font-bold text-gray-900">{{ stats.total_cameras }}</p>
              </div>
              <div class="p-3 bg-primary/10 rounded-full text-primary">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        <Card class="p-6">
          <h2 class="text-lg font-semibold mb-4">Kesiapan Alur Kerja per Kamera</h2>
          <div v-if="cameraReadiness.length === 0 && !loading" class="text-center text-gray-500 py-8">
            Belum ada kamera. <router-link to="/dashboard/cameras" class="text-primary hover:underline">Tambah kamera</router-link> untuk memulai.
          </div>
          <div v-else class="space-y-4">
            <div v-for="cam in cameraReadiness" :key="cam.id" class="border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">{{ cam.name }}</p>
                  <p class="text-sm text-gray-500">{{ cam.resolution_w }}x{{ cam.resolution_h }} @ {{ cam.fps }} FPS</p>
                </div>
                <div class="flex items-center space-x-4 text-sm">
                  <span :class="cam.hasActiveCalib ? 'text-green-600' : 'text-yellow-600'" class="flex items-center gap-1">
                    <svg class="w-4 h-4" :class="cam.hasActiveCalib ? 'text-green-600' : 'text-yellow-600'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Kalibrasi: {{ cam.hasActiveCalib ? 'Aktif' : 'Tidak ada' }}
                  </span>
                  <span :class="cam.hasGroundModel ? 'text-green-600' : 'text-yellow-600'" class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                    Ground Model: {{ cam.hasGroundModel ? 'Aktif' : 'Tidak ada' }}
                  </span>
                  <span :class="cam.canPredict ? 'text-green-600' : 'text-red-600'" class="flex items-center gap-1 font-medium">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Siap Prediksi: {{ cam.canPredict ? 'Ya' : 'Tidak' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>

    <footer class="bg-white py-6 border-t">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <p class="text-sm text-gray-600">
            Sivera Dashboard v0.1.0 &bull; Monitoring CCTV &bull; Estimasi Volume Sampah
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import Header from '@/components/layout/Header.vue'
import { useApiStore } from '@/stores/api'
import { onMounted, ref } from 'vue'
import { listCameras, getCamera } from '@/services/cameras'
import { listCalibrations } from '@/services/calibrations'
import { listGroundReferences } from '@/services/groundReferences'
import { listPredictionJobs } from '@/services/predictions'
import type { Camera } from '@/types'

const apiStore = useApiStore()

interface CameraReadiness {
  id: string
  name: string
  resolution_w: number
  resolution_h: number
  fps: number
  hasActiveCalib: boolean
  hasGroundModel: boolean
  canPredict: boolean
}

const stats = ref({
  total_cameras: 0,
  active_calibrations: 0,
  ground_references: 0,
  recent_predictions: 0,
})

const cameraReadiness = ref<CameraReadiness[]>([])
const loading = ref(false)

const fetchDashboardData = async () => {
  if (!apiStore.hasApiKey) return
  loading.value = true
  try {
    const camerasRes = await listCameras()
    const cameras = camerasRes.items
    stats.value.total_cameras = cameras.length

    let totalActiveCalib = 0
    let totalGroundRefs = 0
    let totalJobs = 0
    const readiness: CameraReadiness[] = []

    for (const cam of cameras) {
      const [calibRes, groundRes, predRes] = await Promise.all([
        listCalibrations(cam.id),
        listGroundReferences(cam.id),
        listPredictionJobs(cam.id, 1, 1),
      ])

      const hasActiveCalib = calibRes.items.some(c => c.is_active)
      const hasGroundModel = groundRes.items.some(g => g.is_active)
      const canPredict = hasActiveCalib && hasGroundModel

      if (hasActiveCalib) totalActiveCalib++
      totalGroundRefs += groundRes.items.length
      totalJobs += predRes.total

      readiness.push({
        id: cam.id,
        name: cam.name,
        resolution_w: cam.resolution_w,
        resolution_h: cam.resolution_h,
        fps: cam.fps,
        hasActiveCalib,
        hasGroundModel,
        canPredict,
      })
    }

    stats.value.active_calibrations = totalActiveCalib
    stats.value.ground_references = totalGroundRefs
    stats.value.recent_predictions = totalJobs
    cameraReadiness.value = readiness
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (apiStore.hasApiKey) {
    await fetchDashboardData()
  }
})
</script>