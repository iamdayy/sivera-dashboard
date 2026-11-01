import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { camera, calibration } from '../../e2e/fixtures/api'

const origin = 'http://sivera-public.test'
const offerPath = `/api/v1/public/cameras/${camera.id}/stream/whep`
const location = `${origin}${offerPath}/${calibration.id}`
const offer = 'v=0\r\na=ice-ufrag:local\r\n'
const answer = 'v=0\r\na=ice-ufrag:remote\r\n'
let service: typeof import('@/services/publicWhep')

function offerResponse(headers: Record<string, string> = {}, body = answer) {
  return new Response(body, { status: 201, headers: { 'Content-Type': 'application/sdp', Location: location, ETag: '"first"', ...headers } })
}

beforeEach(async () => {
  vi.stubEnv('VITE_API_BASE_URL', origin)
  vi.resetModules()
  service = await import('@/services/publicWhep')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('public WHEP contract', () => {
  it('reads 204 capabilities without API keys or cookies', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, {
      status: 204, headers: { 'Accept-Post': 'application/sdp', 'Accept-Patch': 'application/trickle-ice-sdpfrag', Link: '<stun:stun.test>; rel="ice-server"' },
    }))
    vi.stubGlobal('fetch', fetch)
    await expect(service.getPublicWhepCapabilities(camera.id)).resolves.toEqual({
      acceptPost: 'application/sdp', acceptPatch: 'application/trickle-ice-sdpfrag', iceServers: [{ urls: 'stun:stun.test' }],
    })
    expect(fetch).toHaveBeenCalledWith(`${origin}${offerPath}`, expect.objectContaining({ method: 'OPTIONS', credentials: 'omit', redirect: 'error', cache: 'no-store' }))
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).has('X-API-Key')).toBe(false)
  })

  it('rejects the old OPTIONS 200 contract with the signaling diagnostic', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await expect(service.getPublicWhepCapabilities(camera.id)).rejects.toMatchObject({
      status: null, message: 'Respons signaling WHEP tidak valid. Periksa konfigurasi backend dan CORS.',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('uses the backend Location and ETag for PATCH and bodyless DELETE', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(offerResponse({ Location: `${offerPath}/${calibration.id}` }))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { ETag: '"second"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const result = await service.openPublicWhepSession(camera.id, offer)
    expect(result.answer).toBe(answer)
    expect(result.session).toMatchObject({ cameraId: camera.id, location, etag: '"first"' })
    await expect(service.patchPublicWhepSession(result.session, 'a=ice-ufrag:local\r\n')).resolves.toEqual({ status: 204, fragment: null, etag: '"second"' })
    expect(fetch.mock.calls[1]).toEqual([location, expect.objectContaining({ method: 'PATCH', headers: { 'Content-Type': 'application/trickle-ice-sdpfrag', 'If-Match': '"first"' } })])
    await expect(service.closePublicWhepSession(result.session)).resolves.toEqual({ status: 'deleted' })
    await expect(service.closePublicWhepSession(result.session)).resolves.toEqual({ status: 'deleted' })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[2]).toEqual([location, expect.objectContaining({ method: 'DELETE', keepalive: true })])
    for (const [, init] of fetch.mock.calls) {
      expect(new Headers(init?.headers).has('X-API-Key')).toBe(false)
      expect(init?.credentials).toBe('omit')
      expect(init?.redirect).toBe('error')
    }
  })

  it.each([
    `http://mediamtx:8889/sivera_${camera.id}/whep/${calibration.id}`,
    `/sivera_${camera.id}/whep/${calibration.id}`,
    `${origin}${offerPath.replace(camera.id, calibration.id)}/${camera.id}`,
    '',
  ])('rejects an upstream, wrong-camera or unreadable Location: %s', async target => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(offerResponse({ Location: target }))
    vi.stubGlobal('fetch', fetch)
    await expect(service.openPublicWhepSession(camera.id, offer)).rejects.toMatchObject({ status: null, sessionMayRemain: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('cleans up a created session when the SDP response has the wrong content type', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(offerResponse({ 'Content-Type': 'application/json' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await expect(service.openPublicWhepSession(camera.id, offer)).rejects.toMatchObject({ sessionMayRemain: false, cleanup: { status: 'deleted' } })
    expect(fetch.mock.calls[1]).toEqual([location, expect.objectContaining({ method: 'DELETE' })])
  })

  it('explains a disabled public stream without asking for an API key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ detail: 'Stream not enabled' }, { status: 403 }))
    vi.stubGlobal('fetch', fetch)
    await expect(service.getPublicWhepCapabilities(camera.id)).rejects.toMatchObject({
      status: 403, message: 'Stream kamera belum diaktifkan. Minta administrator mengaktifkannya.',
    })
  })

  it('keeps safe backend error codes without exposing raw server details or retrying POST', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ detail: { code: 'stream_unavailable', message: 'rtsp://private:credential@camera.test/live' } }, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const error = await service.openPublicWhepSession(camera.id, offer).catch((error: unknown) => error)
    expect(error).toMatchObject({ status: 503, code: 'stream_unavailable' })
    expect(JSON.stringify(error)).not.toContain('private:credential')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('deletes a late 201 after cancellation without returning its answer', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const result = service.openPublicWhepSession(camera.id, offer, controller.signal).catch((error: unknown) => error)
    controller.abort()
    finish(offerResponse())
    expect(await result).toMatchObject({ cancelled: true, sessionMayRemain: false, cleanup: { status: 'deleted' } })
    expect(fetch.mock.calls[1]).toEqual([location, expect.objectContaining({ method: 'DELETE' })])
  })
})
