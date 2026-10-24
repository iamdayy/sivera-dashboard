<template>
  <div
    class="bg-sheet border border-sheet-border rounded-xl"
    :class="[variant === 'outlined' ? 'border-sheet-border' : '', className]"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  className?: string
  variant?: 'default' | 'outlined'
}>()
</script>

<script lang="ts">
import { h, defineComponent } from 'vue'

// Sub-components for Card composition - exported for external use
export const CardHeader = defineComponent({
  name: 'CardHeader',
  setup(_props: Record<string, never>, { slots }) {
    return () => h('div', { class: 'card-header' }, slots.default?.())
  }
})

export const CardContent = defineComponent({
  name: 'CardContent',
  setup(_props: Record<string, never>, { slots }) {
    return () => h('div', { class: 'card-content' }, slots.default?.())
  }
})

export const CardTitle = defineComponent({
  name: 'CardTitle',
  setup(_props: Record<string, never>, { slots }) {
    return () => h('h3', { class: 'card-title' }, slots.default?.())
  }
})

export const CardDescription = defineComponent({
  name: 'CardDescription',
  setup(_props: Record<string, never>, { slots }) {
    return () => h('p', { class: 'card-description' }, slots.default?.())
  }
})

export const CardFooter = defineComponent({
  name: 'CardFooter',
  setup(_props: Record<string, never>, { slots }) {
    return () => h('div', { class: 'card-footer mt-4 pt-4 border-t border-sheet-border flex items-center gap-2' }, slots.default?.())
  }
})
</script>