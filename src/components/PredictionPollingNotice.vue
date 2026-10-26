<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui'
import type { PollingJob } from '@/composables/useJobPolling'

defineProps<{ state: PollingJob }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="state.error" class="rounded-lg border border-warning-border bg-warning-bg p-3 text-sm" role="status">
    <p class="font-medium text-text">Status job {{ state.jobId.substring(0, 8) }}… belum dapat diperbarui</p>
    <p class="mt-1 text-text-muted">{{ state.error.message }} Kegagalan pemeriksaan ini tidak mengubah status job di backend.</p>
    <p class="mt-1 text-text-muted">
      {{ state.retrying ? 'Pemeriksaan akan dicoba lagi otomatis.' : 'Pemeriksaan otomatis dijeda. Perbaiki akses atau konfigurasi, lalu periksa lagi.' }}
      <template v-if="state.lastChecked">Status terakhir terbaca {{ state.lastChecked.toLocaleTimeString('id-ID') }}.</template>
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" class="min-h-11" :disabled="state.checking" @click="$emit('retry')">Periksa Status Lagi</Button>
      <RouterLink v-if="state.error.status === 401 || state.error.status === 403 || state.error.status === null" to="/dashboard/settings" class="inline-flex min-h-11 items-center text-brand underline">Buka Pengaturan</RouterLink>
    </div>
  </div>
</template>
