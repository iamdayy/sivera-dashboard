<template>
  <header class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <router-link to="/dashboard" class="text-lg font-bold text-gray-900 hover:text-primary transition-colors">
            Sivera Dashboard
          </router-link>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center space-x-1" aria-label="Navigasi utama">
            <router-link to="/"
              class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Landing
            </router-link>
            <router-link to="/dashboard"
              class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Dashboard
            </router-link>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer"
              class="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
              Dokumentasi API
            </a>
          </nav>

          <!-- Auth Actions -->
          <div class="flex items-center space-x-2">
            <button v-if="isAuthenticated" @click="logout"
              class="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
              Logout
            </button>
            <router-link v-else to="/"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Masuk
            </router-link>
          </div>

          <!-- Mobile Navigation -->
          <MobileNav />
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useApiStore } from '@/stores/api'
import { onMounted, ref } from 'vue'
import MobileNav from './MobileNav.vue'

const isAuthenticated = ref(false)

const apiStore = useApiStore()

const checkAuth = async () => {
  try {
    await apiStore.testConnection()
    isAuthenticated.value = true
  } catch (error) {
    isAuthenticated.value = false
  }
}

onMounted(() => {
  checkAuth()
})

const logout = () => {
  apiStore.clearApiKey()
  isAuthenticated.value = false
}
</script>