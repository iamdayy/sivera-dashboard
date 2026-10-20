<template>
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow p-6"
    :class="selected ? 'border-primary border-2' : ''">
    <slot />
  </div>
</template>
<script setup lang="ts">
const props = defineProps({
  selected: {
    type: Boolean,
    default: false
  }
})
</script>