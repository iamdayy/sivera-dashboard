<template>
  <header class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-8">
          <router-link to="/dashboard" class="text-xl font-bold text-gray-900 hover:text-primary transition-colors">
            Sivera Dashboard
          </router-link>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center space-x-1" aria-label="Navigasi utama">
            <router-link to="/"
              class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Beranda
            </router-link>
            <router-link to="/dashboard"
              class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Dashboard
            </router-link>
            <a :href="apiDocsUrl" target="_blank" rel="noopener noreferrer"
              class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Dokumentasi API
            </a>
          </nav>
        </div>

        <!-- Auth Actions -->
        <div class="flex items-center space-x-3">
          <div v-if="hasApiKey" class="flex items-center space-x-2">
            <span class="text-sm text-gray-500 hidden sm:block">Terhubung</span>
            <Button variant="secondary" size="sm" @click="logout">
              Keluar
            </Button>
          </div>
          <router-link v-else to="/"
            class="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            Masuk / Atur API Key
          </router-link>
        </div>

        <!-- Mobile Navigation -->
        <MobileNav :has-api-key="hasApiKey" @logout="logout" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useApiStore } from '@/stores/api'
import { computed } from 'vue'
import MobileNav from './MobileNav.vue'

const apiStore = useApiStore()

const hasApiKey = computed(() => apiStore.hasApiKey)

const apiDocsUrl = computed(() => {
  const base = (localStorage.getItem('api_base_url') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')
  return `${base}/docs`
})

const logout = () => {
  apiStore.clearApiKey()
}
</script>