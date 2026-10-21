<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { X } from '@lucide/vue'
import { reactiveOmit, useResizeObserver } from '@vueuse/core'
import { cn } from '@/lib/utils'
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  useForwardExpose,
  useForwardPropsEmits,
} from 'reka-ui'
import DialogOverlay from './DialogOverlay.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DialogContentProps & { class?: HTMLAttributes['class']; showCloseButton?: boolean }
  >(),
  {
    showCloseButton: true,
  },
)
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'showCloseButton')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const { forwardRef, currentElement } = useForwardExpose()

function keepFocusedControlVisible() {
  requestAnimationFrame(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement && currentElement.value?.contains(active)) {
      active.scrollIntoView({ block: 'nearest' })
    }
  })
}

useResizeObserver(currentElement, keepFocusedControlVisible)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent v-bind="{ ...$attrs, ...forwarded }" as-child>
      <div
        :ref="forwardRef"
        data-slot="dialog-content"
        @focusin="keepFocusedControlVisible"
        :class="
          cn(
            'bg-background fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border p-4 shadow-lg sm:p-6',
            props.class,
          )
        "
      >
        <slot />

        <DialogClose
          v-if="showCloseButton"
          data-slot="dialog-close"
          class="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4"
        >
          <X aria-hidden="true" />
          <span class="sr-only">Tutup dialog</span>
        </DialogClose>
      </div>
    </DialogContent>
  </DialogPortal>
</template>
