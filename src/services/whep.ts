import { apiErrorFromResponse, assertCurrentConnection, cameraPath, getConnectionContext, isCurrentConnection, normalizeApiError } from './api'
import type { ApiError, ConnectionContext } from './api'

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
const maxSdpBytes = 65_536

export interface WhepCapabilities {
  acceptPost: string | null
  acceptPatch: string | null
  iceServers: RTCIceServer[]
}

export interface WhepSession {
  readonly cameraId: string
  readonly location: string
  readonly context: ConnectionContext
  readonly etag: string | null
}

export interface WhepOfferResult {
  session: WhepSession
  answer: string
  iceServers: RTCIceServer[]
}

export interface WhepPatchResult {
  status: 200 | 204
  fragment: string | null
  etag: string | null
}

export type WhepCleanupResult = { status: 'deleted' | 'not-found' } | { status: 'unconfirmed'; error: ApiError }

export interface WhepOfferError extends ApiError {
  sessionMayRemain: boolean
  cleanup?: WhepCleanupResult
}

interface SessionState {
  etag: string | null
  controller: AbortController
  tail: Promise<void>
  cleanup?: Promise<WhepCleanupResult>
}

const sessions = new WeakMap<WhepSession, SessionState>()

function invalidResponse(message = 'Respons signaling WHEP tidak valid. Periksa konfigurasi backend dan CORS.'): ApiError {
  return { status: null, message }
}

function trustedWhepUrl(path: string, cameraId: string, context: ConnectionContext, session = false, base?: string): string {
  if (!context.origin || !uuid.test(cameraId) || !path || /[\\%\s]/.test(path) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)) {
    throw invalidResponse('Alamat WHEP tidak diizinkan.')
  }
  let url: URL
  try { url = new URL(path, base || `${context.origin}/`) } catch { throw invalidResponse('Alamat WHEP tidak diizinkan.') }
  const root = cameraPath(cameraId, '/stream/whep')
  const validPath = session ? url.pathname.startsWith(`${root}/`) && uuid.test(url.pathname.slice(root.length + 1)) : url.pathname === root
  if (url.origin !== context.origin || url.username || url.password || url.search || url.hash || !validPath) {
    throw invalidResponse('Alamat WHEP tidak diizinkan. Gunakan Location backend untuk kamera yang dipilih.')
  }
  return url.href
}

