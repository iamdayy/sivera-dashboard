<template>
  <div class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1 p-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Camera Cards -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-semibold mb-4">Cameras</h2>
          <div class="space-y-4">
            <CameraCard v-for="camera in cameras" :key="camera.id" :camera="camera" />
          </div>
          <div v-if="!cameras.length && !camerasLoading" class="text-center text-gray-500 py-4">
            Tidak ada camera terdaftar. <a href="/dashboard/cameras" class="text-primary hover:underline">Tambah
              camera</a>
          </div>
          <div v-if="camerasLoading" class="text-center text-gray-500 py-4">
            Memuat camera...
          </div>
        </div>

        <!-- Calibration Status -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-semibold mb-4">Kalibrasi</h2>
          <div class="space-y-4">
            <CalibrationCard v-for="calib in calibrations" :key="calib.id" :calibration="calib" />
          </div>
          <div v-if="!calibrations.length && !calibrationsLoading" class="text-center text-gray-500 py-4">
            Belum ada kalibrasi.
          </div>
          <div v-if="calibrationsLoading" class="text-center text-gray-500 py-4">
            Memuat kalibrasi...
          </div>
        </div>

        <!-- Volume Statistics -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-semibold mb-4">Volume Sampah</h2>
          <div class="space-y-4">
            <VolumeCard />
          </div>
        </div>
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
import CalibrationCard from '@/components/dashboard/cards/CalibrationCard.vue'
import CameraCard from '@/components/dashboard/cards/CameraCard.vue'
import VolumeCard from '@/components/dashboard/cards/VolumeCard.vue'
import Header from '@/components/layout/Header.vue'
import { useToast } from '@/composables/useToast'
import { apiClient } from '@/services/api'
import { useApiStore } from '@/stores/api'
import { onMounted, ref } from 'vue'

const apiStore = useApiStore()
const toast = useToast()

import type { Calibration, Camera } from '@/types'

const cameras = ref<Camera[]>([])
const calibrations = ref<Calibration[]>([])
const camerasLoading = ref(false)
const calibrationsLoading = ref(false)

const fetchCameras = async () => {
  if (!apiStore.isAuthenticated) return
  camerasLoading.value = true
  try {
    const response = await apiClient.get('/cameras')
    cameras.value = response.data.items || response.data || []
  } catch (error) {
    console.error('Failed to fetch cameras:', error)
    toast.error('Gagal memuat data camera')
  } finally {
    camerasLoading.value = false
  }
}

const fetchCalibrations = async () => {
  if (!apiStore.isAuthenticated) return
  calibrationsLoading.value = true
  try {
    // Get first camera's calibrations for now
    if (cameras.value.length > 0 && cameras.value[0]) {
      const response = await apiClient.get(`/cameras/${cameras.value[0].id}/calibrations`)
      calibrations.value = response.data.items || response.data || []
    }
  } catch (error) {
    console.error('Failed to fetch calibrations:', error)
    toast.error('Gagal memuat data kalibrasi')
  } finally {
    calibrationsLoading.value = false
  }
}

onMounted(async () => {
  if (apiStore.isAuthenticated) {
    await fetchCameras()
    await fetchCalibrations()
  }
})
</script>