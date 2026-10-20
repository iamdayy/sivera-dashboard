import axios from 'axios'
import type { AxiosResponse } from 'axios'
import type { HealthStatus } from '@/types'

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function resolveBaseUrl(): string {
  return localStorage.getItem('api_base_url') || DEFAULT_BASE_URL
}

export const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
})

export function setBaseUrl(url: string): void {
  apiClient.defaults.baseURL = url
  localStorage.setItem('api_base_url', url)
}

// API key hanya berasal dari input pengguna (localStorage), tanpa fallback hardcoded.
apiClient.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('api_key')
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey
  }
  return config
})

export interface ApiError {
  status: number | null
  message: string
  detail?: string
}

function formatValidationItem(item: unknown): string {
  if (item && typeof item === 'object' && 'msg' in item) {
    const { msg, loc } = item as { msg?: unknown; loc?: unknown }
    const location = Array.isArray(loc) ? loc.filter((part) => part !== 'body').join('.') : ''
    const text = String(msg ?? 'data tidak valid')
    return location ? `${location}: ${text}` : text
  }
  return 'data tidak valid'
}

function extractDetail(data: unknown): string | undefined {
  if (typeof data === 'string' && data) return data
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string' && detail) return detail
    if (Array.isArray(detail)) {
      const formatted = detail.map(formatValidationItem).join('; ')
      return formatted || undefined
    }
  }
  return undefined
}

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null
    const detail = extractDetail(error.response?.data)
    if (status === null) {
      return {
        status: null,
        message: 'Tidak dapat terhubung ke server API. Periksa koneksi atau URL API di Pengaturan.',
      }
    }
    if (status === 401) {
      return { status, message: 'API Key tidak valid atau tidak aktif. Atur kembali di Pengaturan.' }
    }
    if (status === 403) {
      return { status, message: 'API Key tidak memiliki izin untuk operasi ini.' }
    }
    if (status === 404) {
      return { status, message: 'Data tidak ditemukan atau sudah dihapus.' }
    }
    if (status === 413) {
      return { status, message: detail ?? 'Berkas terlalu besar untuk diunggah.' }
    }
    if (status === 422) {
      return { status, message: `Data yang dikirim tidak valid${detail ? `: ${detail}` : '.'}` }
    }
    if (status >= 500) {
      return { status, message: `Server API mengalami kesalahan (HTTP ${status}). Coba lagi beberapa saat lagi.` }
    }
    return { status, message: detail ?? `Permintaan gagal (HTTP ${status}).` }
  }
  return { status: null, message: 'Terjadi kesalahan yang tidak diketahui.' }
}

// URL artefak: file_path dari API adalah storage key, backend local menyajikannya di /files/{key}.
export function artifactUrl(filePath: string): string {
  const base = new URL(apiClient.defaults.baseURL || DEFAULT_BASE_URL, window.location.origin)
  return new URL(filePath.replace(/^\/+/, ''), base).toString()
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const response = await apiClient.get<HealthStatus>('/health')
    return response.data
  } catch (error) {
    throw normalizeApiError(error)
  }
}