<script setup lang="ts">
import { formatMeasurement } from '@/lib/measurement-format'
import type { VolumeEstimate } from '@/types'

defineProps<{ volumes: VolumeEstimate[] }>()

function methodLabel(method: string): string {
  if (method === 'grid') return 'Grid/Voxel'
  if (method === 'convex_hull') return 'Convex Hull 2D'
  return method
}
</script>

<template>
  <section class="mb-6 space-y-4 text-sm" aria-labelledby="prediction-volume-heading">
    <div>
      <h3 id="prediction-volume-heading" class="text-lg font-semibold text-text">Estimasi volume</h3>
      <p class="mt-1 text-sm text-text-muted">Estimasi eksperimental; akurasi fisik belum diverifikasi. Bandingkan metode secara terpisah, jangan jumlahkan hasilnya.</p>
    </div>
    <p v-if="volumes.length === 0" class="text-sm text-text-muted" role="status">Rincian volume belum tersedia. Muat ulang detail untuk memeriksa hasil tersimpan.</p>
    <div v-for="volume in volumes" :key="volume.id" class="space-y-2 border-t border-sheet-border pt-4">
      <h4 class="font-medium text-text">{{ methodLabel(volume.method) }}</h4>
      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt class="text-sm text-text-muted">Volume (m³)</dt>
          <dd class="break-words text-2xl tabular-nums text-text">{{ formatMeasurement(volume.volume_m3) }}</dd>
        </div>
        <div>
          <dt class="text-sm text-text-muted">Volume (L)</dt>
          <dd class="break-words text-2xl tabular-nums text-text">{{ formatMeasurement(volume.volume_liter, 0) }}</dd>
        </div>
      </dl>
      <details>
        <summary class="min-h-11 cursor-pointer content-center text-sm font-medium text-brand">Rincian {{ methodLabel(volume.method) }}</summary>
        <p v-if="volume.method === 'grid'" class="mt-2 text-sm text-text-muted">Menjumlahkan median tinggi positif tiap sel yang memenuhi ambang titik, dikali luas sel. Sel kosong atau kurang titik dilewati; sel batas tetap memakai luas sel penuh. Ukuran sel dan minimum titik memengaruhi hasil.</p>
        <p v-else-if="volume.method === 'convex_hull'" class="mt-2 text-sm text-text-muted">Luas convex hull pada bidang tanah (2D) dikali median tinggi. Ini bukan volume convex hull 3D; hull dapat mencakup ruang kosong di antara titik.</p>
        <p v-else class="mt-2 text-sm text-text-muted">Metode dilaporkan backend; definisinya belum tersedia di dashboard.</p>
        <dl class="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt class="text-text-muted">Luas footprint (m²)</dt><dd class="tabular-nums">{{ formatMeasurement(volume.footprint_m2) }}</dd></div>
          <div><dt class="text-text-muted">Tinggi rata-rata titik (m)</dt><dd class="tabular-nums">{{ formatMeasurement(volume.height_mean_m) }}</dd></div>
          <div><dt class="text-text-muted">Median tinggi titik (m)</dt><dd class="tabular-nums">{{ formatMeasurement(volume.height_median_m) }}</dd></div>
          <div><dt class="text-text-muted">Titik</dt><dd class="tabular-nums">{{ formatMeasurement(volume.n_points, 0) }}</dd></div>
          <div v-if="volume.method === 'grid'"><dt class="text-text-muted">Ukuran sel hasil (m)</dt><dd class="tabular-nums">{{ formatMeasurement(volume.cell_m) }}</dd></div>
          <div v-if="volume.method === 'grid'"><dt class="text-text-muted">Sel dengan data tinggi</dt><dd class="tabular-nums">{{ formatMeasurement(volume.n_cells, 0) }}</dd></div>
        </dl>
      </details>
    </div>
    <p v-if="volumes.length > 0" class="text-xs text-text-muted">Tanda - berarti nilai tidak tersedia atau tidak valid, bukan nol. Parameter permintaan ada di Konfigurasi job tersimpan.</p>
  </section>
</template>
