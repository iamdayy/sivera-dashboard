<template>
  <div
    class="chart-container"
    :role="showChart ? 'img' : undefined"
    :aria-label="showChart ? ariaLabel : undefined"
  >
    <div v-if="loading" class="chart-state" role="status">
      <div class="spinner" aria-hidden="true" />
      <p class="chart-state-title">Memuat data volume...</p>
    </div>

    <div v-else-if="error" class="chart-state" role="alert">
      <AlertCircle class="h-6 w-6 text-negative" aria-hidden="true" />
      <p class="chart-state-title">Gagal memuat data volume</p>
      <p class="chart-state-description">{{ error }}</p>
      <button type="button" class="btn btn-outline btn-sm mt-3" @click="emit('retry')">
        Coba Lagi
      </button>
    </div>

    <div v-else-if="!hasData" class="chart-state">
      <ChartColumn class="h-10 w-10 opacity-40" aria-hidden="true" />
      <p class="chart-state-title">Belum ada data volume</p>
      <p v-if="data.length === 0" class="chart-state-description">
        Jalankan prediksi untuk kamera ini untuk melihat estimasi volume.
      </p>
      <p v-else class="chart-state-description">
        Tidak ada hasil {{ methodLabel }} pada {{ data.length }} data volume terbaru.
        <template v-if="otherMethods.length > 0"> Metode lain tersedia: {{ otherMethods.join(', ') }}.</template>
      </p>
    </div>

    <div v-else class="chart-body">
      <div class="chart-y-axis axis-labels" aria-hidden="true">
        <span
          v-for="tick in yTicks"
          :key="tick.top"
          class="chart-y-label"
          :style="{ top: `${tick.top}%` }"
        >
          {{ tick.label }}
        </span>
      </div>

      <div class="chart-main">
        <div class="chart-plot">
          <svg class="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.28" />
                <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0" />
              </linearGradient>
            </defs>

            <g class="grid-lines" stroke="var(--sheet-border)" stroke-width="0.5">
              <line v-for="tick in yTicks" :key="tick.top" x1="10" :y1="tick.top" x2="90" :y2="tick.top" />
              <line x1="10" y1="10" x2="10" y2="90" />
              <line x1="90" y1="10" x2="90" y2="90" />
            </g>

            <path :d="areaPath" fill="url(#area-gradient)" />
            <path
              :d="linePath"
              stroke="var(--chart-1)"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />

            <circle
              v-for="(value, index) in values"
              :key="`${filteredData[index]?.jobId}-${index}`"
              :cx="getX(index, values.length)"
              :cy="getY(value)"
              r="2.5"
              fill="var(--chart-1)"
              stroke="var(--sheet)"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            >
              <title>{{ labels[index] }}: {{ formatValue(value) }} {{ unitLabel }}</title>
            </circle>

            <circle
              v-if="latestValue !== undefined"
              class="latest-point"
              :cx="getX(values.length - 1, values.length)"
              :cy="getY(latestValue)"
              r="4.5"
              fill="var(--chart-1)"
              stroke="var(--sheet)"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div class="chart-x-axis axis-labels" aria-hidden="true">
          <span
            v-for="mark in xLabels"
            :key="mark.index"
            class="chart-x-label"
            :style="{ left: `${mark.x}%`, transform: mark.transform }"
          >
            {{ mark.label }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, ChartColumn } from '@lucide/vue'

interface VolumeDataPoint {
  jobId: string
  createdAt: string
  method: string
  volumeM3: number
  volumeLiter: number
}

const props = withDefaults(defineProps<{
  data: VolumeDataPoint[]
  selectedMethod?: 'grid' | 'convex_hull'
  unit?: 'm3' | 'liter'
  cameraName?: string
  maxPoints?: number
  loading?: boolean
  error?: string
}>(), {
  selectedMethod: 'grid',
  unit: 'm3',
  cameraName: '',
  maxPoints: 20,
  loading: false,
  error: '',
})

const emit = defineEmits<{
  retry: []
}>()

const filteredData = computed(() =>
  props.data
    .filter(point => point.method === props.selectedMethod)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-props.maxPoints),
)

const labels = computed(() =>
  filteredData.value.map(point => {
    const date = new Date(point.createdAt)
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(',', '')
  }),
)

const values = computed(() =>
  filteredData.value.map(point => props.unit === 'm3' ? point.volumeM3 : point.volumeLiter),
)

