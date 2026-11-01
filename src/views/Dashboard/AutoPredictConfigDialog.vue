<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AutoPredictConfig, AutoPredictConfigUpdate } from '@/types'

interface Props {
  cameraId: string
  initialConfig: AutoPredictConfig
  onUpdate: (config: AutoPredictConfig) => Promise<void>
  onClose: () => void
}

const props = defineProps<Props>()

const isOpen = ref(false)
const saving = ref(false)
const saveError = ref('')

const form = ref<AutoPredictConfigUpdate>({
  enabled: props.initialConfig.enabled,
  interval_sec: props.initialConfig.interval_sec,
  source_type: props.initialConfig.source_type,
  seg_model: props.initialConfig.seg_model,
  seg_conf: props.initialConfig.seg_conf,
  seg_classes: props.initialConfig.seg_classes,
  volume_cell_m: props.initialConfig.volume_cell_m,
  volume_min_pts_per_cell: props.initialConfig.volume_min_pts_per_cell,
  return_outputs: props.initialConfig.return_outputs,
  max_frame_age_sec: props.initialConfig.max_frame_age_sec,
})

const sourceTypes = [
  { value: 'latest_rtsp', label: 'Latest RTSP (persisted snapshot)' },
  { value: 'rtsp_frame', label: 'RTSP Frame (live capture)' },
  { value: 'upload', label: 'Upload (manual)' },
] as const

const outputOptions = [
  { value: 'mask', label: 'Mask' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'bev_overlay', label: 'BEV Overlay' },
  { value: 'volume_heatmap', label: 'Volume Heatmap' },
  { value: 'bev_image', label: 'BEV Image' },
  { value: 'bev_mask_proyeksi', label: 'BEV Mask Proyeksi' },
  { value: 'depth_raw_vis', label: 'Depth Raw Visualization' },
  { value: 'depth_scaled_vis', label: 'Depth Scaled Visualization' },
  { value: 'depth_masked', label: 'Depth Masked' },
  { value: 'height_map', label: 'Height Map' },
] as const

watch(() => props.initialConfig, (newConfig) => {
  form.value = { ...newConfig }
})

function open() {
  form.value = { ...props.initialConfig }
  saveError.value = ''
  isOpen.value = true
}

async function save() {
  saving.value = true
  saveError.value = ''
  try {
    await props.onUpdate(form.value as AutoPredictConfig)
  } catch (error: unknown) {
    if (error instanceof Error) {
      saveError.value = error.message
    } else {
      saveError.value = 'Gagal menyimpan konfigurasi'
    }
    return
  } finally {
    saving.value = false
  }
  isOpen.value = false
}

function close() {
  isOpen.value = false
  props.onClose()
}
</script>

<template>
  <Dialog v-model:open="isOpen" :show-close-button="!saving" :disabled="saving" content-class="max-w-2xl">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Konfigurasi Auto-Prediksi</DialogTitle>
        <DialogDescription>Atur jadwal dan parameter inferensi otomatis untuk kamera ini.</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="save">
        <div class="space-y-2">
          <Label for="auto-predict-enabled">Aktifkan Auto-Prediksi</Label>
          <div class="flex items-center gap-3">
            <input
              id="auto-predict-enabled"
              type="checkbox"
              v-model="form.enabled"
              class="checkbox"
            />
            <span class="text-sm text-text-muted">
              Saat aktif, sistem akan menjalankan inferensi otomatis setiap interval
              jika prasyarat (kalibrasi, ground model, depth scale) terpenuhi.
            </span>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="interval-sec">Interval (detik)</Label>
          <Input
            id="interval-sec"
            type="number"
            v-model="form.interval_sec"
            :min="5"
            :max="3600"
            step="5"
            class="input"
            :disabled="!form.enabled"
          />
          <p class="text-xs text-text-muted">Minimum 5 detik, maksimum 1 jam.</p>
        </div>

        <div class="space-y-2">
          <Label for="source-type">Sumber Gambar</Label>
          <select
            id="source-type"
            v-model="form.source_type"
            class="input"
            :disabled="!form.enabled"
          >
            <option v-for="opt in sourceTypes" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          <div class="space-y-2">
            <Label for="seg-model">Model Segmentasi</Label>
            <Input
              id="seg-model"
              v-model="form.seg_model"
              class="input"
              :disabled="!form.enabled"
            />
          </div>
          <div class="space-y-2">
            <Label for="seg-conf">Confidence Threshold</Label>
            <Input
              id="seg-conf"
              type="number"
              v-model="form.seg_conf"
              :min="0"
              :max="1"
              :step="0.05"
              class="input"
              :disabled="!form.enabled"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          <div class="space-y-2">
            <Label for="volume-cell-m">Ukuran Sel Volume (meter)</Label>
            <Input
              id="volume-cell-m"
              type="number"
              v-model="form.volume_cell_m"
              :min="0.01"
              :max="1"
              :step="0.01"
              class="input"
              :disabled="!form.enabled"
            />
          </div>
          <div class="space-y-2">
            <Label for="volume-min-pts">Min Titik per Sel</Label>
            <Input
              id="volume-min-pts"
              type="number"
              v-model="form.volume_min_pts_per_cell"
              :min="1"
              :max="10000"
              :step="1"
              class="input"
              :disabled="!form.enabled"
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="max-frame-age">Maks Umur Frame (detik)</Label>
          <Input
            id="max-frame-age"
            type="number"
            v-model="form.max_frame_age_sec"
            :min="1"
            :max="300"
            :step="1"
            class="input"
            :disabled="!form.enabled"
          />
          <p class="text-xs text-text-muted">Frame lebih tua dari ini akan ditolak.</p>
        </div>

        <div class="space-y-2">
          <Label>Output yang Dihasilkan</Label>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="opt in outputOptions"
              :key="opt.value"
              class="flex items-center gap-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                :value="opt.value"
                v-model="form.return_outputs"
                class="checkbox"
                :disabled="!form.enabled"
              />
              <span class="text-sm">{{ opt.label }}</span>
            </label>
          </div>
        </div>

        <div v-if="saveError" class="error-state" role="alert">
          <AlertCircle class="w-5 h-5" aria-hidden="true" />
          <p class="font-medium text-text">Gagal menyimpan</p>
          <p class="text-sm text-text-muted">{{ saveError }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" :disabled="saving" @click="close">Batal</Button>
          <Button type="submit" :disabled="saving" :aria-busy="saving" variant="primary">
            {{ saving ? 'Menyimpan...' : 'Simpan Konfigurasi' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>