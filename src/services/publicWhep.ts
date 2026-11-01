import { apiErrorFromResponse, normalizeApiError, type ApiError } from './api'

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const maxSdpBytes = 65_536

export interface PublicWhepCapabilities {
  acceptPost: string | null
  acceptPatch: string | null
  iceServers: RTCIceServer[]
}

export interface PublicWhepSession {
  readonly cameraId: string
  readonly location: string
  readonly etag: string | null
}

export interface PublicWhepOfferResult {
  session: PublicWhepSession
  answer: string
  iceServers: RTCIceServer[]
}

export interface PublicWhepPatchResult {
  status: 200 | 204
  fragment: string | null
  etag: string | null
}

export type PublicWhepCleanupResult = { status: 'deleted' | 'not-found' } | { status: 'unconfirmed'; error: PublicWhepError }

export interface PublicWhepError extends ApiError {
  sessionMayRemain: boolean
  cleanup?: PublicWhepCleanupResult
}

interface PublicSessionState {
  etag: string | null
  controller: AbortController
  tail: Promise<void>
  cleanup?: Promise<PublicWhepCleanupResult>
}

const publicSessions = new WeakMap<PublicWhepSession, PublicSessionState>()

function invalidResponse(message = 'Respons signaling WHEP tidak valid. Periksa konfigurasi backend dan CORS.'): PublicWhepError {
  return { status: null, message, sessionMayRemain: false }
}

function trustedWhepUrl(path: string, cameraId: string, base: string, session = false): string {
  if (!base || !uuid.test(cameraId) || !path || /[\\%\s]/.test(path) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)) {
    throw invalidResponse('Alamat WHEP tidak diizinkan.')
  }
  let url: URL
  try { url = new URL(path, base) } catch { throw invalidResponse('Alamat WHEP tidak diizinkan.') }
  const root = `/api/v1/public/cameras/${cameraId}/stream/whep`
  const validPath = session ? url.pathname.startsWith(`${root}/`) && uuid.test(url.pathname.slice(root.length + 1)) : url.pathname === root
  if (url.origin !== new URL(base).origin || url.username || url.password || url.search || url.hash || !validPath) {
    throw invalidResponse('Alamat WHEP tidak diizinkan. Gunakan Location backend untuk kamera yang dipilih.')
  }
  return url.href
}

function splitHeader(value: string, separator: string): string[] {
  const parts: string[] = []
  let start = 0
  let quoted = false
  let escaped = false
  let bracket = false
  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    if (escaped) { escaped = false; continue }
    if (quoted && char === '\\') { escaped = true; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (!quoted) {
      if (char === '<') bracket = true
      else if (char === '>') bracket = false
      else if (!bracket && char === separator) { parts.push(value.slice(start, i).trim()); start = i + 1 }
    }
  }
  if (quoted || escaped || bracket) throw invalidResponse('Header ICE server WHEP tidak valid.')
  parts.push(value.slice(start).trim())
  return parts
}

