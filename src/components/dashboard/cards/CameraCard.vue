<template>
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-medium text-gray-900">{{ camera.name }}</h3>
        <p class="text-sm text-gray-500">
          {{ camera.resolution_w }}x{{ camera.resolution_h }} @ {{ camera.fps }} FPS
        </p>
        <p class="text-xs text-gray-400 mt-1">
          {{ formatDate(camera.created_at) }}
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <Button variant="ghost" size="sm" @click="$emit('edit', camera)">
          Edit
        </Button>
        <Button variant="ghost" size="sm" @click="$emit('delete', camera)" class="text-destructive hover:text-destructive/80">
          Hapus
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import type { Camera } from '@/types'

const props = defineProps({
  camera: {
    type: Object as () => Camera,
    required: true
  }
})

const emit = defineEmits<{
  edit: [camera: Camera]
  delete: [camera: Camera]
}>()

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>