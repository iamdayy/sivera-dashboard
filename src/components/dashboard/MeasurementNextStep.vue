<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui'
import { getMissingPrerequisiteLabels, getPrerequisiteRecoveryLabel, getPrerequisiteRecoveryPath } from '@/services/readiness'
import type { PredictionPrerequisites } from '@/types'

const props = defineProps<{
  cameraId: string
  cameraName: string
  readiness: PredictionPrerequisites | null
  loading: boolean
  error: string | null
}>()
defineEmits<{ retry: [] }>()

const current = computed(() => props.readiness?.camera_id === props.cameraId ? props.readiness : null)
const nextIssue = computed(() => current.value?.missing[0])
</script>

<template>
  <section class="card space-y-3" aria-labelledby="measurement-next-step">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h2 id="measurement-next-step" class="text-lg font-semibold text-text">Langkah berikutnya</h2>
        <p class="mt-1 break-words text-sm text-text-muted">{{ cameraName }}</p>
      </div>
      <slot name="camera" />
    </div>
    <p v-if="loading" role="status" class="text-sm text-text-muted">Memeriksa langkah setup berikutnya...</p>
    <div v-else-if="error" class="space-y-3" role="alert">
      <p class="font-medium text-text">Kesiapan belum dapat diperiksa</p>
      <p class="text-sm text-negative">{{ error }}</p>
      <Button variant="outline" class="min-h-11" @click="$emit('retry')">Coba Lagi</Button>
      <RouterLink to="/dashboard/settings" class="flex min-h-11 items-center text-sm text-brand underline">Buka Pengaturan</RouterLink>
    </div>
    <template v-else-if="current?.ready">
      <p class="font-medium text-text" role="status">Konfigurasi siap untuk upload gambar</p>
      <p class="text-sm text-text-muted">Unggah gambar di Analisis. Status pemrosesan dan hasil mengikuti job tersimpan.</p>
      <p v-if="current.legacy_upload" class="text-sm text-warning">Kalibrasi legacy: gunakan gambar yang sudah undistorted dan sesuai dimensi kamera.</p>
      <RouterLink :to="{ path: '/dashboard/predictions', query: { camera: cameraId } }" class="btn btn-primary min-h-11 w-full whitespace-normal text-center sm:w-auto">
        Buka Analisis Sampah
      </RouterLink>
      <p class="text-sm text-text-muted">Kesiapan konfigurasi belum memastikan worker tersedia atau kamera online.</p>
    </template>
    <template v-else-if="nextIssue">
      <p class="text-sm text-text-muted" role="status">{{ getMissingPrerequisiteLabels([nextIssue])[0] }}</p>
      <RouterLink :to="{ path: getPrerequisiteRecoveryPath(nextIssue), query: { camera: cameraId } }" class="btn btn-primary min-h-11 w-full whitespace-normal text-center sm:w-auto">
        {{ getPrerequisiteRecoveryLabel(nextIssue) }}
      </RouterLink>
      <p class="text-sm text-text-muted">Selesaikan langkah ini, lalu kembali ke Ringkasan untuk memeriksa prasyarat berikutnya.</p>
    </template>
    <div v-else class="space-y-3">
      <p class="text-sm text-text-muted">Kesiapan kamera belum diperiksa.</p>
      <Button variant="outline" class="min-h-11" :disabled="!cameraId" @click="$emit('retry')">Periksa Prasyarat</Button>
    </div>
  </section>
</template>
