import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { checkHealth } from '@/services/api'
import { apiClient } from '@/services/api'
import type { HealthStatus } from '@/types'

export type ConnectionStatus = 'idle' | 'checking' | 'ok' | 'error'

export const useApiStore = defineStore('api', () => {
  // Key hanya dari input pengguna; tidak pernah ada fallback bawaan.
  const apiKey = ref<string | null>(localStorage.getItem('api_key'))
  const hasApiKey = computed(() => Boolean(apiKey.value))
  const isAuthenticated = computed(() => Boolean(apiKey.value))
  const connectionStatus = ref<ConnectionStatus>('idle')

  function setApiKey(key: string): void {
    apiKey.value = key
    localStorage.setItem('api_key', key)
  }

  function clearApiKey(): void {
    apiKey.value = null
    localStorage.removeItem('api_key')
    connectionStatus.value = 'idle'
  }

  // /health tanpa auth: hanya membuktikan konektivitas, bukan validitas key.
  async function testConnection(): Promise<HealthStatus> {
    connectionStatus.value = 'checking'
    try {
      const health = await checkHealth()
      connectionStatus.value = 'ok'
      return health
    } catch (error) {
      connectionStatus.value = 'error'
      throw error
    }
  }

  // Test API key validity by calling an authenticated endpoint
  async function testApiKey(): Promise<{ valid: boolean; message: string }> {
    if (!hasApiKey.value) {
      return { valid: false, message: 'API Key belum disetel' }
    }
    try {
      // Try to list cameras (requires camera:read scope)
      const response = await apiClient.get('/cameras', { params: { page: 1, page_size: 1 } })
      return { valid: true, message: 'API Key valid dan memiliki akses' }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { detail?: string; message?: string } } }
      if (err.response?.status === 401) {
        return { valid: false, message: 'API Key tidak valid atau sudah kedaluwarsa' }
      }
      if (err.response?.status === 403) {
        return { valid: false, message: 'API Key tidak memiliki izin yang cukup (scope camera:read diperlukan)' }
      }
      const msg = err.response?.data?.detail || err.response?.data?.message || String(error)
      return { valid: false, message: `Gagal memvalidasi API Key: ${msg}` }
    }
  }

  return { apiKey, hasApiKey, isAuthenticated, connectionStatus, setApiKey, clearApiKey, testConnection, testApiKey }
})