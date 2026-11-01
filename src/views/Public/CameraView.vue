<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import PublicWhepPlayer from '@/components/media/PublicWhepPlayer.vue'
import { Video, Wifi, WifiOff, AlertCircle, XCircle, Package } from '@lucide/vue'
import { Badge, Button } from '@/components/ui'
import type { LatestPrediction, AutoPredictionLivePayload } from '@/types'
import { createSSEConnection } from '@/services/publicPredictions'

const route = useRoute()
const cameraId = route.params.cameraId as string

const latestPrediction = ref<LatestPrediction | null>(null)
const livePayload = ref<AutoPredictionLivePayload | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const eventSource = ref<EventSource | null>(null)
const connected = ref(false)
const lastUpdate = ref<Date | null>(null)
const showOverlay = ref(true)

// Canvas overlay for segmentation (raw-coordinate mask rendered on top of the live frame)
const overlayCanvas = shallowRef<HTMLCanvasElement | null>(null)
const playerRef = shallowRef<{ videoRef: HTMLVideoElement | null } | null>(null)

const videoRef = computed(() => playerRef.value?.videoRef ?? null)

const publicApiBase = import.meta.env.VITE_API_BASE_URL || ''

async function fetchLatestPrediction() {
  try {
    const response = await fetch(`${publicApiBase}/api/v1/public/cameras/${cameraId}/latest-prediction`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    latestPrediction.value = data
    lastUpdate.value = new Date()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Gagal memuat prediksi'
    console.error('Fetch latest prediction error:', err)
  } finally {
    loading.value = false
  }
}

function connectSSE() {
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }

  const es = createSSEConnection(cameraId, (payload) => {
    livePayload.value = payload
    lastUpdate.value = new Date()
    error.value = null
  })
  eventSource.value = es

  es.onopen = () => {
    connected.value = true
    console.log('SSE connected')
  }

  es.onerror = () => {
    connected.value = false
    console.error('SSE error, will reconnect...')
    setTimeout(connectSSE, 5000)
  }
}

const volumeDisplay = computed(() => {
  // Live payload is authoritative. Never fall back to historical volume when live volume is null.
  const liters = livePayload.value?.volume_liters
  if (liters === null || liters === undefined) return null
  if (liters >= 1000) {
    return `${(liters / 1000).toFixed(2)} m³`
  }
  return `${liters.toFixed(1)} L`
})

const segmentationInfo = computed(() => {
  return livePayload.value?.segmentation ?? null
})

const hasLiveFrame = computed(() => !!livePayload.value?.frame_jpeg_base64)

const liveFrameUrl = computed(() => {
  const b64 = livePayload.value?.frame_jpeg_base64
  if (!b64) return ''
  return `data:image/jpeg;base64,${b64}`
})

const isStale = computed(() => {
  if (!lastUpdate.value) return false
  const diff = Date.now() - lastUpdate.value.getTime()
  return diff > 60000 // stale after 60 seconds
})

// Draw the real mask overlay on the canvas, aligned to the video frame size.
function drawOverlay() {
  if (!overlayCanvas.value || !videoRef.value) return

  const canvas = overlayCanvas.value
  const video = videoRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = video.videoWidth || 0
  canvas.height = video.videoHeight || 0
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const seg = livePayload.value?.segmentation
  if (!seg || !seg.has_mask || !seg.overlay_png_base64) {
    return
  }

  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const pct = seg.waste_fraction_pct?.toFixed(1) ?? '0'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px system-ui'
    ctx.fillText(`Waste: ${pct}%`, 12, 28)
  }
  img.onerror = () => {
    console.error('Failed to decode overlay PNG')
  }
  img.src = `data:image/png;base64,${seg.overlay_png_base64}`
}

watch(livePayload, drawOverlay)
watch(() => videoRef.value?.videoWidth, drawOverlay)

onMounted(() => {
  fetchLatestPrediction()
  connectSSE()
})

onUnmounted(() => {
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
  }
})

function getImageUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${publicApiBase}/api/v1/public/cameras/${cameraId}/latest-prediction/outputs/${path}/image`
}
</script>

<template>
  <div class="min-h-screen bg-bg">
    <header class="border-b border-border bg-card">
      <div class="container mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <Video class="w-8 h-8 text-brand" aria-hidden="true" />
          <h1 class="text-xl font-bold text-text">SIVERA Live View</h1>
          <Badge :class="connected ? 'badge-positive' : 'badge-neutral'">
            <component :is="connected ? 'Wifi' : 'WifiOff'" class="w-3 h-3 mr-1" />
            {{ connected ? 'Live' : 'Offline' }}
          </Badge>
          <Badge v-if="isStale" class="badge-warning">
            <AlertCircle class="w-3 h-3 mr-1" /> Stale
          </Badge>
        </div>
        <div class="text-sm text-text-muted flex items-center gap-4 flex-wrap">
          <span v-if="lastUpdate">Terakhir: {{ lastUpdate.toLocaleTimeString('id-ID') }}</span>
          <span>Kamera: {{ cameraId.slice(0, 8) }}...</span>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8">
      <div v-if="loading" class="flex items-center justify-center min-h-[400px]">
        <div class="text-center">
          <div class="spinner mx-auto mb-4" style="width: 3rem; height: 3rem; border-width: 4px;" />
          <p class="text-text-muted">Memuat prediksi terbaru...</p>
        </div>
      </div>

      <div v-else-if="error" class="card max-w-2xl mx-auto text-center py-12">
        <XCircle class="w-12 h-12 text-negative mx-auto mb-4" aria-hidden="true" />
        <h2 class="text-lg font-medium text-text mb-2">Gagal memuat data</h2>
        <p class="text-text-muted mb-4">{{ error }}</p>
        <Button variant="outline" @click="fetchLatestPrediction">Coba Lagi</Button>
      </div>

      <div v-else class="space-y-6">
        <!-- Live Video + Overlay -->
        <div class="card overflow-hidden">
          <div class="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <PublicWhepPlayer
              ref="playerRef"
              :camera-id="cameraId"
              class="w-full h-full"
            />

            <!-- Original frame from RAM when segmentation is negative / WHEP unavailable -->
            <img
              v-if="hasLiveFrame && !livePayload?.segmentation?.has_mask"
              :src="liveFrameUrl"
              :alt="`Frame ${cameraId}`"
              class="absolute inset-0 w-full h-full object-cover opacity-80"
            />

            <!-- Segmentation Overlay Canvas (real mask, raw coordinates) -->
            <canvas
              ref="overlayCanvas"
              v-if="showOverlay && livePayload?.segmentation?.has_mask"
              class="absolute inset-0 pointer-events-none"
              style="mix-blend-mode: multiply;"
            />

            <!-- Status indicator overlay -->
            <div class="absolute top-3 right-3 flex gap-2">
              <span v-if="connected" class="px-2 py-1 text-xs bg-green-600/80 text-white rounded flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
              <span v-else class="px-2 py-1 text-xs bg-red-600/80 text-white rounded">
                Offline
              </span>
            </div>

            <!-- No segmentation indicator -->
            <div v-if="showOverlay && livePayload && !livePayload.segmentation?.has_mask" 
                 class="absolute inset-0 flex items-center justify-center bg-gray-900/50">
              <div class="text-center text-white">
                <Package class="w-12 h-12 mx-auto mb-3 text-gray-500" />
                <p>Tidak ada segmentasi sampah terdeteksi</p>
                <p v-if="livePayload.skip_reason" class="text-xs text-gray-400 mt-1">{{ livePayload.skip_reason }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Volume & Stats Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="card p-6">
            <div class="text-center">
              <h2 class="text-sm font-medium text-text-muted mb-2">Volume Terestimasi</h2>
              <div class="text-5xl font-bold text-text tabular-nums" v-if="volumeDisplay">
                {{ volumeDisplay }}
              </div>
              <div class="text-5xl font-bold text-text-muted" v-else>
                -
              </div>
              <p class="text-xs text-text-muted mt-2">
                Metode: {{ livePayload?.volume_method || '-' }}
                <span v-if="livePayload?.volume_liters === null && livePayload?.segmentation?.has_mask" class="text-xs text-warning ml-2">
                  (volume tidak valid)
                </span>
              </p>
            </div>
          </div>

          <div class="card p-6">
            <div class="text-center">
              <h2 class="text-sm font-medium text-text-muted mb-2">Segmentasi</h2>
              <div class="text-3xl font-bold text-text" v-if="segmentationInfo?.has_mask">
                {{ segmentationInfo.waste_fraction_pct?.toFixed(1) }}%
              </div>
              <div class="text-3xl font-bold text-text-muted" v-else>
                -
              </div>
              <p class="text-xs text-text-muted mt-2">Area sampah terdeteksi</p>
            </div>
          </div>

          <div class="card p-6">
            <div class="text-center">
              <h2 class="text-sm font-medium text-text-muted mb-2">Status Simpan</h2>
              <div v-if="livePayload" class="flex items-center justify-center gap-2">
                <span :class="livePayload.saved ? 'text-positive' : 'text-text-muted'" class="font-medium">
                  {{ livePayload.saved ? 'Tersimpan' : 'Dilewati' }}
                </span>
                <Badge v-if="livePayload.skip_reason" class="badge-neutral text-xs">
                  {{ livePayload.skip_reason }}
                </Badge>
              </div>
              <div v-else class="text-text-muted">-</div>
              <p class="text-xs text-text-muted mt-2">
                Run ID: {{ livePayload?.run_id?.slice(0, 8) }}...
              </p>
            </div>
          </div>
        </div>

        <!-- Recent History (from latest completed job, outputs served via authenticated endpoint) -->
        <div class="card">
          <div class="p-4 border-b border-border">
            <h2 class="text-lg font-medium text-text">Riwayat Prediksi Terbaru</h2>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="outputType in Object.keys(latestPrediction?.outputs || {})"
                :key="outputType"
                class="card overflow-hidden"
              >
                <div class="p-3 border-b border-border bg-muted/50">
                  <h3 class="text-sm font-medium text-text capitalize">{{ outputType.replace(/_/g, ' ') }}</h3>
                </div>
                <div class="aspect-video relative bg-neutral-bg">
                  <img
                    v-if="latestPrediction?.outputs[outputType]"
                    :src="getImageUrl(latestPrediction.outputs[outputType])"
                    :alt="outputType"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="absolute inset-0 flex items-center justify-center text-text-muted">
                    Tidak tersedia
                  </div>
                </div>
              </div>

              <div v-if="!latestPrediction?.outputs || Object.keys(latestPrediction.outputs).length === 0" 
                   class="col-span-full text-center py-8 text-text-muted">
                Belum ada output prediksi tersedia
              </div>
            </div>
          </div>
        </div>

        <!-- Debug Info -->
        <details class="card p-4">
          <summary class="cursor-pointer text-sm font-medium text-text-muted">Detail Teknis (Live Payload)</summary>
          <pre class="mt-2 text-xs text-text-muted bg-neutral-bg p-3 rounded overflow-auto">
{{ JSON.stringify(livePayload || latestPrediction, null, 2) }}
          </pre>
        </details>
      </div>
    </main>

    <footer class="border-t border-border bg-card py-4">
      <div class="container mx-auto px-4 text-center text-sm text-text-muted">
        SIVERA Waste Volume Estimation — Public Live View
      </div>
    </footer>
  </div>
</template>
