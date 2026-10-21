<template>
  <div>
    <Toaster position="top-right" :duration="4000" close-button />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'
</script>
