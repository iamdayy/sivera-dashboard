<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="spinner" style="width: 1rem; height: 1rem;" aria-hidden="true" />
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonClasses = computed(() => [
  'btn inline-flex items-center justify-center gap-2 font-medium transition-colors',
  {
    'btn-primary': props.variant === 'primary' || !props.variant,
    'btn-secondary': props.variant === 'secondary',
    'btn-outline': props.variant === 'outline',
    'btn-ghost': props.variant === 'ghost',
    'btn-destructive': props.variant === 'destructive',
    'btn-sm': props.size === 'sm',
    'btn-lg': props.size === 'lg',
    'opacity-50 cursor-not-allowed': props.disabled || props.loading,
  }
])
</script>