const unitLabel = computed(() => props.unit === 'm3' ? 'm³' : 'L')
const methodLabel = computed(() => props.selectedMethod === 'grid' ? 'Grid/Voxel' : 'Convex Hull')
const hasData = computed(() => filteredData.value.length > 0)
const showChart = computed(() => !props.loading && !props.error && hasData.value)

const otherMethods = computed(() =>
  Array.from(new Set(props.data.map(point => point.method)))
    .filter(method => method !== props.selectedMethod)
    .map(method => method === 'grid' ? 'Grid/Voxel' : method === 'convex_hull' ? 'Convex Hull' : method),
)

const minValue = computed(() => values.value.length > 0 ? Math.min(...values.value) : 0)
const maxValue = computed(() => values.value.length > 0 ? Math.max(...values.value) : 0)
const valueRange = computed(() => maxValue.value - minValue.value)
const latestValue = computed(() => values.value[values.value.length - 1])

const ariaLabel = computed(() =>
  `Chart volume ${methodLabel.value} (${unitLabel.value}) untuk ${props.cameraName || 'kamera terpilih'}, ${filteredData.value.length} analisis terbaru`,
)

function formatValue(value: number): string {
  return value.toFixed(props.unit === 'm3' ? 3 : 0)
}

const yTicks = computed(() => {
  const low = minValue.value
  const high = maxValue.value
  const span = valueRange.value
  return [
    { top: 10, label: formatValue(high) },
    { top: 30, label: formatValue(high - span * 0.25) },
    { top: 50, label: formatValue(low + span * 0.5) },
    { top: 70, label: formatValue(low + span * 0.75) },
    { top: 90, label: formatValue(low) },
  ]
})

const xLabels = computed(() => {
  const total = labels.value.length
  if (total === 0) return []

  const maxLabels = 5
  const indexes = new Set<number>()
  if (total <= maxLabels) {
    for (let index = 0; index < total; index += 1) indexes.add(index)
  } else {
    for (let step = 0; step < maxLabels; step += 1) {
      indexes.add(Math.round((step / (maxLabels - 1)) * (total - 1)))
    }
  }

  return Array.from(indexes)
    .sort((a, b) => a - b)
    .map(index => ({
      index,
      label: labels.value[index] ?? '',
      x: getX(index, total),
      transform: index === 0 ? 'translateX(0)' : index === total - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
    }))
})

function getX(index: number, total: number): number {
  if (total <= 1) return 50
  const padding = 10
  const width = 100 - padding * 2
  return padding + (index / (total - 1)) * width
}

function getY(value: number): number {
  if (valueRange.value === 0) return 50
  const padding = 10
  const height = 80
  const normalized = (value - minValue.value) / valueRange.value
  return padding + height - normalized * height
}

const points = computed(() =>
  values.value.map((value, index) => `${getX(index, values.value.length)},${getY(value)}`),
)

const linePath = computed(() => {
  if (!hasData.value) return ''
  return `M ${points.value.join(' L ')}`
})

const areaPath = computed(() => {
  if (!hasData.value) return ''
  const firstX = getX(0, values.value.length)
  const lastX = getX(values.value.length - 1, values.value.length)
  return `M ${firstX},90 L ${points.value.join(' L ')} L ${lastX},90 Z`
})
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
  height: 300px;
  overflow: hidden;
  border: 1px solid var(--sheet-border);
  border-radius: var(--radius-card);
  background: var(--sheet);
  padding: 16px;
}

.chart-body {
  display: flex;
  height: 100%;
}

.chart-y-axis {
  position: relative;
  flex: 0 0 3.25rem;
  margin: 0 6px 1.5rem 0;
}

.chart-y-label {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  font-size: 11px;
  line-height: 1;
  color: var(--text-muted);
}

.chart-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.chart-plot {
  min-height: 0;
  flex: 1;
}

.chart-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.grid-lines {
  stroke-dasharray: 3 3;
}

.axis-labels {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.chart-x-axis {
  position: relative;
  height: 1.5rem;
  overflow: hidden;
}

.chart-x-label {
  position: absolute;
  top: 4px;
  white-space: nowrap;
  font-size: 10px;
  line-height: 1;
  color: var(--text-muted);
}

.latest-point {
  filter: drop-shadow(0 0 0.25rem color-mix(in srgb, var(--chart-1) 45%, transparent));
}

.chart-state {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
}

.chart-state-title {
  margin-top: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}

.chart-state-description {
  max-width: 22rem;
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .chart-container {
    height: 260px;
    padding: 12px;
  }

  .chart-x-label {
    display: none;
  }

  .chart-x-label:first-child,
  .chart-x-label:last-child {
    display: block;
  }
}
</style>
