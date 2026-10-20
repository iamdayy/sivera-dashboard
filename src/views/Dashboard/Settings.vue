<template>
  <div class="space-y-6 max-w-3xl">
    <h1 class="text-2xl font-bold text-gray-900">Pengaturan</h1>

    <!-- API Configuration -->
    <Card class="p-6">
      <h2 class="text-lg font-semibold mb-4">Konfigurasi API</h2>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Base URL API</label>
          <input v-model="apiBaseUrl" type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="http://localhost:8000" />
          <p class="mt-1 text-sm text-gray-500">URL dasar untuk mengakses API backend (tanpa prefix /api/v1)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <div class="flex gap-2">
            <input v-model="apiKey" :type="showApiKey ? 'text' : 'password'"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Masukkan API Key Anda" />
            <Button variant="secondary" @click="showApiKey = !showApiKey" size="sm">
              {{ showApiKey ? 'Sembunyikan' : 'Tampilkan' }}
            </Button>
          </div>
          <p class="mt-1 text-sm text-gray-500">API Key untuk autentikasi (header: X-API-Key)</p>
        </div>

        <div>
          <Button variant="primary" @click="saveApiConfig" :isLoading="savingConfig">
            Simpan Konfigurasi
          </Button>
        </div>

        <div v-if="connectionTested" class="p-3 rounded-md"
          :class="connectionSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
          {{ connectionMessage }}
        </div>
      </div>
    </Card>

    <!-- About Section -->
    <Card class="p-6">
      <h2 class="text-lg font-semibold mb-4">Tentang</h2>

      <div class="space-y-3 text-sm text-gray-600">
        <div class="flex justify-between">
          <span>Versi Aplikasi</span>
          <span class="font-mono">0.1.0</span>
        </div>
        <div class="flex justify-between">
          <span>Build</span>
          <span class="font-mono">Development</span>
        </div>
        <div class="flex justify-between">
          <span>Framework</span>
          <span class="font-mono">Vue 3 + Vite + Tailwind CSS</span>
        </div>
        <div class="flex justify-between">
          <span>API Backend</span>
          <span class="font-mono">FastAPI (Sivera API)</span>
        </div>
        <div class="flex justify-between">
          <span>Dokumentasi API</span>
          <a :href="apiDocsUrl" target="_blank" class="text-primary hover:underline font-mono">
            /docs (Swagger UI)
          </a>
        </div>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { computed, onMounted, ref, watch } from 'vue'
import { setBaseUrl, checkHealth } from '@/services/api'

const apiStore = useApiStore()
const toast = useToast()

const apiBaseUrl = ref(localStorage.getItem('api_base_url') || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
const apiKey = ref(localStorage.getItem('api_key') || '')
const showApiKey = ref(false)
const savingConfig = ref(false)
const connectionTested = ref(false)
const connectionSuccess = ref(false)
const connectionMessage = ref('')

const apiDocsUrl = computed(() => {
  const base = apiBaseUrl.value.replace(/\/+$/, '')
  return `${base}/docs`
})

const saveApiConfig = async () => {
  savingConfig.value = true
  connectionTested.value = false

  try {
    setBaseUrl(apiBaseUrl.value)

    if (apiKey.value) {
      apiStore.setApiKey(apiKey.value)
    } else {
      apiStore.clearApiKey()
    }

    await apiStore.testConnection()
    connectionSuccess.value = true
    connectionMessage.value = 'Koneksi ke API berhasil!'
    toast.success('Konfigurasi disimpan', {
      description: 'Koneksi ke API berhasil!',
    })
  } catch (error: unknown) {
    connectionSuccess.value = false
    const err = error as { response?: { data?: { detail?: string } }; message?: string }
    connectionMessage.value = 'Gagal terhubung ke API: ' + (err.response?.data?.detail || err.message)
    toast.error('Gagal terhubung ke API', {
      description: err.response?.data?.detail || err.message,
    })
  } finally {
    connectionTested.value = true
    savingConfig.value = false
  }
}

onMounted(() => {
  // Initialize from localStorage
  const savedApiUrl = localStorage.getItem('api_base_url')
  if (savedApiUrl) apiBaseUrl.value = savedApiUrl

  const savedApiKey = localStorage.getItem('api_key')
  if (savedApiKey) apiKey.value = savedApiKey
})
</script>