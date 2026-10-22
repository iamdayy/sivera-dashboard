import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, apiErrorFromResponse, cameraPath, connectionState, getConnectionContext, isCurrentConnection, normalizeApiError, parseApiOrigin, readErrorBlob, setConnection } from '@/services/api'
import { camera } from '../../e2e/fixtures/api'

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  setConnection('http://sivera-ui.test', 'ui-fixture-not-a-credential')
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('API connection configuration', () => {
  it.each(['http://localhost:8000', 'http://localhost:8000/', ' http://localhost:8000/// '])('stores an origin without a prefix: %s', value => {
    expect(parseApiOrigin(value)).toEqual({ origin: 'http://localhost:8000', migrated: false })
  })

  it.each(['http://localhost:8000/api/v1', 'http://localhost:8000/api/v1/'])('explicitly migrates the legacy prefix: %s', value => {
    expect(setConnection(value, '  ui-fixture  ')).toEqual({ migrated: true })
    expect(localStorage.getItem('api_base_url')).toBe('http://localhost:8000')
    expect(getConnectionContext().key).toBe('ui-fixture')
    expect(cameraPath(camera.id, '/calibrations')).toBe(`/api/v1/cameras/${camera.id}/calibrations`)
  })

  it.each(['localhost:8000', 'ftp://example.test', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test/api/v1/cameras', 'https://example.test?key=value', 'https://example.test#section'])('rejects invalid configuration without mutating context: %s', value => {
    const context = getConnectionContext()
    expect(() => setConnection(value, 'new-key')).toThrow()
    expect(getConnectionContext()).toEqual(context)
    expect(localStorage.getItem('api_key')).toBe(context.key)
  })

  it('only aborts on actual origin/key changes, including logout', () => {
    const first = getConnectionContext()
    setConnection(`${first.origin}/`, first.key)
    expect(isCurrentConnection(first)).toBe(true)
    setConnection(first.origin, 'replacement-fixture')
    expect(first.signal.aborted).toBe(true)
    expect(connectionState.value.generation).toBe(first.generation + 1)
    const second = getConnectionContext()
    setConnection(second.origin, '')
    expect(second.signal.aborted).toBe(true)
    expect(localStorage.getItem('api_key')).toBeNull()
  })
})

describe('authenticated transport', () => {
  it('sends the captured key as a header with redirects and cookies disabled', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{"items":[]}'))
    vi.stubGlobal('fetch', fetch)
    await apiClient.get(cameraPath(), { headers: { 'X-API-Key': 'caller-key', Authorization: 'Bearer caller-token' }, withCredentials: true, fetchOptions: { redirect: 'follow', credentials: 'include' } })
    const request = fetch.mock.calls[0]![0] as Request
    expect(request.url).toBe('http://sivera-ui.test/api/v1/cameras')
    expect(request.headers.get('X-API-Key')).toBe('ui-fixture-not-a-credential')
    expect(request.headers.has('Authorization')).toBe(false)
    expect(request.redirect).toBe('error')
    expect(request.credentials).toBe('omit')
  })

  it('never sends a key on the public health probe', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    await apiClient.get('/health')
    const request = fetch.mock.calls[0]![0] as Request
    expect(request.url).toBe('http://sivera-ui.test/health')
    expect(request.headers.has('X-API-Key')).toBe(false)
  })

  it.each(['https://external.test/api/v1/cameras', '//external.test/api/v1/cameras', '/files/not-a-domain-request', '/cameras'])('rejects untrusted transport targets: %s', async path => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    await expect(apiClient.get(path)).rejects.toThrow('Tujuan request API tidak diizinkan.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('aborts the old request and refuses a late successful response', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetch)
    const result = apiClient.get(cameraPath()).catch(normalizeApiError)
    const request = fetch.mock.calls[0]![0] as Request
    setConnection('http://new-sivera.test', 'new-fixture-key')
    expect(request.signal.aborted).toBe(true)
    expect(request.headers.get('X-API-Key')).toBe('ui-fixture-not-a-credential')
    finish(new Response('{"items":["stale"]}'))
    expect(await result).toMatchObject({ cancelled: true })
  })

  it('checks the generation again after decoding an error blob', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' })
    let finish!: (text: string) => void
    const text = vi.spyOn(blob, 'text').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    vi.spyOn(Response.prototype, 'blob').mockResolvedValue(blob)
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}', { status: 409 })))
    const result = apiClient.get(cameraPath(), { responseType: 'blob' }).catch(normalizeApiError)
    await vi.waitFor(() => expect(text).toHaveBeenCalled())
    setConnection('http://sivera-ui.test', 'new-fixture-key')
    finish('{"detail":{"code":"capture_already_active"}}')
    expect(await result).toMatchObject({ cancelled: true })
  })
})

describe('API error normalization', () => {
  it('preserves structured machine metadata separately from safe copy', () => {
    expect(apiErrorFromResponse(409, { detail: { code: 'capture_already_active', field: 'target_images', session_id: camera.id } })).toEqual({
      status: 409, code: 'capture_already_active', field: 'target_images', session_id: camera.id,
      message: 'Masih ada sesi capture aktif untuk kamera ini. Lanjutkan sesi tersebut.',
    })
    expect(apiErrorFromResponse(400, { detail: { code: 'unknown_domain_code', message: 'Invalid source', session_id: 'not-a-uuid' } })).toEqual({ status: 400, code: 'unknown_domain_code', message: 'Invalid source' })
  })

  it('formats validation locations without echoing submitted values', () => {
    const error = apiErrorFromResponse(422, { detail: [{ loc: ['body', 'square_m'], msg: 'Input should be greater than 0', input: 'rtsp://user:secret@camera' }] })
    expect(error.message).toContain('square_m: Input should be greater than 0')
    expect(error.message).not.toContain('secret')
  })

  it.each([400, 409, 500])('does not expose credentials or internal traces at HTTP %s', status => {
    expect(apiErrorFromResponse(status, { detail: 'rtsp://user:secret@camera Traceback password=secret' }).message).not.toMatch(/secret|rtsp:\/\/|Traceback/)
  })

  it('distinguishes authorization, server, and transport failures', () => {
    expect(apiErrorFromResponse(401, {}).message).toContain('tidak valid')
    expect(apiErrorFromResponse(403, {}).message).toContain('tidak memiliki izin')
    expect(apiErrorFromResponse(503, {}).message).toContain('HTTP 503')
    expect(normalizeApiError(new TypeError('Failed to fetch'))).toMatchObject({ status: null })
    expect(normalizeApiError({ status: null, message: 'password=leak' }).message).toBe('Permintaan gagal.')
    expect(normalizeApiError({ isAxiosError: true, status: 403, message: 'Request failed with status code 403', response: { status: 403, data: { detail: 'Forbidden' } } }).message).toContain('tidak memiliki izin')
  })

  it('decodes JSON error blobs, safely ignoring large or non-JSON bodies', async () => {
    await expect(readErrorBlob(new Blob(['{"detail":{"code":"stream_disabled"}}']))).resolves.toEqual({ detail: { code: 'stream_disabled' } })
    await expect(readErrorBlob(new Blob(['<html>internal error</html>']))).resolves.toBeUndefined()
    const large = new Blob(['x'.repeat(64_001)])
    const text = vi.spyOn(large, 'text')
    await expect(readErrorBlob(large)).resolves.toBeUndefined()
    expect(text).not.toHaveBeenCalled()
  })
})
