import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getConnectionContext, normalizeApiError, setConnection } from '@/services/api'
import { fetchArtifactBlob, requireImageBlob, trustedArtifactUrl } from '@/services/artifacts'
import { camera, calibration } from '../../e2e/fixtures/api'

beforeEach(() => { vi.stubGlobal('Blob', NodeBlob); setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential') })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('authenticated artifacts', () => {
  it.each([
    '/files/returned-preview.png',
    `/api/v1/cameras/${camera.id}/snapshots/${calibration.id}/image`,
    `/api/v1/cameras/${camera.id}/calibration-captures/${calibration.id}/images/${camera.id}/preview`,
    `/api/v1/cameras/${camera.id}/predict/${calibration.id}/outputs/lifted_points_npz`,
  ])('accepts a registered binary endpoint: %s', path => {
    expect(trustedArtifactUrl(path)).toBe(`http://sivera-ui.test${path}`)
  })

  it.each(['https://external.test/files/image.png', '//external.test/files/image.png', 'data:image/png,secret', 'blob:http://sivera-ui.test/secret', '/health', '/files/image.png?key=value', '/files/image.png#fragment', '/files/a/%2e%2e/image.png', '/files/a%2fb.png', '/files/a%5cb.png', '/files\\image.png', 'http://user:password@sivera-ui.test/files/image.png'])('rejects unsafe artifacts without sending a key: %s', async path => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    await expect(fetchArtifactBlob(path)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires a key and does not treat an unauthenticated URL as a download', async () => {
    setConnection('http://sivera-ui.test', '')
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    await expect(fetchArtifactBlob('/files/image.png')).rejects.toMatchObject({ status: 401 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses header auth, rejects redirects, omits cookies, and returns the actual MIME type', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('binary', { headers: { 'Content-Type': 'application/octet-stream' } }))
    vi.stubGlobal('fetch', fetch)
    const blob = await fetchArtifactBlob('/files/output.npz')
    expect(blob.type).toBe('application/octet-stream')
    expect(fetch).toHaveBeenCalledWith('http://sivera-ui.test/files/output.npz', expect.objectContaining({ headers: { 'X-API-Key': 'ui-fixture-not-a-credential' }, credentials: 'omit', redirect: 'error', signal: expect.any(AbortSignal) }))
  })

  it('normalizes JSON errors from binary endpoints instead of returning preview blobs', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{"detail":{"code":"snapshot_stale"}}', { status: 409, headers: { 'Content-Type': 'application/json' } })))
    await expect(fetchArtifactBlob('/files/preview.png')).rejects.toMatchObject({ status: 409, code: 'snapshot_stale' })
  })

  it('rejects redirects/network errors without trying a second URL', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('redirect disallowed'))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchArtifactBlob('/files/preview.png')).rejects.toMatchObject({ status: null })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not reuse an old context and cancels a late body read on connection changes', async () => {
    const context = getConnectionContext()
    let finish!: (blob: Blob) => void
    const response = new Response('image')
    const body = vi.spyOn(response, 'blob').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    const result = fetchArtifactBlob('/files/image.png', context).catch(normalizeApiError)
    await vi.waitFor(() => expect(body).toHaveBeenCalled())
    setConnection(context.origin, 'replacement-fixture')
    expect((fetch.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(true)
    finish(new Blob(['stale'], { type: 'image/png' }))
    expect(await result).toMatchObject({ cancelled: true })
    await expect(fetchArtifactBlob('/files/image.png', context)).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('only accepts supported image MIME types for image-only previews', () => {
    const image = new Blob(['image'], { type: 'image/jpeg' })
    expect(requireImageBlob(image)).toBe(image)
    expect(() => requireImageBlob(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).toThrow()
    expect(() => requireImageBlob(new Blob(['{}'], { type: 'application/json' }))).toThrow()
  })
})
