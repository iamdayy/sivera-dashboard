import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { apiClient, setConnection } from '@/services/api'
import { useApiStore } from '@/stores/api'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { useConnectionScope } from '@/composables/useConnectionScope'

beforeEach(() => { setActivePinia(createPinia()); setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential') })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('connection lifecycle', () => {
  it('owns and revokes object URLs on replacement, connection change, and disposal', () => {
    const create = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second').mockReturnValueOnce('blob:third')
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke })
    const scope = effectScope()
    const preview = scope.run(useObjectUrl)!
    preview.replace(new Blob(['first']))
    preview.replace(new Blob(['second']))
    expect(revoke).toHaveBeenCalledWith('blob:first')
    setConnection('http://sivera-ui.test', 'replacement-fixture')
    expect(preview.url.value).toBe('')
    expect(revoke).toHaveBeenCalledWith('blob:second')
    preview.replace(new Blob(['third']))
    scope.stop()
    expect(revoke).toHaveBeenCalledWith('blob:third')
    expect(preview.replace(new Blob(['late']))).toBe('')
    expect(create).toHaveBeenCalledTimes(3)
  })

  it('invalidates component continuations on connection changes and disposal', () => {
    const scope = effectScope()
    const isActive = scope.run(useConnectionScope)!
    expect(isActive()).toBe(true)
    setConnection('http://new-sivera.test', 'new-fixture')
    expect(isActive()).toBe(false)
    const next = effectScope()
    const isNextActive = next.run(useConnectionScope)!
    next.stop()
    expect(isNextActive()).toBe(false)
    scope.stop()
  })

  it('distinguishes health, degraded database, stored key, and verified read access', async () => {
    const get = vi.spyOn(apiClient, 'get')
    const store = useApiStore()
    expect(store.hasApiKey).toBe(true)
    expect(store.isAuthenticated).toBe(false)
    get.mockResolvedValueOnce({ data: { status: 'degraded', database: 'disconnected', version: 'fixture' } })
    await store.testConnection()
    expect(store.connectionStatus).toBe('degraded')
    expect(store.accessStatus).toBe('unverified')
    get.mockResolvedValueOnce({ data: { status: 'healthy', database: 'connected', version: 'fixture' } })
    await store.testConnection()
    expect(store.connectionStatus).toBe('ok')
    expect(store.isAuthenticated).toBe(false)
    get.mockResolvedValueOnce({ data: { items: [] } })
    await expect(store.testApiKey()).resolves.toMatchObject({ valid: true, message: expect.stringContaining('Izin operasi lain belum diperiksa') })
    expect(store.accessStatus).toBe('verified')
    expect(get).toHaveBeenLastCalledWith('/api/v1/cameras', { params: { page: 1, page_size: 1 } })
    store.clearApiKey()
    expect(store.connectionStatus).toBe('idle')
    expect(store.accessStatus).toBe('unverified')
    expect(store.hasApiKey).toBe(false)
    expect(store.origin).toBe('http://sivera-ui.test')
    expect(localStorage.getItem('api_base_url')).toBe('http://sivera-ui.test')
  })

  it('reports authorization separately from network failures', async () => {
    const get = vi.spyOn(apiClient, 'get').mockRejectedValue({ status: 403, message: 'Forbidden' })
    const store = useApiStore()
    await expect(store.testApiKey()).resolves.toMatchObject({ valid: false, message: expect.stringContaining('camera:read') })
    expect(store.accessStatus).toBe('denied')
    get.mockRejectedValue(new TypeError('Failed to fetch'))
    await store.testApiKey()
    expect(store.accessStatus).toBe('error')
    expect(store.connectionStatus).toBe('idle')
  })

  it('does not publish a late health or key verification result for a new connection', async () => {
    let finish!: (response: { data: unknown }) => void
    vi.spyOn(apiClient, 'get').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const store = useApiStore()
    const health = store.testConnection().catch(error => error)
    store.configure('http://new-sivera.test', 'new-fixture')
    finish({ data: { status: 'healthy', database: 'connected' } })
    expect(await health).toMatchObject({ code: 'ERR_CANCELED' })
    expect(store.connectionStatus).toBe('idle')
    const access = store.testApiKey().catch(error => error)
    store.clearApiKey()
    finish({ data: { items: [] } })
    expect(await access).toMatchObject({ code: 'ERR_CANCELED' })
    expect(store.accessStatus).toBe('unverified')
  })
})