export function trustedWhepOfferUrl(path: string, cameraId: string, context = getConnectionContext()): string {
  return trustedWhepUrl(path, cameraId, context)
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

export function parseWhepIceServers(link: string | null): RTCIceServer[] {
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

function requestSignal(context: ConnectionContext, signal?: AbortSignal, sessionSignal?: AbortSignal): AbortSignal {
  return AbortSignal.any([context.signal, AbortSignal.timeout(30_000), ...(signal ? [signal] : []), ...(sessionSignal ? [sessionSignal] : [])])
}

function requireKey(context: ConnectionContext) {
  if (!context.key) throw apiErrorFromResponse(401, undefined)
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
  if (!response.ok) throw apiErrorFromResponse(response.status, data)
  throw invalidResponse()
}

function checkMime(response: Response, expected: string) {
  if (response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== expected) throw invalidResponse()
}

export async function getWhepCapabilities(cameraId: string, path: string, context = getConnectionContext(), signal?: AbortSignal): Promise<WhepCapabilities> {
  try {
    assertCurrentConnection(context)
    requireKey(context)
    const url = trustedWhepOfferUrl(path, cameraId, context)
    const combined = requestSignal(context, signal)
    combined.throwIfAborted()
    const response = await fetch(url, { method: 'OPTIONS', headers: { 'X-API-Key': context.key }, signal: combined, redirect: 'error', credentials: 'omit', cache: 'no-store' })
    assertCurrentConnection(context)
    combined.throwIfAborted()
    await checkResponse(response, [204], combined)
    assertCurrentConnection(context)
    combined.throwIfAborted()
    return { acceptPost: response.headers.get('Accept-Post'), acceptPatch: response.headers.get('Accept-Patch'), iceServers: parseWhepIceServers(response.headers.get('Link')) }
  } catch (error) {
    assertCurrentConnection(context)
    throw normalizeApiError(error)
  }
}

export async function openWhepSession(cameraId: string, path: string, offer: string, context = getConnectionContext(), signal?: AbortSignal): Promise<WhepOfferResult> {
  let session: WhepSession | undefined
  let response: Response | undefined
  let submitted = false
  try {
    assertCurrentConnection(context)
    requireKey(context)
    const url = trustedWhepOfferUrl(path, cameraId, context)
    requireSdp(offer)
    const combined = requestSignal(context, signal)
    combined.throwIfAborted()
    submitted = true
    response = await fetch(url, { method: 'POST', body: offer, headers: { 'X-API-Key': context.key, 'Content-Type': 'application/sdp' }, signal: combined, redirect: 'error', credentials: 'omit', cache: 'no-store' })
    // Capture Location before stale/abort checks so a late 201 can still be deleted by its owner.
    if (response.status === 201) {
      const location = trustedWhepUrl(response.headers.get('Location') || '', cameraId, context, true, url)
      const state: SessionState = { etag: response.headers.get('ETag'), controller: new AbortController(), tail: Promise.resolve() }
      session = Object.freeze({ cameraId, location, context, get etag() { return state.etag } })
      sessions.set(session, state)
    }
    assertCurrentConnection(context)
    combined.throwIfAborted()
    await checkResponse(response, [201], combined)
    checkMime(response, 'application/sdp')
    const answer = await readBody(response, combined)
    assertCurrentConnection(context)
    combined.throwIfAborted()
    requireSdp(answer)
    const iceServers = parseWhepIceServers(response.headers.get('Link'))
    return { session: session!, answer, iceServers }
  } catch (error) {
    void response?.body?.cancel().catch(() => {})
    const cleanup = session ? await closeWhepSession(session) : undefined
    const normalized = isCurrentConnection(context) ? normalizeApiError(error) : { status: null, message: 'Konteks koneksi telah berubah.', cancelled: true }
    throw { ...normalized, sessionMayRemain: submitted && (!cleanup || cleanup.status === 'unconfirmed'), ...(cleanup ? { cleanup } : {}) } satisfies WhepOfferError
  }
}

export async function patchWhepSession(session: WhepSession, fragment: string, signal?: AbortSignal): Promise<WhepPatchResult> {
  const state = sessions.get(session)
  if (!state) throw invalidResponse('Sesi WHEP tidak dikenali.')
  const task = state.tail.then(async (): Promise<WhepPatchResult> => {
    try {
      assertCurrentConnection(session.context)
      const combined = requestSignal(session.context, signal, state.controller.signal)
      combined.throwIfAborted()
      requireSdp(fragment)
      const headers: Record<string, string> = { 'X-API-Key': session.context.key, 'Content-Type': 'application/trickle-ice-sdpfrag' }
      if (state.etag !== null) headers['If-Match'] = state.etag
      const response = await fetch(session.location, { method: 'PATCH', body: fragment, headers, signal: combined, redirect: 'error', credentials: 'omit', cache: 'no-store' })
      assertCurrentConnection(session.context)
      combined.throwIfAborted()
      await checkResponse(response, [200, 204], combined)
      if (response.status === 200) checkMime(response, 'application/trickle-ice-sdpfrag')
      const answer = response.status === 200 ? await readBody(response, combined) : null
      assertCurrentConnection(session.context)
      combined.throwIfAborted()
      if (answer !== null) requireSdp(answer)
      state.etag = response.headers.get('ETag') ?? state.etag
      return { status: response.status as 200 | 204, fragment: answer, etag: state.etag }
    } catch (error) {
      assertCurrentConnection(session.context)
      throw normalizeApiError(error)
    }
  })
  state.tail = task.then(() => {}, () => {})
  return task
}

export async function closeWhepSession(session: WhepSession): Promise<WhepCleanupResult> {
  const state = sessions.get(session)
  if (!state) return { status: 'unconfirmed', error: invalidResponse('Sesi WHEP tidak dikenali.') }
  if (state.cleanup) return state.cleanup
  state.controller.abort()
  // Cleanup deliberately excludes the connection signal: it may already be aborted after logout.
  state.cleanup = (async (): Promise<WhepCleanupResult> => {
    try {
      const url = trustedWhepUrl(session.location, session.cameraId, session.context, true)
      const signal = AbortSignal.timeout(5_000)
      const response = await fetch(url, { method: 'DELETE', headers: { 'X-API-Key': session.context.key }, signal, redirect: 'error', credentials: 'omit', cache: 'no-store', keepalive: true })
      signal.throwIfAborted()
      if (response.status === 404) return { status: 'not-found' }
      await checkResponse(response, [204], signal)
      return { status: 'deleted' }
    } catch (error) {
      return { status: 'unconfirmed', error: normalizeApiError(error) }
    }
  })()
  return state.cleanup
}
