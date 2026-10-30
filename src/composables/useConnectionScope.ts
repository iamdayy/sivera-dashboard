import { onScopeDispose, ref, computed } from 'vue'
import { getConnectionContext, isCurrentConnection, getApiKey as apiGetApiKey } from '@/services/api'

export function useConnectionScope() {
  const context = getConnectionContext()
  let active = true
  onScopeDispose(() => { active = false })
  
  const getApiKey = () => active && isCurrentConnection(context) ? apiGetApiKey() : null
  const hasApiKey = computed(() => active && isCurrentConnection(context) && !!apiGetApiKey())
  const busy = ref(false)
  const isActive = () => active && isCurrentConnection(context)
  
  return { getApiKey, hasApiKey, busy, isActive }
}
