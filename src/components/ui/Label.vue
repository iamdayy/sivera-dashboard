<template>
  <label :for="for" :class="labelClasses">
    <slot />
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  for?: string
}>()

const labelClasses = computed(() => ['label'])
</script>