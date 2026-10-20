<template>
  <button
    :type="type"
    :disabled="disabled || isLoading"
    class="inline-flex items-center justify-center border text-sm font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    :class="variantClasses"
  >
    <span v-if="isLoading" class="animate-pulse">Loading...</span>
    <slot v-else>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  label?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  isLoading?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  isLoading: false,
})

const variantClasses = computed(() => [
  props.variant === 'primary' && 'bg-primary text-white border-primary hover:bg-primary/80',
  props.variant === 'secondary' && 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
  props.variant === 'outline' && 'bg-white text-primary border-primary hover:bg-primary/10',
  props.variant === 'ghost' && 'bg-transparent text-gray-700 border-transparent hover:bg-gray-100',
  props.size === 'sm' && 'px-2.5 py-1.5 text-xs',
  props.size === 'md' && 'px-3 py-2',
  props.size === 'lg' && 'px-4 py-2.5 text-base',
])
</script>