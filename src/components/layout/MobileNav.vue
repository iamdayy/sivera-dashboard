<template>
  <Menu as="div" class="relative">
    <MenuButton
      class="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      aria-label="Buka menu navigasi" aria-controls="mobile-menu">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </MenuButton>

    <Transition enter-active-class="transition ease-out duration-100" enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100" leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <MenuItems id="mobile-menu"
        class="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none"
        >
        <div class="py-1">
          <router-link v-for="item in navItems" :key="item.path" :to="item.path"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            @click="closeMenu">
            {{ item.label }}
          </router-link>
        </div>
        <div class="border-t py-1" v-if="hasApiKey">
          <button class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 hover:text-red-700"
            @click="$emit('logout')">
            Keluar
          </button>
        </div>
      </MenuItems>
    </Transition>
  </Menu>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItems } from '@headlessui/vue'
import { defineEmits } from 'vue'

const props = defineProps<{
  hasApiKey: boolean
}>()

const emit = defineEmits<{
  logout: []
}>()

const navItems = [
  { path: '/', label: 'Beranda' },
  { path: '/dashboard', label: 'Dashboard' },
]

const closeMenu = () => {
  // Menu auto-closes on item click via headlessui
}
</script>
