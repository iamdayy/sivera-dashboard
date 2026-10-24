import axios from 'axios'
import { shallowRef } from 'vue'
import type { HealthStatus } from '@/types'

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export function parseApiOrigin(input: string): { origin: string; migrated: boolean } {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('URL API harus berupa alamat HTTP atau HTTPS yang lengkap.')
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (path && path !== '/api/v1')) {
    throw new Error('Gunakan origin HTTP/HTTPS tanpa credentials, path, query, atau fragment.')
  }
  return { origin: url.origin, migrated: path === '/api/v1' }
}

function initialConnection() {
  try {
    const parsed = parseApiOrigin(localStorage.getItem('api_base_url') || DEFAULT_BASE_URL)
    return {
      origin: parsed.origin,
      generation: 0,
      notice: parsed.migrated ? 'Prefix /api/v1 dari konfigurasi lama telah dipisahkan. Simpan konfigurasi untuk memperbarui alamat tersimpan.' : '',
    }
  } catch (error) {
    return { origin: '', generation: 0, notice: error instanceof Error ? error.message : 'Konfigurasi URL API tidak valid.' }
  }
}

export const connectionState = shallowRef(initialConnection())
let connectionController = new AbortController()
let connectionKey = localStorage.getItem('api_key') || ''

export interface ConnectionContext {
  readonly origin: string
  readonly key: string
  readonly generation: number
  readonly signal: AbortSignal
}

export function getConnectionContext(): ConnectionContext {
  return { ...connectionState.value, key: connectionKey, signal: connectionController.signal }
}

export function isCurrentConnection(context: ConnectionContext): boolean {
  return context.generation === connectionState.value.generation && !context.signal.aborted
}

export function assertCurrentConnection(context: ConnectionContext): void {
  if (!isCurrentConnection(context)) throw new axios.CanceledError('Konteks koneksi telah berubah.')
}

export function setConnection(originInput: string, keyInput: string): { migrated: boolean } {
  const { origin, migrated } = parseApiOrigin(originInput)
  const key = keyInput.trim()
  localStorage.setItem('api_base_url', origin)
  if (key) localStorage.setItem('api_key', key)
  else localStorage.removeItem('api_key')
  if (origin !== connectionState.value.origin || key !== connectionKey) {
    connectionController.abort()
    connectionController = new AbortController()
    connectionKey = key
    connectionState.value = { origin, generation: connectionState.value.generation + 1, notice: '' }
  } else {
    connectionState.value = { ...connectionState.value, notice: '' }
  }
  apiClient.defaults.baseURL = origin
  return { migrated }
}

export function setBaseUrl(url: string): void {
  setConnection(url, connectionKey)
}

export function clearConnectionKey(): void {
  localStorage.removeItem('api_key')
  if (!connectionKey) return
  connectionController.abort()
  connectionController = new AbortController()
  connectionKey = ''
  connectionState.value = { ...connectionState.value, generation: connectionState.value.generation + 1 }
}

export function cameraPath(cameraId?: string, suffix = ''): string {
  return `/api/v1/cameras${cameraId ? `/${encodeURIComponent(cameraId)}` : ''}${suffix}`
}

export const apiClient = axios.create({
  baseURL: connectionState.value.origin,
  adapter: 'fetch',
  timeout: 30_000,
  fetchOptions: { redirect: 'error', credentials: 'omit' },
})

const requestContexts = new WeakMap<object, ConnectionContext>()
apiClient.interceptors.request.use((config) => {
  const context = getConnectionContext()
  if (!context.origin) throw { status: null, message: 'Atur origin API yang valid di Pengaturan.' }
  const target = new URL(config.url || '', context.origin)
  if (target.origin !== context.origin || target.username || target.password || target.hash || config.auth || config.baseURL !== context.origin || !(/^\/api\/v1\/cameras(?:\/|$)/.test(target.pathname) || target.pathname === '/health')) {
    throw { status: null, message: 'Tujuan request API tidak diizinkan.' }
  }
  config.baseURL = context.origin
  config.adapter = 'fetch'
  config.fetchOptions = { ...config.fetchOptions, redirect: 'error', credentials: 'omit' }
  config.withCredentials = false
  config.signal = config.signal ? AbortSignal.any([config.signal as AbortSignal, context.signal]) : context.signal
  config.headers.delete('X-API-Key')
  config.headers.delete('Authorization')
  if (context.key && target.pathname !== '/health') config.headers.set('X-API-Key', context.key)
  requestContexts.set(config, context)
  return config
}, (error: unknown) => { throw error }, { synchronous: true })

