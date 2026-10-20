import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useModal() {
    const isOpen = ref(false)
    const originalOverflow = ref<string | null>(null)
    let originalPaddingRight: string | null = null

    const openModal = () => {
        if (isOpen.value) return
        isOpen.value = true
        // Save original styles
        originalOverflow.value = document.body.style.overflow
        originalPaddingRight = document.body.style.paddingRight
        // Prevent background scroll
        const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
        if (scrollBarWidth > 0) {
            document.body.style.paddingRight = `${scrollBarWidth}px`
        }
        document.body.style.overflow = 'hidden'
        // Focus trap will be handled by the modal content
    }

    const closeModal = () => {
        if (!isOpen.value) return
        isOpen.value = false
        // Restore original styles
        if (originalOverflow.value !== null) {
            document.body.style.overflow = originalOverflow.value
        }
        if (originalPaddingRight !== null) {
            document.body.style.paddingRight = originalPaddingRight
        }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen.value) {
            closeModal()
        }
    }

    onMounted(() => {
        document.addEventListener('keydown', handleKeyDown)
    })

    onBeforeUnmount(() => {
        document.removeEventListener('keydown', handleKeyDown)
        // Ensure styles are restored even if component unmounts unexpectedly
        if (originalOverflow.value !== null) {
            document.body.style.overflow = originalOverflow.value
        }
        if (originalPaddingRight !== null) {
            document.body.style.paddingRight = originalPaddingRight
        }
    })

    return {
        isOpen,
        openModal,
        closeModal,
    }
}