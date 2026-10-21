<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { X } from '@lucide/vue'
import { reactiveOmit } from '@vueuse/core'
import { cn } from '@/lib/utils'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 grid items-start justify-items-center overflow-y-auto bg-black/50 p-4 sm:p-6"
    >
      <DialogContent
        :class="
          cn(
            'relative z-50 my-auto grid w-full max-w-lg gap-4 rounded-lg border border-border bg-background p-4 shadow-lg sm:p-6',
            props.class,
          )
        "
        v-bind="{ ...$attrs, ...forwarded }"
        @pointer-down-outside="
          (event) => {
            const originalEvent = event.detail.originalEvent
            const target = originalEvent.target as HTMLElement
            if (
              originalEvent.offsetX > target.clientWidth ||
              originalEvent.offsetY > target.clientHeight
            ) {
              event.preventDefault()
            }
          }
        "
      >
        <slot />

        <DialogClose
          class="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X class="size-4" aria-hidden="true" />
          <span class="sr-only">Tutup dialog</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