apiClient.interceptors.response.use((response) => {
  const context = requestContexts.get(response.config)
  if (context) assertCurrentConnection(context)
  return response
}, async (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const context = error.config && requestContexts.get(error.config)
    if (context) assertCurrentConnection(context)
    if (error.response?.data instanceof Blob) {
      error.response.data = await readErrorBlob(error.response.data)
      if (context) assertCurrentConnection(context)
    }
  }
  throw normalizeApiError(error)
})

export interface ApiError {
  status: number | null
  message: string
  code?: string
  field?: string
  session_id?: string
  cancelled?: boolean
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  // Backend messages can contain source credentials, input values, or stack traces.
  if (/rtsp[s]?:\/\/|https?:\/\/\S*@|traceback|password|secret|api[_ -]?key\s*[:=]/i.test(value)) return undefined
  return value.slice(0, 500)
}

const codeMessages: Record<string, string> = {
  capture_already_active: 'Masih ada sesi capture aktif untuk kamera ini. Lanjutkan sesi tersebut.',
  stream_disabled: 'Stream kamera belum diaktifkan.',
  stream_sync_pending: 'Konfigurasi stream belum tersinkron dengan MediaMTX. Periksa kembali status stream.',
  snapshot_not_found: 'Belum ada snapshot untuk kamera ini.',
  snapshot_stale: 'Snapshot terakhir sudah terlalu lama. Ambil snapshot baru.',
  snapshot_source_changed: 'Sumber kamera telah berubah. Ambil snapshot baru.',
  snapshot_requires_enabled_stream: 'Aktifkan stream sebelum mengambil atau memakai snapshot.',
  prediction_requires_calibration: 'Buat dan aktifkan kalibrasi kamera terlebih dahulu.',
  prediction_requires_ground_model: 'Buat referensi tanah dan model ground yang sesuai kalibrasi aktif.',
  prediction_requires_depth_scale: 'Skala kedalaman belum tersedia. Buat dan aktifkan di Skala Kedalaman.',
  depth_scale_prerequisites_changed: 'Konfigurasi aktif berubah. Muat ulang kalibrasi dan referensi tanah; unggah ulang gambar bila model ground berubah.',
  depth_scale_invalid_saved_fit: 'Fit tersimpan tidak layak diaktifkan. Buat skala baru dengan pengukuran yang benar.',
  depth_scale_poor_fit: 'Fit ditolak karena residual terlalu besar. Periksa titik dan pengukuran kedalaman Z.',
  depth_scale_degenerate_fit: 'Fit tidak dapat dihitung. Gunakan pixel berbeda dengan kedalaman yang bervariasi.',
  depth_scale_pixel_out_of_bounds: 'Titik pengukuran berada di luar preview gambar.',
  depth_scale_invalid_depth: 'Model menghasilkan depth yang tidak valid. Periksa gambar atau model bersama operator.',
  depth_scale_image_not_registered: 'Gambar tidak terdaftar untuk konteks ini. Unggah ulang gambar pengukuran.',
  depth_scale_image_not_found: 'Gambar pengukuran tidak ditemukan. Unggah ulang gambar.',
  depth_scale_invalid_image_key: 'Key gambar tidak valid. Gunakan hasil upload gambar pengukuran.',
  depth_scale_busy: 'Backend sedang menghitung skala lain. Tunggu, lalu periksa hasil sebelum mencoba lagi.',
  depth_scale_timeout: 'Batas waktu inferensi backend tercapai. Periksa hasil sebelum mencoba lagi.',
  depth_scale_storage_unavailable: 'Penyimpanan gambar backend tidak tersedia. Hubungi operator dan periksa hasil sebelum mencoba lagi.',
  depth_scale_image_unavailable: 'Backend tidak dapat menyiapkan preview gambar. Periksa kalibrasi bersama operator.',
  depth_scale_inference_unavailable: 'Inferensi depth tidak tersedia. Periksa model bersama operator.',
  depth_scale_computation_unavailable: 'Perhitungan skala tidak tersedia. Periksa backend bersama operator.',
  depth_scale_persistence_unavailable: 'Backend gagal menyimpan hasil. Periksa daftar dan skala aktif sebelum mencoba lagi.',
  depth_model_unavailable: 'File model depth belum tersedia di backend. Hubungi operator.',
  depth_model_invalid_name: 'Gunakan nama file model .pt yang terpasang di backend, tanpa path atau URL.',
  prediction_resolution_mismatch: 'Dimensi gambar harus tepat sesuai kalibrasi (atau dimensi kamera untuk kalibrasi legacy).',
  prediction_invalid_image: 'Berkas bukan gambar JPEG, PNG, atau BMP yang dapat dibaca backend.',
  capture_requires_enabled_stream: 'Aktifkan stream sebelum memulai capture kalibrasi.',
  camera_not_found: 'Kamera tidak ditemukan atau sudah dihapus.',
  calibration_invalid_image: 'Berkas kalibrasi bukan gambar yang didukung.',
  calibration_too_many_images: 'Jumlah gambar kalibrasi melebihi batas backend.',
  calibration_upload_too_large: 'Total ukuran gambar kalibrasi melebihi batas backend.',
  calibration_intrinsics_missing: 'Kalibrasi tidak memiliki intrinsics asli atau dimensi yang diperlukan. Lakukan kalibrasi ulang.',
}

