import { onScopeDispose, ref, watch } from 'vue'
import { connectionState } from '@/services/api'

export function useObjectUrl() {
  const url = ref('')
  let active = true
  function clear() {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = ''
  }
  function replace(blob: Blob) {
    if (!active) return ''
    clear()
    url.value = URL.createObjectURL(blob)
    return url.value
  }
  watch(() => connectionState.value.generation, clear, { flush: 'sync' })
  onScopeDispose(() => { active = false; clear() })
  return { url, replace, clear }
}
