<template>
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-medium text-gray-900">Kalibrasi v{{ calibration.version }}</h3>
        <div class="flex items-center space-x-4 mt-1 text-sm text-gray-500">
          <span v-if="calibration.rms_reproj">
            RMS: {{ calibration.rms_reproj.toFixed(3) }} px
          </span>
          <span :class="calibration.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'"
            class="px-2 py-0.5 rounded text-xs font-medium">
            {{ calibration.is_active ? 'Aktif' : 'Non-Aktif' }}
          </span>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <Button v-if="!calibration.is_active" variant="ghost" size="sm" @click="$emit('activate', calibration)">
          Aktifkan
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import type { Calibration } from '@/types'

const props = defineProps({
  calibration: {
    type: Object as () => Calibration,
    required: true
  }
})

const emit = defineEmits<{
  activate: [calibration: Calibration]
}>()
</script>