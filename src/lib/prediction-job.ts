import { apiErrorFromResponse } from '@/services/api'
import type { PredictionJob, PredictionJobStatus } from '@/types'

export function isPredictionJobStatus(status: unknown): status is PredictionJobStatus {
  return status === 'pending' || status === 'processing' || status === 'done' || status === 'failed'
}

export function isUnfinishedJob(status: string): boolean {
  return status === 'pending' || status === 'processing'
}

export function hasPredictionVolume(job: PredictionJob): boolean {
  const volume = job.result?.volume
  if (!volume || typeof volume !== 'object') return false
  return Object.entries(volume).some(([method, value]) => {
    if (!['method_grid', 'method_convex_hull'].includes(method) || !value || typeof value !== 'object') return false
    return 'volume_m3' in value && typeof value.volume_m3 === 'number' && Number.isFinite(value.volume_m3) && value.volume_m3 >= 0
      && 'volume_liter' in value && typeof value.volume_liter === 'number' && Number.isFinite(value.volume_liter) && value.volume_liter >= 0
  })
}

export function predictionFailureMessage(job: PredictionJob): string {
  const messages: Record<string, string> = {
    prediction_processing_failed: 'Pemrosesan gagal. Periksa worker dan model bersama operator sebelum membuat prediksi baru.',
    prediction_queue_unavailable: 'Antrean prediksi tidak tersedia. Minta operator memulihkan antrean, lalu buat prediksi baru.',
    prediction_queue_timeout: 'Job melewati batas waktu antrean. Periksa worker bersama operator, lalu buat prediksi baru.',
    prediction_worker_timeout: 'Pemrosesan melewati batas waktu worker. Periksa worker bersama operator, lalu buat prediksi baru.',
    prediction_source_changed: 'Sumber kamera berubah saat job berjalan. Periksa kamera, lalu buat prediksi baru.',
    prediction_prerequisites_missing: 'Konfigurasi job tidak lagi tersedia. Periksa kalibrasi, referensi tanah, dan skala kedalaman sebelum membuat prediksi baru.',
  }
  if (job.error_msg && messages[job.error_msg]) return messages[job.error_msg]!
  const mapped = apiErrorFromResponse(500, { detail: { code: job.error_msg } }).message
  if (!mapped.startsWith('Server API')) return `${mapped} Setelah diperbaiki, buat prediksi baru.`
  return 'Prediksi gagal. Periksa job ini bersama operator sebelum membuat prediksi baru.'
}
