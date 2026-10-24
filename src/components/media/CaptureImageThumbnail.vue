<template>
  <div class="relative flex h-full w-full items-center justify-center overflow-hidden bg-frame">
    <img
      v-if="url"
      :src="url"
      :alt="alt"
      class="h-full w-full object-cover"
      loading="lazy"
    />
    <div v-else-if="loading" class="flex items-center justify-center" role="status">
      <div class="spinner" aria-hidden="true" />
      <span class="sr-only">Memuat pratinjau gambar</span>
    </div>
    <div v-else class="flex flex-col items-center gap-1 text-text-muted">
      <ImageOff class="h-6 w-6" aria-hidden="true" />
      <span class="sr-only">Pratinjau tidak tersedia</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { ImageOff } from '@lucide/vue'
import { getCaptureImageBlob } from '@/services/calibrationCaptures'

const props = defineProps<{
  cameraId: string
  sessionId: string
  imageId: string
  alt: string
}>()

const url = ref('')
const loading = ref(false)
let requestId = 0
let objectUrl = ''

function clear() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
  url.value = ''
}

async function load() {
  const id = ++requestId
  clear()
  loading.value = true
  try {
    const blob = await getCaptureImageBlob(props.cameraId, props.sessionId, props.imageId, true)
    if (id !== requestId) return
    objectUrl = URL.createObjectURL(blob)
    url.value = objectUrl
  } catch {
    if (id === requestId) clear()
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(
  () => [props.cameraId, props.sessionId, props.imageId],
  () => { void load() },
  { immediate: true },
)

onUnmounted(() => {
  requestId += 1
  clear()
})
</script>
