<template>
  <header
    class="fixed top-0 right-0 left-0 z-40 h-12 border-b border-frame-border bg-frame transition-all duration-200 lg:left-[var(--sidebar-width)]"
  >
    <div class="flex h-full items-center gap-2 px-3 sm:px-4">
      <button
        v-if="isMobile"
        type="button"
        class="btn btn-ghost h-11 min-h-11 w-11 min-w-11 shrink-0 p-0"
        aria-label="Buka menu navigasi"
        :aria-expanded="sidebarOpen"
        aria-controls="sidebar"
        @click="emit('toggle-sidebar')"
      >
        <Menu class="h-5 w-5" aria-hidden="true" />
      </button>

      <nav
        v-if="breadcrumbs.length > 0"
        class="hidden min-w-0 flex-1 sm:block"
        aria-label="Breadcrumb"
      >
        <ol class="flex flex-nowrap items-center gap-1 overflow-hidden" role="list">
          <li v-for="(crumb, index) in breadcrumbs" :key="crumb.path" class="flex min-w-0 items-center gap-1">
            <RouterLink
              v-if="index < breadcrumbs.length - 1"
              :to="crumb.path"
              class="inline-flex h-11 min-h-11 min-w-11 items-center justify-center truncate rounded-md px-2 text-sm text-text-muted hover:text-text"
            >
              {{ crumb.label }}
            </RouterLink>
            <span
              v-else
              class="truncate px-2 text-sm font-medium text-text"
              aria-current="page"
            >
              {{ crumb.label }}
            </span>
            <span v-if="index < breadcrumbs.length - 1" class="text-text-muted" aria-hidden="true">/</span>
          </li>
        </ol>
      </nav>

      <div class="ml-auto flex shrink-0 items-center gap-1">
        <div class="hidden items-center gap-2 rounded-md border border-sheet-border bg-sheet px-3 py-1 md:flex">
          <span class="status-dot shrink-0" :class="healthStatusClass" aria-hidden="true" />
          <span class="text-sm font-medium" :class="healthStatus === 'error' ? 'text-negative' : 'text-text'">
            {{ healthLabel }}
          </span>
        </div>

        <RouterLink
          v-if="!hasApiKey"
          to="/dashboard/settings"
          class="btn btn-primary h-11 min-h-11 w-11 min-w-11 p-0"
          aria-label="Atur API Key"
          title="Atur API Key"
        >
          <Key class="h-5 w-5" aria-hidden="true" />
        </RouterLink>

        <template v-else>
          <RouterLink
            to="/dashboard/settings"
            class="btn btn-secondary relative h-11 min-h-11 w-11 min-w-11 p-0"
            :aria-label="`Kelola API Key. ${accessStatusText}`"
            :title="accessStatusText"
          >
            <Key class="h-5 w-5" aria-hidden="true" />
            <span
              class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-sheet"
              :class="accessDotClass"
              aria-hidden="true"
            />
          </RouterLink>
          <button
            type="button"
            class="btn btn-ghost h-11 min-h-11 w-11 min-w-11 p-0 text-negative hover:text-negative"
            aria-label="Keluar"
            title="Keluar"
            @click="logout"
          >
            <LogOut class="h-5 w-5" aria-hidden="true" />
          </button>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useApiStore } from '@/stores/api'
import { checkHealth } from '@/services/api'
import { Menu, Key, LogOut } from '@lucide/vue'

defineProps<{
  sidebarOpen: boolean
}>()

const emit = defineEmits<{
  'toggle-sidebar': []
}>()

const router = useRouter()
const route = useRoute()
const apiStore = useApiStore()

const isMobile = ref(false)
const healthStatus = ref<'healthy' | 'checking' | 'error'>('checking')
let healthInterval: ReturnType<typeof setInterval> | null = null
let disposed = false

const hasApiKey = computed(() => apiStore.hasApiKey)
const accessStatus = computed(() => apiStore.accessStatus)

const accessStatusText = computed(() => {
  switch (accessStatus.value) {
    case 'verified': return 'Akses kamera terverifikasi'
    case 'checking': return 'Memverifikasi akses'
    case 'denied': return 'Akses kamera ditolak'
    case 'error': return 'Gagal memverifikasi akses'
    default: return 'Akses belum diverifikasi'
  }
})

const accessDotClass = computed(() => {
  switch (accessStatus.value) {
    case 'verified': return 'bg-positive'
    case 'checking': return 'bg-warning'
    case 'denied':
    case 'error': return 'bg-negative'
    default: return 'bg-control'
  }
})

const healthLabel = computed(() => {
  if (healthStatus.value === 'healthy') return 'Backend sehat'
  if (healthStatus.value === 'checking') return 'Memeriksa backend'
  return 'Backend tidak sehat'
})

const healthStatusClass = computed(() => {
  switch (healthStatus.value) {
    case 'healthy': return 'status-dot-positive'
    case 'checking': return 'status-dot-warning'
    case 'error': return 'status-dot-negative'
  }
})

const breadcrumbLabels: Record<string, string> = {
  cameras: 'Kamera',
  calibrations: 'Kalibrasi',
  'ground-references': 'Referensi Tanah',
  predictions: 'Analisis Sampah',
  settings: 'Pengaturan',
}

const breadcrumbs = computed(() => {
  const crumbs = [{ path: '/dashboard', label: 'Ringkasan' }]
  if (route.path === '/dashboard') return crumbs

  const segment = route.path.replace('/dashboard/', '').split('/')[0]
  if (!segment) return crumbs
  crumbs.push({
    path: `/dashboard/${segment}`,
    label: breadcrumbLabels[segment] ?? segment.replace(/-/g, ' '),
  })
  return crumbs
})

function checkMobile() {
  isMobile.value = window.innerWidth < 1024
}

async function checkBackendHealth() {
  healthStatus.value = 'checking'
  try {
    const result = await checkHealth()
    if (disposed) return
    healthStatus.value = result.status === 'healthy' ? 'healthy' : 'error'
  } catch {
    if (disposed) return
    healthStatus.value = 'error'
  }
}

function logout() {
  apiStore.clearApiKey()
  router.push('/dashboard/settings')
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  checkBackendHealth()
  healthInterval = setInterval(checkBackendHealth, 60000)
})

onUnmounted(() => {
  disposed = true
  window.removeEventListener('resize', checkMobile)
  if (healthInterval) clearInterval(healthInterval)
})
</script>
