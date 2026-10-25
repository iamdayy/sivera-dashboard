<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { getMissingPrerequisiteLabels, getPrerequisiteRecoveryPath } from '@/services/readiness'
import type { PredictionPrerequisites } from '@/types'

const props = defineProps<{ readiness: PredictionPrerequisites }>()
const issues = computed(() =>
  props.readiness.missing.map((code) => ({
    code,
    message: getMissingPrerequisiteLabels([code])[0],
    path: getPrerequisiteRecoveryPath(code),
  })),
)
const destinations: Record<string, string> = {
  '/dashboard/calibrations': 'Kalibrasi',
  '/dashboard/ground-references': 'Referensi Tanah',
  '/dashboard/depth-scales': 'Skala Kedalaman',
}
</script>

<template>
  <div v-if="issues.length || readiness.legacy_upload" class="space-y-3">
    <div
      v-if="issues.length"
      class="rounded-md border border-warning-border bg-warning-bg/30 p-3 text-sm"
      role="status"
    >
      <p class="font-medium text-text">Konfigurasi belum siap untuk prediksi</p>
      <ul class="mt-2 space-y-2">
        <li v-for="issue in issues" :key="issue.code">
          <p class="text-text-muted">{{ issue.message }}</p>
          <RouterLink
            :to="{ path: issue.path, query: { camera: readiness.camera_id } }"
            class="inline-flex min-h-11 items-center text-brand underline"
          >
            Buka {{ destinations[issue.path] }}
          </RouterLink>
        </li>
      </ul>
    </div>
    <p v-if="readiness.legacy_upload" class="text-sm text-warning" role="status">
      Kalibrasi legacy: gambar upload harus sudah undistorted dan sesuai dimensi kamera. Kalibrasi
      ulang diperlukan untuk sumber RTSP.
    </p>
  </div>
</template>
