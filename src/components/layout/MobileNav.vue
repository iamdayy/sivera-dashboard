<template>
  <Menu as="div" class="relative shrink-0 md:hidden">
    <MenuButton
      ref="menuButton"
      class="inline-flex min-h-11 min-w-11 items-center justify-center p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      aria-label="Buka menu navigasi" aria-controls="mobile-menu">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </MenuButton>

    <Transition enter-active-class="transition ease-out duration-100" enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100" leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <MenuItems id="mobile-menu"
        class="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5"
        >
        <div class="py-1">
          <router-link v-for="item in navItems" :key="item.path" :to="item.path" v-slot="{ href, navigate }" custom>
            <MenuItem v-slot="{ active, close }" as="template">
              <a :href="href"
                class="flex min-h-11 items-center px-4 py-2 text-sm text-gray-700"
                :class="{ 'bg-gray-100 text-gray-900 ring-2 ring-inset ring-primary': active }"
                @click="navigate($event); closeMenu(close)">
                {{ item.label }}
              </a>
            </MenuItem>
          </router-link>
        </div>
        <div class="border-t py-1" v-if="hasApiKey">
          <MenuItem v-slot="{ active, close }" as="template">
            <button type="button" class="flex min-h-11 w-full items-center text-left px-4 py-2 text-sm text-destructive"
              :class="{ 'bg-gray-100 ring-2 ring-inset ring-primary': active }"
              @click="logout(close)">
              Keluar
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </Transition>
  </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { nextTick, ref } from 'vue'

const menuButton = ref<{ $el: HTMLButtonElement } | null>(null)

defineProps<{
  hasApiKey: boolean
}>()

const emit = defineEmits<{
  logout: []
}>()

const navItems = [
  { path: '/', label: 'Beranda' },
  { path: '/dashboard', label: 'Dashboard' },
]

function closeMenu(close: () => void) {
  close()
  nextTick(() => menuButton.value?.$el.focus({ preventScroll: true }))
}

function logout(close: () => void) {
  emit('logout')
  closeMenu(close)
}
</script>
