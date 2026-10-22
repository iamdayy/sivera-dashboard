import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { assertCurrentConnection, checkHealth, clearConnectionKey, connectionState, getConnectionContext, normalizeApiError, setConnection } from '@/services/api'
import { listCameras } from '@/services/cameras'
import type { HealthStatus } from '@/types'

export type ConnectionStatus = 'idle' | 'checking' | 'ok' | 'degraded' | 'error'
export type AccessStatus = 'unverified' | 'checking' | 'verified' | 'denied' | 'error'

export const useApiStore = defineStore('api', () => {
  const apiKey = ref(getConnectionContext().key)
  const hasApiKey = computed(() => Boolean(apiKey.value))
  const accessStatus = ref<AccessStatus>('unverified')
  const isAuthenticated = computed(() => accessStatus.value === 'verified')
  const connectionStatus = ref<ConnectionStatus>('idle')
  const origin = computed(() => connectionState.value.origin)
  const generation = computed(() => connectionState.value.generation)
  const configurationNotice = computed(() => connectionState.value.notice)

  watch(generation, () => {
    apiKey.value = getConnectionContext().key
    accessStatus.value = 'unverified'
    connectionStatus.value = 'idle'
  }, { flush: 'sync' })

  function configure(url: string, key: string) {
    return setConnection(url, key)
  }

  function setApiKey(key: string): void {
    configure(origin.value, key)
  }

  function clearApiKey(): void {
    clearConnectionKey()
  }

  async function testConnection(): Promise<HealthStatus> {
    const context = getConnectionContext()
    connectionStatus.value = 'checking'
    try {
      const health = await checkHealth()
      assertCurrentConnection(context)
      connectionStatus.value = health.status === 'healthy' && health.database === 'connected' ? 'ok' : 'degraded'
      return health
    } catch (error) {
      assertCurrentConnection(context)
      connectionStatus.value = 'error'
      throw error
    }
  }

  async function testApiKey(): Promise<{ valid: boolean; message: string }> {
    if (!hasApiKey.value) return { valid: false, message: 'API Key belum disetel.' }
    const context = getConnectionContext()
    accessStatus.value = 'checking'
    try {
      await listCameras(1, 1)
      assertCurrentConnection(context)
      accessStatus.value = 'verified'
      return { valid: true, message: 'Akses camera:read terverifikasi. Izin operasi lain belum diperiksa.' }
    } catch (error) {
      assertCurrentConnection(context)
      const normalized = normalizeApiError(error)
      accessStatus.value = normalized.status === 401 || normalized.status === 403 ? 'denied' : 'error'
      return { valid: false, message: normalized.status === 403 ? 'Akses ditolak. Scope camera:read dan izin kamera diperlukan; izin operasi lain belum diperiksa.' : normalized.message }
    }
  }

  const connectionContext = computed(() => getConnectionContext())

  return { apiKey, hasApiKey, isAuthenticated, origin, generation, configurationNotice, accessStatus, connectionStatus, configure, setApiKey, clearApiKey, testConnection, testApiKey, connectionContext }
})
