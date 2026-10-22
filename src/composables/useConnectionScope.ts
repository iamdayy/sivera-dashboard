import { onScopeDispose } from 'vue'
import { getConnectionContext, isCurrentConnection } from '@/services/api'

export function useConnectionScope() {
  const context = getConnectionContext()
  let active = true
  onScopeDispose(() => { active = false })
  return () => active && isCurrentConnection(context)
}
