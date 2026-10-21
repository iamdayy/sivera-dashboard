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
              placeholder="http://localhost:8000/api/v1"
            />
            <p id="api-base-help" class="text-sm text-muted-foreground">
              Gunakan URL dasar sesuai konfigurasi backend, termasuk prefix jika ada.
            </p>
          </div>

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
                :href="apiDocsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
                >/docs (Swagger UI)</a
              >
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { setBaseUrl } from '@/services/api'
import { version } from '../../../package.json'

const apiStore = useApiStore()
const toast = useToast()
const apiBaseUrl = ref(
  localStorage.getItem('api_base_url') ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:8000',
)
const apiKey = ref(localStorage.getItem('api_key') || '')
const showApiKey = ref(false)
const savingConfig = ref(false)
const connectionTested = ref(false)
const connectionSuccess = ref(false)
const connectionMessage = ref('')
const about = [
  { label: 'Versi Aplikasi', value: version },
  { label: 'Build', value: import.meta.env.DEV ? 'Development' : 'Production' },
  { label: 'Framework', value: 'Vue 3 + Vite + Tailwind CSS' },
  { label: 'API Backend', value: 'FastAPI (Sivera API)' },
]
const apiDocsUrl = computed(
  () => `${apiBaseUrl.value.replace(/\/+$/, '').replace(/\/api\/v1$/, '')}/docs`,
)

async function saveApiConfig() {
  if (savingConfig.value) return
  savingConfig.value = true
  connectionTested.value = false
  try {
    setBaseUrl(apiBaseUrl.value)
    if (apiKey.value) apiStore.setApiKey(apiKey.value)
    else apiStore.clearApiKey()
    const keyTest = await apiStore.testApiKey()
    connectionSuccess.value = keyTest.valid
    connectionMessage.value = keyTest.message
    if (keyTest.valid) toast.success('Konfigurasi disimpan', { description: keyTest.message })
    else toast.error('Akses API belum terverifikasi', { description: keyTest.message })
  } catch {
    connectionSuccess.value = false
    connectionMessage.value = 'Gagal memvalidasi konfigurasi. Periksa URL API dan coba kembali.'
    toast.error(connectionMessage.value)
  } finally {
    connectionTested.value = true
    savingConfig.value = false
  }
}
</script>
