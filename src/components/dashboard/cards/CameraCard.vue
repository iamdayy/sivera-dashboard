<template>
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow p-4">
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
        <button @click="editCamera" class="px-2 py-1 text-sm font-medium text-primary hover:text-primary/80">
          Edit
        </button>
        <button @click="deleteCamera" class="px-2 py-1 text-sm font-medium text-destructive hover:text-destructive/80">
          Hapus
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast';
import { apiClient } from '@/services/api';
import { useApiStore } from '@/stores/api';
import { useRouter } from 'vue-router';

const props = defineProps({
  camera: {
    type: Object,
    required: true
  }
})

const router = useRouter()
const apiStore = useApiStore()
const toast = useToast()

const editCamera = () => {
  router.push(`/dashboard/cameras/${props.camera.id}/edit`)
}

const deleteCamera = async () => {
  if (confirm('Apakah Anda yakin ingin menghapus camera ini?')) {
    try {
      await apiClient.delete(`/cameras/${props.camera.id}`)
      // In a real app, we would refetch the list or use a store to update
      toast.success('Camera berhasil dihapus')
      router.push('/dashboard/cameras')
    } catch (error: any) {
      toast.error('Gagal menghapus camera', {
        description: error.message,
      })
    }
  }
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
</script>