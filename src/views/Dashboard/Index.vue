<template>
  <div class="flex min-h-screen flex-col">
    <Sidebar ref="sidebarRef" @open-change="sidebarOpen = $event" />
    <DashboardHeader :sidebar-open="sidebarOpen" @toggle-sidebar="toggleSidebar" />
    <main class="flex-1 pt-12 transition-all lg:ml-[var(--sidebar-width)]">
      <div class="sheet m-2 p-4 sm:p-6">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="route.path === '/dashboard/settings' ? 'settings' : apiStore.generation" />
        </router-view>
      </div>
    </main>

    <footer class="border-t border-frame-border bg-frame transition-all lg:ml-[var(--sidebar-width)]">
      <div class="mx-auto max-w-7xl px-6 py-4">
        <p class="text-center text-sm text-text-muted">
          Sivera Dashboard v{{ appVersion }} · Monitoring CCTV · Estimasi Volume Sampah
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useApiStore } from '@/stores/api'
import Sidebar from '@/components/layout/Sidebar.vue'
import DashboardHeader from '@/components/layout/DashboardHeader.vue'
import { version as appVersion } from '../../../package.json'

const apiStore = useApiStore()
const route = useRoute()
const sidebarRef = ref<{ open: () => void; close: () => void; toggle: () => void } | null>(null)
const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarRef.value?.toggle()
}
</script>

<style scoped>
.sheet {
  background-color: var(--sheet);
  border: 1px solid var(--sheet-border);
  border-radius: var(--radius-sheet);
  box-shadow: none;
  min-height: calc(100vh - var(--topbar-height) - 6rem);
}
</style>
