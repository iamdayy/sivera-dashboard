<template>
  <div class="min-w-0 space-y-2">
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">Memuat {{ label }}...</p>
    <div v-else-if="error" role="alert" class="space-y-2">
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button variant="outline" @click="load">Coba Lagi</Button>
      <Button v-if="url" variant="outline" @click="download">Unduh {{ label }}</Button>
    </div>
    <template v-else-if="url">
      <img v-if="isImage" :src="url" :alt="label" class="h-auto w-full object-contain" @error="error = 'Berkas tidak dapat ditampilkan sebagai gambar. Unduh untuk memeriksanya.'" />
      <p v-else class="break-words text-sm text-muted-foreground">{{ label }} ({{ mime || 'format binary' }})</p>
      <Button variant="outline" @click="download">Unduh {{ label }}</Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { fetchArtifactBlob } from '@/services/artifacts'
import { connectionState, getConnectionContext, isCurrentConnection, normalizeApiError } from '@/services/api'
import { useObjectUrl } from '@/composables/useObjectUrl'

const props = defineProps<{ path: string; label: string }>()
const { url, replace, clear } = useObjectUrl()
const loading = ref(false)
const error = ref('')
const mime = ref('')
const isImage = computed(() => ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(mime.value))
let controller: AbortController | undefined

async function load() {
  controller?.abort()
  const request = new AbortController()
  const context = getConnectionContext()
  controller = request
  clear()
  loading.value = true
  error.value = ''
  try {
    const blob = await fetchArtifactBlob(props.path, context, request.signal)
    if (request.signal.aborted || !isCurrentConnection(context)) return
    mime.value = blob.type.split(';')[0] || ''
    replace(blob)
  } catch (cause) {
    if (!request.signal.aborted && isCurrentConnection(context)) error.value = normalizeApiError(cause).message
  } finally {
    if (!request.signal.aborted) loading.value = false
  }
}

function download() {
  if (!url.value) return
  const anchor = document.createElement('a')
  anchor.href = url.value
  anchor.download = props.label.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 100) || 'artifact'
  anchor.click()
}

watch(() => props.path, load, { immediate: true })
watch(() => connectionState.value.generation, () => {
  controller?.abort()
  clear()
  loading.value = false
  error.value = 'Koneksi berubah. Muat kembali berkas dengan koneksi yang aktif.'
}, { flush: 'sync' })
onScopeDispose(() => controller?.abort())
</script>
