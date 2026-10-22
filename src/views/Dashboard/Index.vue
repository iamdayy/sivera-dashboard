<template>
  <div class="min-h-screen flex flex-col">
    <Header />
    <main class="flex-1 p-4">
      <router-view v-slot="{ Component }">
        <component :is="Component" :key="route.path === '/dashboard/settings' ? 'settings' : apiStore.generation" />
      </router-view>
    </main>

    <footer class="bg-white py-6 border-t">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <p class="text-sm text-gray-600">
            Sivera Dashboard v0.1.0 &bull; Monitoring CCTV &bull; Estimasi Volume Sampah
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import Header from '@/components/layout/Header.vue'
import { useApiStore } from '@/stores/api'
import { useRoute } from 'vue-router'

const apiStore = useApiStore()
const route = useRoute()
</script>
