import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { checkHealth } from '@/services/api'
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

  return { apiKey, hasApiKey, isAuthenticated, connectionStatus, setApiKey, clearApiKey, testConnection }
})