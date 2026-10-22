<template>
  <header class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-wrap items-center justify-between gap-2 min-h-16 py-2">
        <div class="flex min-w-0 flex-wrap items-center gap-4 lg:gap-8">
          <router-link to="/dashboard" class="inline-flex min-h-11 items-center text-lg sm:text-xl font-bold text-gray-900 hover:text-primary transition-colors">
            Sivera Dashboard
          </router-link>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex flex-wrap items-center gap-1" aria-label="Navigasi utama">
            <router-link to="/"
              class="inline-flex min-h-11 items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Beranda
            </router-link>
            <router-link to="/dashboard"
              class="inline-flex min-h-11 items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Dashboard
            </router-link>
            <a v-if="apiDocsUrl" :href="apiDocsUrl" target="_blank" rel="noopener noreferrer"
              class="inline-flex min-h-11 items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Dokumentasi API
            </a>
          </nav>
        </div>

        <!-- Auth Actions -->
        <div class="ml-auto flex shrink-0 items-center space-x-3">
          <div v-if="hasApiKey" class="flex items-center space-x-2">
            <span class="text-sm text-gray-600 hidden lg:block">{{ apiStore.accessStatus === 'verified' ? 'Akses kamera terverifikasi' : 'API Key tersimpan' }}</span>
            <Button variant="secondary" size="sm" class="min-h-11 min-w-11" @click="logout">
              Keluar
            </Button>
          </div>
          <router-link v-else to="/dashboard/settings"
            aria-label="Masuk / Atur API Key"
            class="inline-flex min-h-11 items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <span class="sm:hidden">API Key</span>
            <span class="hidden sm:inline">Masuk / Atur API Key</span>
          </router-link>
        </div>

        <!-- Mobile Navigation -->
        <MobileNav :has-api-key="hasApiKey" @logout="logout" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import { useApiStore } from '@/stores/api'
import { computed } from 'vue'
import MobileNav from './MobileNav.vue'

const apiStore = useApiStore()

const hasApiKey = computed(() => apiStore.hasApiKey)

const apiDocsUrl = computed(() => apiStore.origin ? `${apiStore.origin}/docs` : undefined)

const logout = () => {
  apiStore.clearApiKey()
}
</script>
