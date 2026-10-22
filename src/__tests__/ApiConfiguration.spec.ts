import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => { vi.resetModules(); localStorage.clear() })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

describe('stored API configuration', () => {
  it('shows the legacy-origin migration without silently rewriting saved configuration', async () => {
    localStorage.setItem('api_base_url', 'http://sivera-ui.test/api/v1/')
    const api = await import('@/services/api')
    expect(api.connectionState.value.origin).toBe('http://sivera-ui.test')
    expect(api.connectionState.value.notice).toContain('konfigurasi lama')
    expect(localStorage.getItem('api_base_url')).toBe('http://sivera-ui.test/api/v1/')
    api.setConnection(api.connectionState.value.origin, '')
    expect(localStorage.getItem('api_base_url')).toBe('http://sivera-ui.test')
    expect(api.connectionState.value.notice).toBe('')
  })

  it('blocks invalid stored configuration rather than falling back to another backend', async () => {
    localStorage.setItem('api_base_url', 'http://sivera-ui.test/unexpected-path')
    const api = await import('@/services/api')
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    expect(api.connectionState.value.origin).toBe('')
    expect(api.connectionState.value.notice).toContain('origin HTTP/HTTPS')
    await expect(api.checkHealth()).rejects.toMatchObject({ status: null, message: 'Atur origin API yang valid di Pengaturan.' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('clears credentials without replacing an invalid stored origin or its warning', async () => {
    const invalidOrigin = 'http://sivera-ui.test/unexpected-path'
    localStorage.setItem('api_base_url', invalidOrigin)
    localStorage.setItem('api_key', 'ui-fixture-not-a-credential')
    const api = await import('@/services/api')
    const context = api.getConnectionContext()
    const notice = api.connectionState.value.notice
    api.clearConnectionKey()
    expect(context.signal.aborted).toBe(true)
    expect(api.getConnectionContext()).toMatchObject({ origin: '', key: '', generation: context.generation + 1 })
    expect(api.connectionState.value.notice).toBe(notice)
    expect(localStorage.getItem('api_base_url')).toBe(invalidOrigin)
    expect(localStorage.getItem('api_key')).toBeNull()
    const cleared = api.getConnectionContext()
    api.clearConnectionKey()
    expect(api.getConnectionContext()).toEqual(cleared)
  })
})