function parameterValue(value: string): string {
  if (value.startsWith('"')) {
    if (!/^"(?:[^"\\]|\\.)*"$/.test(value)) throw invalidResponse('Header ICE server WHEP tidak valid.')
    return value.slice(1, -1).replace(/\\(.)/g, '$1')
  }
  if (!/^[^\s";,]+$/.test(value)) throw invalidResponse('Header ICE server WHEP tidak valid.')
  return value
}

export function parsePublicWhepIceServers(link: string | null): RTCIceServer[] {
  if (!link) return []
  const servers: RTCIceServer[] = []
  for (const item of splitHeader(link, ',')) {
    const [target, ...parameters] = splitHeader(item, ';')
    const match = target?.match(/^<([^<>]+)>$/)
    if (!match) throw invalidResponse('Header ICE server WHEP tidak valid.')
    const values = new Map<string, string>()
    for (const parameter of parameters) {
      const equals = parameter.indexOf('=')
      if (equals < 1) throw invalidResponse('Header ICE server WHEP tidak valid.')
      values.set(parameter.slice(0, equals).trim().toLowerCase(), parameterValue(parameter.slice(equals + 1).trim()))
    }
    if (!values.get('rel')?.split(/\s+/).includes('ice-server')) continue
    const urls = match[1]!
    if (!/^(?:stun|stuns|turn|turns):[^\s<>"@]+$/i.test(urls)) throw invalidResponse('Alamat ICE server WHEP tidak didukung.')
    const username = values.get('username')
    const credential = values.get('credential')
    if (values.has('credential-type') && values.get('credential-type') !== 'password') {
      throw invalidResponse('Jenis credential ICE server belum didukung. Gunakan TURN password dari backend.')
    }
    if (/^turns?:/i.test(urls) && (!username || !credential)) throw invalidResponse('Credential TURN dari backend belum lengkap.')
    servers.push({ urls, ...(username !== undefined ? { username } : {}), ...(credential !== undefined ? { credential } : {}) })
  }
  return servers
}

function requestSignal(signal?: AbortSignal, sessionSignal?: AbortSignal): AbortSignal {
  return AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : []), ...(sessionSignal ? [sessionSignal] : [])])
}

function requireSdp(text: string) {
  if (!text.trim() || new TextEncoder().encode(text).byteLength > maxSdpBytes) {
    throw invalidResponse('SDP kosong atau melebihi batas signaling (64 KiB).')
  }
}

async function readBody(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) return text + decoder.decode()
      bytes += value.byteLength
      if (bytes > maxSdpBytes) throw invalidResponse('Respons signaling melebihi batas 64 KiB.')
      text += decoder.decode(value, { stream: true })
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

async function checkResponse(response: Response, expected: number[], signal: AbortSignal) {
  if (expected.includes(response.status)) return
  const text = await readBody(response, signal)
  let data: unknown
  try { data = JSON.parse(text) as unknown } catch { data = undefined }
  if (!response.ok) {
    const error = apiErrorFromResponse(response.status, data)
    if (response.status === 403) error.message = 'Stream kamera belum diaktifkan. Minta administrator mengaktifkannya.'
    throw { ...error, sessionMayRemain: false } satisfies PublicWhepError
  }
  throw invalidResponse()
}

function checkMime(response: Response, expected: string) {
  if (response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== expected) throw invalidResponse()
}

const publicApiBase = import.meta.env.VITE_API_BASE_URL || ''

export async function getPublicWhepCapabilities(cameraId: string, signal?: AbortSignal): Promise<PublicWhepCapabilities> {
  try {
    const path = `/api/v1/public/cameras/${cameraId}/stream/whep`
    const url = trustedWhepUrl(path, cameraId, publicApiBase)
    const combined = requestSignal(signal)
    combined.throwIfAborted()
    const response = await fetch(url, { method: 'OPTIONS', signal: combined, redirect: 'error', credentials: 'omit', cache: 'no-store' })
    combined.throwIfAborted()
    await checkResponse(response, [204], combined)
    combined.throwIfAborted()
    return { acceptPost: response.headers.get('Accept-Post'), acceptPatch: response.headers.get('Accept-Patch'), iceServers: parsePublicWhepIceServers(response.headers.get('Link')) }
  } catch (error) {
    throw { ...normalizeApiError(error), sessionMayRemain: false } satisfies PublicWhepError
  }
}

