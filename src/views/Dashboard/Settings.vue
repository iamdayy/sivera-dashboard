<template>
  <div class="mx-auto w-full max-w-3xl space-y-6">
    <h1 class="text-2xl font-bold">Pengaturan</h1>

    <Card>
      <CardHeader>
        <CardTitle>Konfigurasi API</CardTitle>
        <CardDescription>Atur alamat backend dan periksa akses API Key Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="saveApiConfig">
          <div class="space-y-2">
            <Label for="api-base-url">Base URL API</Label>
            <Input
              id="api-base-url"
              v-model="apiBaseUrl"
              type="url"
              required
              aria-describedby="api-base-help"
              placeholder="http://localhost:8000"
            />
            <p id="api-base-help" class="text-sm text-muted-foreground">
              Gunakan origin tanpa prefix. Request kamera memakai /api/v1/cameras; /health dan /docs di luar prefix.
            </p>
          </div>

          <Alert v-if="apiStore.configurationNotice || migrationMessage">
            <AlertTitle>Konfigurasi alamat API</AlertTitle>
            <AlertDescription>{{ migrationMessage || apiStore.configurationNotice }}</AlertDescription>
          </Alert>

          <div class="space-y-2">
            <Label for="api-key">API Key</Label>
            <div class="flex flex-col gap-2 min-[400px]:flex-row">
              <Input
                id="api-key"
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                autocomplete="off"
                spellcheck="false"
                aria-describedby="api-key-help"
                placeholder="Masukkan API Key Anda"
              />
              <Button
                type="button"
                variant="secondary"
                :aria-pressed="showApiKey"
                aria-controls="api-key"
                @click="showApiKey = !showApiKey"
                >{{ showApiKey ? 'Sembunyikan' : 'Tampilkan' }}</Button
              >
            </div>
            <p id="api-key-help" class="text-sm text-muted-foreground">
              Dikirim melalui header X-API-Key dan disimpan di browser ini. Jangan gunakan key
              produksi berprivilege tinggi.
            </p>
          </div>

          <Button type="submit" :disabled="savingConfig" :aria-busy="savingConfig">
            {{ savingConfig ? 'Memvalidasi konfigurasi...' : 'Simpan Konfigurasi' }}
          </Button>
          <Alert
            v-if="connectionTested"
            :variant="connectionSuccess ? 'default' : 'destructive'"
            aria-live="polite"
          >
            <AlertTitle>{{
              connectionSuccess ? 'Akses API terverifikasi' : 'Akses API belum terverifikasi'
            }}</AlertTitle>
            <AlertDescription>{{ connectionMessage }}</AlertDescription>
          </Alert>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Kesehatan Backend</CardTitle><CardDescription>Probe /health memeriksa API dan database, bukan worker, MediaMTX, atau izin key.</CardDescription></CardHeader>
      <CardContent class="space-y-3">
        <Button variant="outline" :disabled="apiStore.connectionStatus === 'checking' || savingConfig" @click="testHealth">{{ apiStore.connectionStatus === 'checking' ? 'Memeriksa backend...' : 'Periksa Backend' }}</Button>
        <p v-if="healthMessage" role="status" class="text-sm">{{ healthMessage }}</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Tentang</CardTitle></CardHeader>
      <CardContent>
        <dl class="space-y-3 text-sm">
          <div
            v-for="item in about"
            :key="item.label"
            class="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-4"
          >
            <dt class="text-muted-foreground">{{ item.label }}</dt>
            <dd class="sm:text-right">{{ item.value }}</dd>
          </div>
          <div class="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-4">
            <dt class="text-muted-foreground">Dokumentasi API</dt>
            <dd class="sm:text-right">
              <a
                v-if="apiDocsUrl"
                :href="apiDocsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
                >/docs (Swagger UI)</a
              >
              <span v-else>Atur origin API terlebih dahulu.</span>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { getConnectionContext, isCurrentConnection } from '@/services/api'
import { version } from '../../../package.json'

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
  { label: 'Framework', value: 'Vue 3 + Vite + Tailwind CSS' },
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
    healthMessage.value = apiStore.connectionStatus === 'ok' ? `API sehat, database terhubung. Versi ${health.version}.` : 'API merespons, tetapi kesehatan backend menurun atau database belum terhubung.'
  } catch {
    if (!active || !isCurrentConnection(context)) return
    healthMessage.value = 'Backend belum dapat dihubungi. Periksa origin tersimpan dan koneksi jaringan.'
  }
}
</script>
