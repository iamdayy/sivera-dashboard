<template>
  <aside
    id="sidebar"
    ref="sidebarRef"
    class="fixed inset-y-0 left-0 z-50 flex w-[min(14.25rem,85vw)] flex-col border-r border-frame-border bg-frame transition-transform duration-200 ease-out lg:w-[var(--sidebar-width)]"
    :class="{ '-translate-x-full': isMobile && !isOpen }"
    :role="isMobile ? 'dialog' : 'complementary'"
    :aria-modal="isMobile ? 'true' : undefined"
    aria-label="Menu navigasi dashboard"
    :inert="isMobile && !isOpen"
    :aria-hidden="isMobile && !isOpen ? 'true' : undefined"
    @keydown="onKeydown"
  >
    <div class="flex h-12 items-center gap-3 border-b border-frame-border px-4">
      <svg class="h-8 w-8 shrink-0 text-brand" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="currentColor" />
        <path d="M8 16L14 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="truncate text-lg font-semibold text-text">Sivera</span>
      <button
        v-if="isMobile"
        ref="closeButtonRef"
        type="button"
        class="btn btn-ghost ml-auto h-11 min-h-11 w-11 min-w-11 p-0"
        aria-label="Tutup menu navigasi"
        @click="close()"
      >
        <X class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="Menu dashboard">
      <ul class="space-y-1">
        <li v-for="item in navItems" :key="item.path">
          <RouterLink
            :to="item.path"
            class="sidebar-item"
            :class="{ active: isActiveRoute(item.path) }"
            :aria-current="isActiveRoute(item.path) ? 'page' : undefined"
            @click="onNavigate"
          >
            <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
            {{ item.label }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div class="border-t border-frame-border p-3">
      <template v-if="hasApiKey">
        <p class="flex items-center gap-2 text-xs text-text-muted">
          <span class="status-dot shrink-0" :class="accessStatusClass" aria-hidden="true" />
          <span>{{ accessStatusText }}</span>
        </p>
        <RouterLink
          to="/dashboard/settings"
          class="btn btn-secondary btn-sm mt-2 min-h-11 w-full"
          @click="onNavigate"
        >
          Kelola API Key
        </RouterLink>
      </template>
      <RouterLink
        v-else
        to="/dashboard/settings"
        class="btn btn-primary mt-0 min-h-11 w-full"
        @click="onNavigate"
      >
        Atur API Key
      </RouterLink>
    </div>
  </aside>

  <div
    v-if="isMobile && isOpen"
    class="fixed inset-0 z-40 bg-black/30"
    @click="close()"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApiStore } from '@/stores/api'
import { LayoutDashboard, Video, Settings, GitCompare, MapPin, Brain, X, Scale } from '@lucide/vue'
import type { Component } from 'vue'

interface NavItem {
  path: string
  label: string
  icon: Component
}

const emit = defineEmits<{
  'open-change': [value: boolean]
}>()

const route = useRoute()
const apiStore = useApiStore()

const isOpen = ref(false)
const isMobile = ref(false)
const sidebarRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLElement | null>(null)
let previousActiveElement: HTMLElement | null = null

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { path: '/dashboard/cameras', label: 'Kamera', icon: Video },
  { path: '/dashboard/calibrations', label: 'Kalibrasi', icon: GitCompare },
  { path: '/dashboard/ground-references', label: 'Referensi Tanah', icon: MapPin },
  { path: '/dashboard/depth-scales', label: 'Skala Kedalaman', icon: Scale },
  { path: '/dashboard/predictions', label: 'Analisis Sampah', icon: Brain },
  { path: '/dashboard/settings', label: 'Pengaturan', icon: Settings },
]

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

const accessStatusClass = computed(() => {
  switch (accessStatus.value) {
    case 'verified': return 'status-dot-positive'
    case 'checking': return 'status-dot-warning'
    case 'denied':
    case 'error': return 'status-dot-negative'
    default: return 'status-dot-neutral'
  }
})

function isActiveRoute(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function checkMobile() {
  isMobile.value = window.innerWidth < 1024
  if (!isMobile.value && isOpen.value) {
    isOpen.value = false
    emit('open-change', false)
    unlockScroll()
  }
}

function lockScroll() {
  document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  document.body.style.overflow = ''
}

function focusableElements(): HTMLElement[] {
  const root = sidebarRef.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(element => element.getClientRects().length > 0)
}

function open() {
  if (!isMobile.value || isOpen.value) return
  previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  isOpen.value = true
  emit('open-change', true)
  lockScroll()
  nextTick(() => {
    closeButtonRef.value?.focus()
  })
}

function close(restoreFocus = true) {
  if (!isOpen.value) return
  isOpen.value = false
  emit('open-change', false)
  unlockScroll()
  if (restoreFocus) {
    nextTick(() => {
      previousActiveElement?.focus()
    })
  }
}

function toggle() {
  if (isOpen.value) close()
  else open()
}

function onNavigate() {
  if (isMobile.value) close()
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value || !isMobile.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return

  const elements = focusableElements()
  if (elements.length === 0) return
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    close()
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('keydown', onDocumentKeydown)
  unlockScroll()
})

watch(() => route.path, () => {
  if (isMobile.value) close()
})

defineExpose({ open, close, toggle })
</script>