export async function openPublicWhepSession(cameraId: string, offer: string, signal?: AbortSignal): Promise<PublicWhepOfferResult> {
  let session: PublicWhepSession | undefined
  let response: Response | undefined
  let submitted = false
  try {
    const path = `/api/v1/public/cameras/${cameraId}/stream/whep`
    const url = trustedWhepUrl(path, cameraId, publicApiBase)
    requireSdp(offer)
    const combined = requestSignal(signal)
    combined.throwIfAborted()
    submitted = true
    response = await fetch(url, { method: 'POST', body: offer, headers: { 'Content-Type': 'application/sdp' }, signal: combined, redirect: 'error', credentials: 'omit', cache: 'no-store' })
    if (response.status === 201) {
      const location = trustedWhepUrl(response.headers.get('Location') || '', cameraId, publicApiBase, true)
      const state: PublicSessionState = { etag: response.headers.get('ETag'), controller: new AbortController(), tail: Promise.resolve() }
      session = Object.freeze({ cameraId, location, get etag() { return state.etag } })
      publicSessions.set(session, state)
    }
    combined.throwIfAborted()
    await checkResponse(response, [201], combined)
    checkMime(response, 'application/sdp')
    const answer = await readBody(response, combined)
    combined.throwIfAborted()
    requireSdp(answer)
    const iceServers = parsePublicWhepIceServers(response.headers.get('Link'))
    return { session: session!, answer, iceServers }
  } catch (error) {
    void response?.body?.cancel().catch(() => {})
    const cleanup = session ? await closePublicWhepSession(session) : undefined
    const normalized = normalizeApiError(error)
    const result: PublicWhepError = {
      ...normalized,
      sessionMayRemain: submitted && (!cleanup || cleanup.status === 'unconfirmed'),
      ...(cleanup ? { cleanup } : {}),
    }
    throw result
  }
}

export async function patchPublicWhepSession(session: PublicWhepSession, fragment: string, signal?: AbortSignal): Promise<PublicWhepPatchResult> {
  const state = publicSessions.get(session)
  if (!state) throw invalidResponse('Sesi WHEP tidak dikenali.')
  const task = state.tail.then(async (): Promise<PublicWhepPatchResult> => {
    try {
      const combined = requestSignal(signal, state.controller.signal)
      combined.throwIfAborted()
      requireSdp(fragment)
      const headers: Record<string, string> = { 'Content-Type': 'application/trickle-ice-sdpfrag' }
      if (state.etag !== null) headers['If-Match'] = state.etag
      const response = await fetch(session.location, { method: 'PATCH', body: fragment, headers, signal: combined, redirect: 'error', credentials: 'omit', cache: 'no-store' })
      combined.throwIfAborted()
      await checkResponse(response, [200, 204], combined)
      if (response.status === 200) checkMime(response, 'application/trickle-ice-sdpfrag')
      const answer = response.status === 200 ? await readBody(response, combined) : null
      combined.throwIfAborted()
      if (answer !== null) requireSdp(answer)
      state.etag = response.headers.get('ETag') ?? state.etag
      return { status: response.status as 200 | 204, fragment: answer, etag: state.etag }
    } catch (error) {
      throw { ...normalizeApiError(error), sessionMayRemain: false } satisfies PublicWhepError
    }
  })
  state.tail = task.then(() => {}, () => {})
  return task
}

export async function closePublicWhepSession(session: PublicWhepSession): Promise<PublicWhepCleanupResult> {
  const state = publicSessions.get(session)
  if (!state) return { status: 'unconfirmed', error: invalidResponse('Sesi WHEP tidak dikenali.') }
  if (state.cleanup) return state.cleanup
  state.controller.abort()
  state.cleanup = (async (): Promise<PublicWhepCleanupResult> => {
    try {
      const url = trustedWhepUrl(session.location, session.cameraId, publicApiBase, true)
      const signal = AbortSignal.timeout(5_000)
      const response = await fetch(url, { method: 'DELETE', signal, redirect: 'error', credentials: 'omit', cache: 'no-store', keepalive: true })
      signal.throwIfAborted()
      if (response.status === 404) return { status: 'not-found' }
      await checkResponse(response, [204], signal)
      return { status: 'deleted' }
    } catch (error) {
      return { status: 'unconfirmed', error: { ...normalizeApiError(error), sessionMayRemain: true } }
    }
  })()
  return state.cleanup
}
