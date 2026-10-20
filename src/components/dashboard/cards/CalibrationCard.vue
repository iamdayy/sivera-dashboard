<template>
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow p-4">
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
        <button v-if="!calibration.is_active" @click="activateCalibration"
          class="px-2 py-1 text-sm font-medium text-primary hover:text-primary/80">
          Aktifkan
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast';
import { useRouter } from 'vue-router';

const props = defineProps({
  calibration: {
    type: Object,
    required: true
  }
})

const router = useRouter()
const toast = useToast()

const activateCalibration = () => {
  // TODO: Implement activate calibration API call
  toast.info('Aktifkan kalibrasi', {
    description: `ID: ${props.calibration.id}`,
  })
}
</script>