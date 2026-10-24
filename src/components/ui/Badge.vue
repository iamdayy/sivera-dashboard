<template>
  <span :class="badgeClasses">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'positive' | 'negative' | 'warning' | 'neutral'
}>()

const badgeClasses = computed(() => [
  'badge inline-flex items-center gap-1.5',
  {
    'badge-positive': props.variant === 'positive',
    'badge-negative': props.variant === 'negative',
    'badge-warning': props.variant === 'warning',
    'badge-neutral': props.variant === 'neutral' || props.variant === 'secondary',
    'bg-brand/10 text-brand': props.variant === 'primary',
    'bg-frame text-text': props.variant === 'outline',
    'bg-destructive/10 text-destructive': props.variant === 'destructive',
    'bg-brand text-brand-foreground': props.variant === 'ghost',
  }
])
</script>