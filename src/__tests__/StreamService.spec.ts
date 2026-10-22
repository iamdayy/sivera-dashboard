import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setConnection } from '@/services/api'
import { getStream, updateStream } from '@/services/streams'
import type { StreamResponse } from '@/types'
import { camera } from '../../e2e/fixtures/api'

const desired: StreamResponse = { camera_id: camera.id, enabled: true, status: 'unknown', synced: false, whep_url: `/api/v1/cameras/${camera.id}/stream/whep`, tracks: [], checked_at: '2026-10-22T00:00:00Z' }

beforeEach(() => { setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential') })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('stream service', () => {
  it('PATCH sends only desired enabled state; runtime remains a separate GET', async () => {
    const runtime = { ...desired, status: 'idle', synced: true }
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json(desired))
      .mockResolvedValueOnce(Response.json(runtime))
    vi.stubGlobal('fetch', fetch)
    await expect(updateStream(camera.id, true)).resolves.toEqual(desired)
    expect(fetch).toHaveBeenCalledTimes(1)
    const patch = fetch.mock.calls[0]![0] as Request
    expect(patch.method).toBe('PATCH')
    expect(patch.url).toBe(`http://sivera-ui.test/api/v1/cameras/${camera.id}/stream`)
    expect(patch.headers.get('X-API-Key')).toBe('ui-fixture-not-a-credential')
    expect(await patch.json()).toEqual({ enabled: true })
    await expect(getStream(camera.id)).resolves.toEqual(runtime)
    expect((fetch.mock.calls[1]![0] as Request).method).toBe('GET')
  })

  it('does not turn disabled or future runtime status into online', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ ...desired, enabled: false, status: 'future-status', whep_url: null })))
    await expect(updateStream(camera.id, false)).resolves.toMatchObject({ enabled: false, status: 'future-status', whep_url: null, synced: false })
  })

  it('propagates domain/auth failures without automatically retrying mutations', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ detail: { code: 'stream_service_not_configured' } }, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    await expect(updateStream(camera.id, true)).rejects.toMatchObject({ status: 503, code: 'stream_service_not_configured' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('caller abort and connection change reject a held result', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const result = getStream(camera.id, controller.signal).catch(error => error)
    const request = fetch.mock.calls[0]![0] as Request
    controller.abort()
    expect(request.signal.aborted).toBe(true)
    setConnection('http://other-sivera.test', 'replacement-fixture')
    finish(Response.json(desired))
    expect(await result).toMatchObject({ cancelled: true })
  })
})
