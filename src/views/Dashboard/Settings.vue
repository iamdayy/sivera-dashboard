<template>
  <div class="mx-auto w-full max-w-3xl space-y-6">
    <h1 class="text-2xl font-bold text-text">Pengaturan</h1>

    <Card>
      <div class="card-header">
        <h2 class="card-title">Konfigurasi API</h2>
        <p class="card-description">Atur alamat backend dan periksa akses API Key Anda.</p>
      </div>
      <div class="card-content space-y-4">
        <form @submit.prevent="saveApiConfig" class="space-y-4">
          <div class="space-y-2">
            <Label for="api-base-url">Base URL API</Label>
            <Input
              id="api-base-url"
              v-model="apiBaseUrl"
              type="url"
              required
              aria-describedby="api-base-help"
              placeholder="http://localhost:8000"
              class="input"
            />
            <p id="api-base-help" class="text-sm text-text-muted">
              Gunakan origin tanpa prefix. Request kamera memakai <code class="font-mono text-xs bg-frame px-1 rounded">/api/v1/cameras</code>; <code class="font-mono text-xs bg-frame px-1 rounded">/health</code> dan <code class="font-mono text-xs bg-frame px-1 rounded">/docs</code> di luar prefix.
            </p>
          </div>

          <div v-if="apiStore.configurationNotice || migrationMessage" class="p-3 rounded-lg bg-warning-bg/50 border border-warning-border">
            <p class="font-medium text-text">Konfigurasi alamat API</p>
            <p class="text-sm text-text-muted mt-1">{{ migrationMessage || apiStore.configurationNotice }}</p>
          </div>

          <div class="space-y-2">
            <Label for="api-key">API Key</Label>
            <div class="flex flex-col gap-2 min-[400px]:flex-row">
              <Input
                id="api-key"
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                autocomplete="off"
                :spellcheck="false"
                aria-describedby="api-key-help"
                placeholder="Masukkan API Key Anda"
                class="input"
              />
              <Button
                type="button"
                variant="secondary"
                :aria-pressed="showApiKey"
                aria-controls="api-key"
                @click="showApiKey = !showApiKey"
                class="btn-sm"
              >
                {{ showApiKey ? 'Sembunyikan' : 'Tampilkan' }}
              </Button>
            </div>
            <p id="api-key-help" class="text-sm text-text-muted">
              Dikirim melalui header <code class="font-mono text-xs bg-frame px-1 rounded">X-API-Key</code> dan disimpan di browser ini. Jangan gunakan key produksi berprivilege tinggi.
            </p>
          </div>

          <Button type="submit" :disabled="savingConfig" :aria-busy="savingConfig" variant="primary" class="w-full sm:w-auto">
            {{ savingConfig ? 'Memvalidasi konfigurasi...' : 'Simpan Konfigurasi' }}
          </Button>

          <div v-if="connectionTested" class="p-3 rounded-lg" :class="connectionSuccess ? 'bg-positive-bg border-positive-border' : 'bg-negative-bg border-negative-border'" role="alert" aria-live="polite">
            <p class="font-medium" :class="connectionSuccess ? 'text-positive' : 'text-negative'">
              {{ connectionSuccess ? 'Akses API terverifikasi' : 'Akses API belum terverifikasi' }}
            </p>
            <p class="text-sm text-text-muted mt-1">{{ connectionMessage }}</p>
          </div>
        </form>
      </div>
    </Card>

    <Card>
      <div class="card-header">
        <h2 class="card-title">Kesehatan Backend</h2>
        <p class="card-description">Probe <code class="font-mono text-xs bg-frame px-1 rounded">/health</code> memeriksa API dan database, bukan worker, MediaMTX, atau izin key.</p>
      </div>
      <div class="card-content space-y-3">
        <Button 
          variant="outline" 
          :disabled="apiStore.connectionStatus === 'checking' || savingConfig" 
          @click="testHealth"
          class="w-full sm:w-auto"
        >
          {{ apiStore.connectionStatus === 'checking' ? 'Memeriksa backend...' : 'Periksa Backend' }}
        </Button>
        <p v-if="healthMessage" role="status" class="text-sm" :class="healthMessage.startsWith('API sehat') ? 'text-positive' : 'text-negative'">{{ healthMessage }}</p>
      </div>
    </Card>

    <Card>
      <div class="card-header">
        <h2 class="card-title">Tentang</h2>
      </div>
      <div class="card-content">
        <dl class="space-y-3 text-sm">
          <div v-for="item in about" :key="item.label" class="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-4">
            <dt class="text-text-muted">{{ item.label }}</dt>
            <dd class="sm:text-right text-text">{{ item.value }}</dd>
          </div>
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-4">
            <dt class="text-text-muted">Dokumentasi API</dt>
            <dd class="sm:text-right">
              <a
                v-if="apiDocsUrl"
                :href="apiDocsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-brand hover:underline"
              >
                /docs (Swagger UI)
              </a>
              <span v-else class="text-text-muted">Atur origin API terlebih dahulu.</span>
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { getConnectionContext, isCurrentConnection } from '@/services/api'
import { version } from '../../../package.json'

