<template>
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-4" v-if="volumeEstimate">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-3xl font-bold text-primary">{{ volumeEstimate.volume_m3 }} m³</p>
          <p class="text-sm text-gray-500">{{ volumeEstimate.volume_liter }} L</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-medium text-gray-900">Total Volume</p>
          <p class="text-xs text-gray-400">Estimasi terkini</p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <div class="text-center">
          <p class="text-xl font-bold text-gray-900">{{ volumeEstimate.footprint_m2 }}</p>
          <p class="text-xs text-gray-500">Footprint (m²)</p>
        </div>
        <div class="text-center">
          <p class="text-xl font-bold text-gray-900">{{ volumeEstimate.height_mean_m?.toFixed(2) ?? '—' }}</p>
          <p class="text-xs text-gray-500">Tinggi Rata (m)</p>
        </div>
        <div class="text-center">
          <p class="text-xl font-bold text-gray-900">{{ volumeEstimate.n_cells ?? '—' }}</p>
          <p class="text-xs text-gray-500">Grid Cells</p>
        </div>
      </div>

      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-500">Metode: {{ volumeEstimate.method }}</span>
        <span class="text-gray-400">
          {{ formatDate(volumeEstimate.created_at) }}
        </span>
      </div>
    </div>
  </div>
  <div v-else class="rounded-lg border border-gray-200 bg-white shadow-sm p-4 text-center text-gray-500">
    Belum ada data volume. Jalankan prediksi untuk melihat estimasi.
  </div>
</template>

<script setup lang="ts">
import type { VolumeEstimate } from '@/types'

const props = defineProps({
  volumeEstimate: {
    type: Object as () => VolumeEstimate | null,
    default: null,
  }
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>