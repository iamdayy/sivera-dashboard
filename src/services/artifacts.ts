import { apiErrorFromResponse, assertCurrentConnection, getConnectionContext, normalizeApiError, readErrorBlob } from './api'
import type { ConnectionContext } from './api'

const uuid = '[\\da-fA-F]{8}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{12}'
const cameraRoot = `/api/v1/cameras/${uuid}`
const binaryEndpoints = new RegExp(`^(?:${cameraRoot}/snapshots/${uuid}/image|${cameraRoot}/calibration-captures/${uuid}/images/${uuid}(?:/preview)?|${cameraRoot}/predict/${uuid}/outputs/[a-z][a-z0-9_]*|/files/[^/].*)$`)

export function trustedArtifactUrl(path: string, context = getConnectionContext()): string {
  if (!context.origin || !path || path.includes('\\') || /%2f|%5c|%2e/i.test(path)) throw new Error('Alamat artefak tidak diizinkan.')
  const url = new URL(path, `${context.origin}/`)
  if (url.origin !== context.origin || url.username || url.password || url.search || url.hash || !binaryEndpoints.test(url.pathname) || /%2f|%5c|%2e/i.test(url.pathname)) {
    throw new Error('Alamat artefak tidak diizinkan. Gunakan endpoint backend yang terautentikasi.')
  }
  return url.href
}

export function requireImageBlob(blob: Blob): Blob {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(blob.type.split(';')[0] || '')) {
    throw { status: null, message: 'Berkas preview bukan gambar yang didukung.' }
  }
  return blob
}

export async function fetchArtifactBlob(path: string, context: ConnectionContext = getConnectionContext(), signal?: AbortSignal): Promise<Blob> {
  assertCurrentConnection(context)
  const url = trustedArtifactUrl(path, context)
  if (!context.key) throw apiErrorFromResponse(401, undefined)
  const requestSignal = AbortSignal.any([context.signal, AbortSignal.timeout(30_000), ...(signal ? [signal] : [])])
  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': context.key },
      redirect: 'error', credentials: 'omit', signal: requestSignal,
    })
    assertCurrentConnection(context)
    const blob = await response.blob()
    assertCurrentConnection(context)
    requestSignal.throwIfAborted()
    if (!response.ok) {
      const data = await readErrorBlob(blob)
      assertCurrentConnection(context)
      requestSignal.throwIfAborted()
      throw apiErrorFromResponse(response.status, data)
    }
    return blob
  } catch (error) {
    assertCurrentConnection(context)
    throw normalizeApiError(error)
  }
}