// UI Components
import { Button, Input, Label } from '@/components/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui'

const apiStore = useApiStore()
const toast = useToast()
const apiBaseUrl = ref(apiStore.origin)
const apiKey = ref(apiStore.apiKey)
const migrationMessage = ref('')
const healthMessage = ref('')
const showApiKey = ref(false)
const savingConfig = ref(false)
const connectionTested = ref(false)
const connectionSuccess = ref(false)
const connectionMessage = ref('')

let active = true
onScopeDispose(() => { active = false })

watch(() => apiStore.generation, () => {
  apiBaseUrl.value = apiStore.origin
  apiKey.value = apiStore.apiKey
  showApiKey.value = false
  migrationMessage.value = ''
  connectionTested.value = false
  connectionMessage.value = ''
  healthMessage.value = ''
}, { flush: 'sync' })

const about = [
  { label: 'Versi Aplikasi', value: version },
  { label: 'Build', value: import.meta.env.DEV ? 'Development' : 'Production' },
  { label: 'Framework', value: 'Vue 3 + Vite + Tailwind CSS v4' },
  { label: 'API Backend', value: 'FastAPI (Sivera API)' },
]

const apiDocsUrl = computed(() => apiStore.origin ? `${apiStore.origin}/docs` : undefined)

async function saveApiConfig() {
  if (savingConfig.value) return
  savingConfig.value = true
  connectionTested.value = false
  let context = getConnectionContext()
  try {
    const { migrated } = apiStore.configure(apiBaseUrl.value, apiKey.value)
    migrationMessage.value = migrated ? 'Prefix /api/v1 telah dipisahkan; alamat tersimpan hanya origin.' : ''
    apiBaseUrl.value = apiStore.origin
    context = getConnectionContext()
    const keyTest = await apiStore.testApiKey()
    if (!active || !isCurrentConnection(context)) return
    connectionSuccess.value = keyTest.valid
    connectionMessage.value = keyTest.message
    if (keyTest.valid) toast.success('Konfigurasi disimpan', { description: keyTest.message })
    else toast.error('Akses API belum terverifikasi', { description: keyTest.message })
  } catch (error) {
    if (!active || !isCurrentConnection(context)) return
    connectionSuccess.value = false
    connectionMessage.value = error instanceof Error ? error.message : 'Gagal memvalidasi konfigurasi. Periksa URL API dan coba kembali.'
    toast.error(connectionMessage.value)
  } finally {
    if (active && isCurrentConnection(context)) connectionTested.value = true
    savingConfig.value = false
  }
}

async function testHealth() {
  const context = getConnectionContext()
  healthMessage.value = ''
  try {
    const health = await apiStore.testConnection()
    if (!active || !isCurrentConnection(context)) return
    healthMessage.value = apiStore.connectionStatus === 'ok' 
      ? `API sehat, database terhubung. Versi ${health.version}.` 
      : 'API merespons, tetapi kesehatan backend menurun atau database belum terhubung.'
  } catch {
    if (!active || !isCurrentConnection(context)) return
    healthMessage.value = 'Backend belum dapat dihubungi. Periksa origin tersimpan dan koneksi jaringan.'
  }
}
</script>