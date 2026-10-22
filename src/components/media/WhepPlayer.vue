<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import type { ConnectionContext } from '@/services/api'
import { useWhepPlayer } from '@/composables/useWhepPlayer'
import Button from '@/components/ui/Button.vue'

interface Props {
  cameraId: string
  whepPath: string
  context: ConnectionContext
  autoplay?: boolean
  muted?: boolean
  playsInline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  muted: true,
  playsInline: true,
})

const videoRef = shallowRef<HTMLVideoElement | null>(null)
const localError = ref<string | null>(null)
const isReconnecting = ref(false)

const { state, connect, reconnect, cleanup } = useWhepPlayer({
  cameraId: props.cameraId,
  whepPath: props.whepPath,
  context: props.context,
  onTrack: (track) => {
    if (videoRef.value) {
      const currentStream = videoRef.value.srcObject as MediaStream | null
      if (!currentStream || !currentStream.getTracks().includes(track)) {
        videoRef.value.srcObject = new MediaStream([track])
      }
    }
  },
  onError: (error) => {
    localError.value = error.message
  },
})

onMounted(() => {
  connect()
})

async function handleReconnect() {
  isReconnecting.value = true
  localError.value = null
  try {
    await reconnect()
  } finally {
    isReconnecting.value = false
  }
}

function handleVideoError() {
  if (!localError.value) {
    localError.value = 'Video tidak dapat diputar. Coba Reconnect.'
  }
}
</script>

<template>
  <div class="relative bg-gray-900 rounded-lg overflow-hidden">
    <video
      ref="videoRef"
      class="w-full h-full object-contain"
      :autoplay="autoplay"
      :muted="muted"
      :playsinline="playsInline"
      @error="handleVideoError"
    />

    <div class="absolute inset-0 flex items-center justify-center bg-gray-900/50" v-if="state.status === 'connecting'">
      <div class="text-center text-white">
        <div class="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent mx-auto mb-3" />
        <p>Menghubungkan ke stream...</p>
        <p class="text-sm text-gray-400 mt-1">{{ state.iceConnectionState || 'menyiapkan' }}</p>
      </div>
    </div>

    <div class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 p-4" v-if="state.status === 'failed' || localError">
      <svg class="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p class="text-white text-center mb-3">{{ localError || state.error }}</p>
      <Button
        variant="primary"
        :disabled="isReconnecting"
        @click="handleReconnect"
        class="min-w-[140px]"
      >
        {{ isReconnecting ? 'Menghubungkan...' : 'Reconnect' }}
      </Button>
    </div>

    <div class="absolute inset-0 flex items-center justify-center bg-gray-900/70 p-4" v-if="state.status === 'disconnected' && !localError">
      <p class="text-white text-center">Stream terputus</p>
      <Button variant="primary" @click="handleReconnect" class="min-w-[140px] mt-3">
        Reconnect
      </Button>
    </div>

    <div class="absolute bottom-2 right-2 flex gap-2" v-if="state.status === 'connected'">
      <span class="px-2 py-1 text-xs bg-green-600/80 text-white rounded">
        {{ state.iceConnectionState === 'connected' ? 'Live' : state.iceConnectionState }}
      </span>
    </div>
  </div>
</template>