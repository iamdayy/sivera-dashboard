import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getConnectionContext, setConnection } from '@/services/api'
import { closeWhepSession, getWhepCapabilities, openWhepSession, parseWhepIceServers, patchWhepSession, trustedWhepOfferUrl } from '@/services/whep'
import { camera, calibration } from '../../e2e/fixtures/api'

const origin = 'http://sivera-ui.test'
const offerPath = `/api/v1/cameras/${camera.id}/stream/whep`
const location = `${origin}${offerPath}/${calibration.id}`
const offer = 'v=0\r\na=ice-ufrag:local\r\n'
const answer = 'v=0\r\na=ice-ufrag:remote\r\n'
const fragment = 'a=ice-ufrag:local\r\na=candidate:fixture\r\n'

function offerResponse(headers: Record<string, string> = {}, body = answer) {
  return new Response(body, { status: 201, headers: { 'Content-Type': 'application/sdp', Location: location, ETag: '"first"', ...headers } })
}

beforeEach(() => { setConnection(origin, 'ui-fixture-not-a-credential') })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('trusted WHEP targets and ICE links', () => {
  it.each([offerPath, `${origin}${offerPath}`])('accepts only the selected camera offer endpoint: %s', path => {
    expect(trustedWhepOfferUrl(path, camera.id)).toBe(`${origin}${offerPath}`)
  })

  it.each([
    `https://external.test${offerPath}`, `//external.test${offerPath}`, `${origin}${offerPath}?key=value`, `${offerPath}#fragment`,
    `${offerPath}/${calibration.id}`, offerPath.replace(camera.id, calibration.id), '/health', '/stream/whep',
    `${origin}/api/v1/cameras/x/../${camera.id}/stream/whep`, `${offerPath}/../whep`, offerPath.replace('/stream/', '/%73tream/'),
    offerPath.replace('/stream/', '/\\stream/'), `${origin.replace('://', '://user:password@')}${offerPath}`,
  ])('rejects an unsafe offer target without sending credentials: %s', async path => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    await expect(openWhepSession(camera.id, path, offer)).rejects.toMatchObject({ status: null, sessionMayRemain: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('parses multiple Links, quoted commas/semicolons/escapes and a TURN password without fetching them', () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    expect(parseWhepIceServers('<https://docs.test/whep>; rel="help", <stun:stun.test:3478>; rel="ice-server", <turns:turn.test:5349?transport=tcp>; rel="ice-server other"; username="user,one"; credential="pass;word\\\""; credential-type="password"')).toEqual([
      { urls: 'stun:stun.test:3478' },
      { urls: 'turns:turn.test:5349?transport=tcp', username: 'user,one', credential: 'pass;word"' },
    ])
    expect(parseWhepIceServers(null)).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    '<https://external.test/ice>; rel="ice-server"', '<turn:turn.test>; rel="ice-server"',
    '<turn:turn.test>; rel="ice-server"; username="fixture"; credential="fixture"; credential-type="oauth"',
    '<stun:stun.test>; rel="ice-server', 'stun:stun.test; rel="ice-server"', '<stun:user@stun.test>; rel="ice-server"',
  ])('rejects malformed or unsupported ICE links without echoing credentials: %s', link => {
    expect(() => parseWhepIceServers(link)).toThrow()
    try { parseWhepIceServers(link) } catch (error) { expect(JSON.stringify(error)).not.toContain(link) }
  })
})

describe('WHEP signaling', () => {
  it('OPTIONS is authenticated and returns capabilities before a peer is built', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204, headers: { 'Accept-Post': 'application/sdp', 'Accept-Patch': 'application/trickle-ice-sdpfrag', Link: '<stun:stun.test>; rel="ice-server"' } }))
    vi.stubGlobal('fetch', fetch)
    await expect(getWhepCapabilities(camera.id, offerPath)).resolves.toEqual({ acceptPost: 'application/sdp', acceptPatch: 'application/trickle-ice-sdpfrag', iceServers: [{ urls: 'stun:stun.test' }] })
    expect(fetch).toHaveBeenCalledWith(`${origin}${offerPath}`, expect.objectContaining({ method: 'OPTIONS', headers: { 'X-API-Key': 'ui-fixture-not-a-credential' }, credentials: 'omit', redirect: 'error', cache: 'no-store' }))
  })

  it('POST preserves SDP, Location and ETag, and makes exactly one request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(offerResponse({ Location: `${offerPath}/${calibration.id}`, Link: '<stun:stun.test>; rel="ice-server"' }))
    vi.stubGlobal('fetch', fetch)
    const result = await openWhepSession(camera.id, offerPath, offer)
    expect(result.answer).toBe(answer)
    expect(result.session).toMatchObject({ cameraId: camera.id, location, etag: '"first"', context: getConnectionContext() })
    expect(result.iceServers).toEqual([{ urls: 'stun:stun.test' }])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(`${origin}${offerPath}`, expect.objectContaining({ method: 'POST', body: offer, headers: { 'X-API-Key': 'ui-fixture-not-a-credential', 'Content-Type': 'application/sdp' }, redirect: 'error', credentials: 'omit' }))
  })

  it('serializes PATCH and uses the updated ETag for the next queued fragment', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(offerResponse())
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(new Response('a=ice-ufrag:restart\r\n', { status: 200, headers: { 'Content-Type': 'application/trickle-ice-sdpfrag', ETag: '"restart"' } }))
    vi.stubGlobal('fetch', fetch)
    const { session } = await openWhepSession(camera.id, offerPath, offer)
    const first = patchWhepSession(session, fragment)
    const second = patchWhepSession(session, fragment)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls[1]).toEqual([location, expect.objectContaining({ method: 'PATCH', body: fragment, headers: { 'X-API-Key': 'ui-fixture-not-a-credential', 'Content-Type': 'application/trickle-ice-sdpfrag', 'If-Match': '"first"' } })])
    finish(new Response(null, { status: 204, headers: { ETag: '"second"' } }))
    await expect(first).resolves.toEqual({ status: 204, fragment: null, etag: '"second"' })
    await expect(second).resolves.toEqual({ status: 200, fragment: 'a=ice-ufrag:restart\r\n', etag: '"restart"' })
    expect((fetch.mock.calls[2]![1]!.headers as Record<string, string>)['If-Match']).toBe('"second"')
    expect(session.etag).toBe('"restart"')
  })

  it('omits If-Match when no ETag was returned and never changes the server Location', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(answer, { status: 201, headers: { 'Content-Type': 'application/sdp', Location: location } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const { session } = await openWhepSession(camera.id, offerPath, offer)
    await expect(patchWhepSession(session, fragment)).resolves.toEqual({ status: 204, fragment: null, etag: null })
    expect((fetch.mock.calls[1]![1]!.headers as Record<string, string>)['If-Match']).toBeUndefined()
    expect(fetch.mock.calls[1]![0]).toBe(location)
  })

  it.each([401, 403, 409, 503])('normalizes HTTP %s offer failures with no automatic POST retry', async status => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(Response.json({ detail: { code: 'stream_disabled' } }, { status }))
    vi.stubGlobal('fetch', fetch)
    await expect(openWhepSession(camera.id, offerPath, offer)).rejects.toMatchObject({ status, code: 'stream_disabled', sessionMayRemain: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a network or redirect failure leaves cleanup unconfirmed instead of posting again', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Redirect disallowed'))
    vi.stubGlobal('fetch', fetch)
    await expect(openWhepSession(camera.id, offerPath, offer)).rejects.toMatchObject({ status: null, sessionMayRemain: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each(['', 'x'.repeat(65_537)])('rejects empty/oversized SDP before POST', async body => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    await expect(openWhepSession(camera.id, offerPath, body)).rejects.toMatchObject({ sessionMayRemain: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires a key, current context and a non-aborted caller before POST', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    vi.stubGlobal('fetch', fetch)
    const old = getConnectionContext()
    setConnection(origin, '')
    await expect(openWhepSession(camera.id, offerPath, offer)).rejects.toMatchObject({ status: 401, sessionMayRemain: false })
    await expect(openWhepSession(camera.id, offerPath, offer, old)).rejects.toMatchObject({ cancelled: true, sessionMayRemain: false })
    setConnection(origin, 'fixture')
    const controller = new AbortController()
    controller.abort()
    await expect(openWhepSession(camera.id, offerPath, offer, getConnectionContext(), controller.signal)).rejects.toMatchObject({ cancelled: true, sessionMayRemain: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([`${offerPath}/${camera.id}?key=value`, `${offerPath}/${camera.id}#secret`, `${origin}${offerPath.replace(camera.id, calibration.id)}/${camera.id}`, `https://external.test${offerPath}/${camera.id}`, `${offerPath}/not-a-uuid`, '', `${offerPath}/x/../${camera.id}`])('never follows an untrusted/missing session Location: %s', async target => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(offerResponse({ Location: target }))
    vi.stubGlobal('fetch', fetch)
    await expect(openWhepSession(camera.id, offerPath, offer)).rejects.toMatchObject({ sessionMayRemain: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each<{ headers: Record<string, string>; body: string }>([
    { headers: { 'Content-Type': 'application/json' }, body: '{}' },
    { headers: {}, body: '' },
    { headers: {}, body: 'x'.repeat(65_537) },
    { headers: { Link: '<https://external.test>; rel="ice-server"' }, body: answer },
  ])('cleans up a known session after invalid answer or ICE headers', async ({ headers, body }) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(offerResponse(headers, body)).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await expect(openWhepSession(camera.id, offerPath, offer)).rejects.toMatchObject({ status: null, sessionMayRemain: false, cleanup: { status: 'deleted' } })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]![0]).toBe(location)
    expect(fetch.mock.calls[1]![1]!.method).toBe('DELETE')
  })
})

describe('WHEP ownership and late cleanup', () => {
  it('a late 201 after key/origin change is deleted using the creating key, never the new key', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const result = openWhepSession(camera.id, offerPath, offer).catch(error => error)
    const oldSignal = fetch.mock.calls[0]![1]!.signal as AbortSignal
    setConnection('http://new-sivera.test', 'replacement-fixture')
    expect(oldSignal.aborted).toBe(true)
    finish(offerResponse())
    expect(await result).toMatchObject({ cancelled: true, cleanup: { status: 'deleted' }, sessionMayRemain: false })
    expect(fetch.mock.calls[1]).toEqual([location, expect.objectContaining({ method: 'DELETE', headers: { 'X-API-Key': 'ui-fixture-not-a-credential' }, keepalive: true })])
    expect((fetch.mock.calls[1]![1]!.signal as AbortSignal).aborted).toBe(false)
  })

  it('a late 201 after caller close is also cleaned, without exposing an answer', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const result = openWhepSession(camera.id, offerPath, offer, getConnectionContext(), controller.signal).catch(error => error)
    controller.abort()
    finish(offerResponse())
    expect(await result).toMatchObject({ cancelled: true, cleanup: { status: 'deleted' } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('close is idempotent, aborts pending/queued PATCH and allows no later signaling', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(offerResponse())
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const { session } = await openWhepSession(camera.id, offerPath, offer)
    const first = patchWhepSession(session, fragment).catch(error => error)
    const second = patchWhepSession(session, fragment).catch(error => error)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const closing = closeWhepSession(session)
    expect((fetch.mock.calls[1]![1]!.signal as AbortSignal).aborted).toBe(true)
    finish(new Response(null, { status: 204, headers: { ETag: '"late"' } }))
    await expect(closing).resolves.toEqual({ status: 'deleted' })
    await expect(closeWhepSession(session)).resolves.toEqual({ status: 'deleted' })
    expect(await first).toMatchObject({ cancelled: true })
    expect(await second).toMatchObject({ cancelled: true })
    await expect(patchWhepSession(session, fragment)).rejects.toMatchObject({ cancelled: true })
    expect(session.etag).toBe('"first"')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each([204, 404, 403, 503])('reports the actual cleanup result at HTTP %s after logout', async status => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(offerResponse())
      .mockResolvedValueOnce(new Response(status === 204 ? null : '{}', { status }))
    vi.stubGlobal('fetch', fetch)
    const { session } = await openWhepSession(camera.id, offerPath, offer)
    setConnection(origin, '')
    const result = await closeWhepSession(session)
    expect(result.status).toBe(status === 204 ? 'deleted' : status === 404 ? 'not-found' : 'unconfirmed')
    expect((fetch.mock.calls[1]![1]!.headers as Record<string, string>)['X-API-Key']).toBe('ui-fixture-not-a-credential')
    await expect(patchWhepSession(session, fragment)).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('DELETE failure after an invalid answer is surfaced as unconfirmed, not successful cleanup', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(offerResponse({}, '')).mockRejectedValueOnce(new TypeError('Network unavailable'))
    vi.stubGlobal('fetch', fetch)
    await expect(openWhepSession(camera.id, offerPath, offer)).rejects.toMatchObject({ sessionMayRemain: true, cleanup: { status: 'unconfirmed', error: { status: null } } })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
