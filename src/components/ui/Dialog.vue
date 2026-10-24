<template>
  <Teleport to="body">
    <Transition name="dialog" appear>
      <div v-if="open" class="fixed inset-0 z-50 overflow-y-auto" role="presentation">
        <div
          class="fixed inset-0 bg-black/50"
          aria-hidden="true"
          @click="onOverlayClick"
        />
        <div class="pointer-events-none relative flex min-h-full items-center justify-center p-3 sm:p-4">
          <div
            ref="contentRef"
            :role="role"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
            tabindex="-1"
            class="pointer-events-auto relative flex max-h-[90vh] w-full flex-col rounded-xl border border-sheet-border bg-sheet shadow-xl outline-none"
            :class="[contentClass || 'max-w-lg']"
          >
            <button
              v-if="showCloseButton && closeable"
              type="button"
              class="btn btn-ghost absolute right-2 top-2 z-10 h-11 min-h-11 w-11 min-w-11 p-0"
              :aria-label="closeAriaLabel"
              :disabled="disabled"
              @click="requestClose"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>

            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { useDialogStack } from '@/composables/useDialogStack'

const props = withDefaults(defineProps<{
  open: boolean
  showCloseButton?: boolean
  closeable?: boolean
  closeAriaLabel?: string
  contentClass?: string
  maxHeight?: boolean
  disabled?: boolean
  role?: 'dialog' | 'alertdialog'
}>(), {
  showCloseButton: true,
  closeable: true,
  closeAriaLabel: 'Tutup dialog',
  contentClass: '',
  maxHeight: true,
  disabled: false,
  role: 'dialog',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'escape-key-down': [event: KeyboardEvent]
  'interact-outside': [event: Event]
}>()

const contentRef = ref<HTMLElement | null>(null)
let previousActiveElement: HTMLElement | null = null
let previousOverflow = ''
let resizeFrame = 0

const { dialogId, pushDialog, popDialog, isTopDialog } = useDialogStack()

function focusableElements(): HTMLElement[] {
  const root = contentRef.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => element.getClientRects().length > 0)
}

function requestClose() {
  if (!props.closeable || props.disabled) return
  emit('update:open', false)
}

function onOverlayClick(event: MouseEvent) {
  emit('interact-outside', event)
  requestClose()
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (!isTopDialog()) return

  if (event.key === 'Escape') {
    emit('escape-key-down', event)
    if (!props.disabled) requestClose()
    return
  }

  if (event.key !== 'Tab') return
  const elements = focusableElements()
  if (elements.length === 0) {
    event.preventDefault()
    return
  }
  const first = elements[0]!
  const last = elements[elements.length - 1]!
  const active = document.activeElement

  if (event.shiftKey && (active === first || active === contentRef.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    pushDialog()
    previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nextTick(() => {
      const root = contentRef.value
      if (!root) return
      const field = root.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
      )
      const action = focusableElements().find(element => element !== root
        && element.getAttribute('aria-label') !== props.closeAriaLabel)
      const target = field ?? action ?? root
      target.focus({ preventScroll: true })
      target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    })
  } else {
    popDialog()
    document.body.style.overflow = previousOverflow
    const target = previousActiveElement
    previousActiveElement = null
    if (target?.isConnected) {
      nextTick(() => target.focus({ preventScroll: true }))
    }
  }
}, { immediate: true })

function keepActiveVisible() {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    const root = contentRef.value
    const active = document.activeElement
    if (!props.open || !root || !(active instanceof HTMLElement) || !root.contains(active)) return
    active.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', keepActiveVisible)
})

onUnmounted(() => {
  popDialog()
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', keepActiveVisible)
  cancelAnimationFrame(resizeFrame)
  document.body.style.overflow = previousOverflow
})
</script>

<style scoped>
.dialog-enter-active {
  transition: opacity 0.15s ease-out;
}
.dialog-enter-from {
  opacity: 0;
}
</style>

<script lang="ts">
import { defineComponent, h } from 'vue'

export const DialogContent = defineComponent({
  name: 'DialogContent',
  setup(_, { slots, attrs }) {
    return () => h('div', { ...attrs, class: ['min-h-0 flex-1 overflow-y-auto p-5 sm:p-6', attrs.class].filter(Boolean).join(' ') }, slots.default?.())
  },
})

export const DialogHeader = defineComponent({
  name: 'DialogHeader',
  setup(_, { slots, attrs }) {
    return () => h('div', { ...attrs, class: ['shrink-0 p-5 pb-0 pr-12 sm:p-6 sm:pb-0', attrs.class].filter(Boolean).join(' ') }, slots.default?.())
  },
})

export const DialogTitle = defineComponent({
  name: 'DialogTitle',
  setup(_, { slots, attrs }) {
    return () => h('h2', { ...attrs, id: 'dialog-title', class: ['mb-2 text-lg font-semibold text-text', attrs.class].filter(Boolean).join(' ') }, slots.default?.())
  },
})

export const DialogDescription = defineComponent({
  name: 'DialogDescription',
  setup(_, { slots, attrs }) {
    return () => h('p', { ...attrs, id: 'dialog-description', class: ['text-sm text-text-muted', attrs.class].filter(Boolean).join(' ') }, slots.default?.())
  },
})

export const DialogFooter = defineComponent({
  name: 'DialogFooter',
  setup(_, { slots, attrs }) {
    return () => h('div', {
      ...attrs,
      class: [
        'shrink-0 flex flex-col-reverse gap-2 border-t border-sheet-border p-5 pt-4 sm:flex-row sm:justify-end sm:gap-3 sm:p-6 sm:pt-4',
        attrs.class,
      ].filter(Boolean).join(' '),
    }, slots.default?.())
  },
})
</script>