export function apiErrorFromResponse(status: number, data: unknown): ApiError {
  const detail = record(data)?.detail ?? data
  const metadata = record(detail)
  const code = typeof metadata?.code === 'string' && /^[a-z][a-z0-9_]{0,100}$/.test(metadata.code) ? metadata.code : undefined
  const field = typeof metadata?.field === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(metadata.field) ? metadata.field : undefined
  const session_id = typeof metadata?.session_id === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(metadata.session_id) ? metadata.session_id : undefined
  let message = code && codeMessages[code]
  if (!message && status < 500) {
    if (Array.isArray(detail)) {
      message = detail.map(item => {
        const validation = record(item)
        const location = Array.isArray(validation?.loc) ? validation.loc.filter(part => typeof part === 'string' && !['body', 'query'].includes(part)).join('.') : ''
        return `${location ? `${location}: ` : ''}${safeText(validation?.msg) ?? 'data tidak valid'}`
      }).join('; ').slice(0, 1000)
    } else message = safeText(metadata?.message ?? detail)
  }
  if (status === 401) message = 'API Key tidak valid atau tidak aktif. Atur kembali di Pengaturan.'
  else if (status === 403) message = 'API Key tidak memiliki izin untuk operasi ini.'
  else if (status === 404 && !code) message = 'Data tidak ditemukan atau sudah dihapus.'
  else if (status >= 500 && !(code && codeMessages[code])) message = `Server API mengalami kesalahan (HTTP ${status}). Coba lagi beberapa saat lagi.`
  else if (status === 422) message = `Data yang dikirim tidak valid${message ? `: ${message}` : '.'}`
  return {
    status,
    message: message || (status === 404 ? 'Data tidak ditemukan atau sudah dihapus.' : status === 413 ? 'Berkas terlalu besar untuk diunggah.' : `Permintaan gagal (HTTP ${status}).`),
    ...(code ? { code } : {}), ...(field ? { field } : {}), ...(session_id ? { session_id } : {}),
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isCancel(error) || (error instanceof Error && error.name === 'AbortError')) {
    return { status: null, message: 'Permintaan dibatalkan.', cancelled: true }
  }
  if (axios.isAxiosError(error) && error.response) return apiErrorFromResponse(error.response.status, error.response.data)
  const normalized = record(error)
  if (normalized && (normalized.status === null || (typeof normalized.status === 'number' && Number.isInteger(normalized.status))) && typeof normalized.message === 'string') {
    const metadata = apiErrorFromResponse(normalized.status ?? 0, { detail: normalized })
    return { ...metadata, status: normalized.status, message: safeText(normalized.message) ?? 'Permintaan gagal.', ...(normalized.cancelled === true ? { cancelled: true } : {}) }
  }
  return { status: null, message: 'Tidak dapat terhubung ke server API. Periksa koneksi atau URL API di Pengaturan.' }
}

export function isApiCancellation(error: unknown): boolean {
  return normalizeApiError(error).cancelled === true
}

export async function readErrorBlob(blob: Blob): Promise<unknown> {
  if (blob.size > 64_000) return undefined
  try { return JSON.parse(await blob.text()) as unknown } catch { return undefined }
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    return (await apiClient.get<HealthStatus>('/health')).data
  } catch (error) {
    throw normalizeApiError(error)
  }
}
