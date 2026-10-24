<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { useObjectUrl } from '@/composables/useObjectUrl'
import { createDepthScaleForm, depthScaleFormErrors, depthScalePayload } from '@/lib/depth-scale-form'
import { normalizeApiError } from '@/services/api'
import type { DepthScaleContext } from '@/services/depthScales'
import { createDepthScale, depthScaleContextKey, fetchDepthScaleImageBlob, getDepthScaleContext, uploadDepthScaleImage } from '@/services/depthScales'
import type { DepthScale, DepthScaleImageResponse } from '@/types'
import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import DepthMeasurementEditor from './DepthMeasurementEditor.vue'

const props = defineProps<{ cameraId: string; context: DepthScaleContext }>()
const emit = defineEmits<{ created: [scale: DepthScale]; busy: [value: boolean]; changed: []; uncertain: []; reconcile: []; close: [] }>()
const form = reactive(createDepthScaleForm())
const image = ref<DepthScaleImageResponse | null>(null)
const { url, replace, clear } = useObjectUrl()
const isActive = useConnectionScope()
const controller = new AbortController()
const uploading = ref(false)
const computing = ref(false)
const previewLoading = ref(false)
const previewReady = ref(false)
const error = ref('')
const uncertain = ref(false)
const busy = computed(() => uploading.value || computing.value || previewLoading.value)
const validation = computed(() => image.value ? depthScaleFormErrors(form, image.value.width, image.value.height) : [])
// test_image is optional - backend defaults to first calibration image
// canSubmit no longer requires uploaded image; only needs valid points and no errors
const canSubmit = computed(() => !busy.value && !uncertain.value && validation.value.length === 0 && form.points.length >= 3)
const modern = computed(() => props.context.calibration.k_original !== null && !!props.context.calibration.resolution_w && !!props.context.calibration.resolution_h)

watch(busy, value => emit('busy', value))
onScopeDispose(() => { controller.abort(); emit('busy', false) })

async function verifyContext() {
  const latest = await getDepthScaleContext(props.cameraId, controller.signal)
  if (!isActive() || controller.signal.aborted) throw { status: null, message: 'Konteks tidak lagi aktif.', cancelled: true }
  if (depthScaleContextKey(latest) !== depthScaleContextKey(props.context)) {
    emit('changed')
    throw { status: 409, code: 'depth_scale_prerequisites_changed', message: 'Konfigurasi aktif berubah. Unggah ulang gambar pada konteks terbaru.' }
  }
}

function showError(cause: unknown, mutationSent = false) {
  if (!isActive() || controller.signal.aborted) return
  const apiError = normalizeApiError(cause)
  if (apiError.code === 'depth_scale_prerequisites_changed') emit('changed')
  if (mutationSent && (apiError.status === null || apiError.code === 'depth_scale_persistence_unavailable')) {
    uncertain.value = true
    error.value = 'Hasil belum dapat dipastikan. Putusnya koneksi tidak membatalkan pekerjaan backend. Periksa daftar dan skala aktif sebelum membuat permintaan baru.'
    emit('uncertain')
  } else error.value = apiError.message
}

async function loadPreview() {
  if (!image.value || busy.value) return
  previewLoading.value = true
  previewReady.value = false
  error.value = ''
  clear()
  try {
    const blob = await fetchDepthScaleImageBlob(props.cameraId, props.context.groundModel.id, image.value, controller.signal)
    if (isActive() && !controller.signal.aborted) replace(blob)
  } catch (cause) { showError(cause) }
  finally { if (isActive()) previewLoading.value = false }
}

async function upload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || busy.value || uncertain.value) return
  clear()
  image.value = null
  previewReady.value = false
  form.points = []
  error.value = ''
  uploading.value = true
  try {
    await verifyContext()
    const uploaded = await uploadDepthScaleImage(props.cameraId, props.context.groundModel.id, file, controller.signal)
    if (!isActive() || controller.signal.aborted) return
    image.value = uploaded
    const blob = await fetchDepthScaleImageBlob(props.cameraId, props.context.groundModel.id, uploaded, controller.signal)
    if (isActive() && !controller.signal.aborted) replace(blob)
  } catch (cause) { showError(cause) }
  finally { if (isActive()) uploading.value = false }
}

async function submit() {
  if (!canSubmit.value) return
  const payload = depthScalePayload(form, image.value?.width ?? 0, image.value?.height ?? 0)
  computing.value = true
  error.value = ''
  let sent = false
  try {
    await verifyContext()
    sent = true
    const scale = await createDepthScale(props.cameraId, props.context.groundModel.id, payload, controller.signal)
    if (!isActive() || controller.signal.aborted) return
    if (scale.camera_id !== props.cameraId || scale.ground_model_id !== props.context.groundModel.id || !scale.is_active) {
      throw { status: null, message: 'Respons hasil tidak sesuai konteks aktif.' }
    }
    emit('created', scale)
  } catch (cause) { showError(cause, sent) }
  finally { if (isActive()) computing.value = false }
}
</script>

<template>
  <form class="min-w-0 space-y-6 rounded-lg border p-4 sm:p-6" aria-labelledby="depth-form-title"
    @submit.prevent="submit">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="depth-form-title" class="text-lg font-semibold">Buat Skala Kedalaman</h2>
      <Button type="button" variant="ghost" :disabled="busy" @click="emit('close')">Tutup Formulir</Button>
    </div>
    <p class="text-sm text-muted-foreground">Perhitungan ini langsung mengaktifkan fit yang lolos, menggantikan skala
      aktif untuk model ground ini. Tidak ada job yang perlu dipolling.</p>

    <div class="grid min-w-0 gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <Label for="depth-image">Gambar Pengukuran (opsional)</Label>
        <Input id="depth-image" type="file" accept="image/jpeg,image/png,image/bmp,.jpg,.jpeg,.png,.bmp"
          :disabled="busy || uncertain" aria-describedby="depth-image-help" @change="upload" />
        <p id="depth-image-help" class="text-sm text-muted-foreground">
          {{
            modern
              ?
              `Opsional. Default: gambar kalibrasi pertama. Jika diunggah, gunakan gambar raw pada dimensi
          kalibrasi ${context.calibration.resolution_w} x ${context.calibration.resolution_h} pixel. Backend melakukan
          undistortion.`
              :
              'Opsional. Default: gambar kalibrasi pertama.'
          }}
        </p>
      </div>
      <div class="space-y-2">
        <Label for="depth-model">File Model Depth (opsional)</Label>
        <Input id="depth-model" :disabled="busy || uncertain" maxlength="200"
          placeholder="yolo26n-depth.pt (default backend)" aria-describedby="depth-model-help" />
        <p id="depth-model-help" class="text-sm text-muted-foreground">Opsional. Default: yolo26n-depth.pt. Nama file
          .pt yang sudah terpasang di backend. Ketersediaannya diperiksa backend.</p>
      </div>
    </div>

    <p v-if="uploading || previewLoading" role="status" class="text-sm text-muted-foreground">
      {{ uploading
        ? 'Mengunggah gambar dan menyiapkan preview...'
        : 'Memuat preview undistorted...'
      }}
    </p>
    <div v-if="image" class="space-y-3">
      <DepthMeasurementEditor v-if="url" v-model="form.points" :url="url" :width="image.width" :height="image.height"
        :disabled="busy || uncertain" @ready="previewReady = $event" />
      <Button v-if="!previewReady && !busy" type="button" variant="outline" :disabled="uncertain"
        @click="loadPreview">Muat Ulang Preview</Button>
    </div>

    <!-- <div class="grid gap-4 sm:max-w-lg sm:grid-cols-2">
      <div class="space-y-2">
        <Label for="depth-clip-min">Batas Minimum (m) — opsional</Label>
        <Input id="depth-clip-min" v-model="form.clip_min_m" inputmode="decimal" :disabled="busy || uncertain" placeholder="0.1 (default)" />
      </div>
      <div class="space-y-2">
        <Label for="depth-clip-max">Batas Maksimum (m) — opsional</Label>
        <Input id="depth-clip-max" v-model="form.clip_max_m" inputmode="decimal" :disabled="busy || uncertain" placeholder="50 (default)" />
      </div>
    </div> -->

    <ul v-if="validation.length && image && previewReady" class="space-y-1 text-sm text-muted-foreground"
      aria-label="Validasi pengukuran">
      <li v-for="message in validation" :key="message">{{ message }}</li>
    </ul>
    <div v-if="error" role="alert" class="space-y-3 rounded-md border border-destructive/40 p-3">
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button v-if="uncertain" type="button" variant="outline" @click="emit('reconcile')">Periksa Hasil</Button>
    </div>
    <div class="flex flex-wrap items-center gap-3 border-t pt-4">
      <Button type="submit" :disabled="!canSubmit" :aria-busy="computing">
        {{
          computing
            ? 'Menghitung Skala...'
            : 'Hitung dan Aktifkan'
        }}
      </Button>
      <p v-if="computing" role="status" class="text-sm text-muted-foreground">Menunggu fit backend. Jangan kirim
        permintaan kedua.</p>
      <p v-else-if="form.points.length < 3" class="text-sm text-muted-foreground">Minimal 3 titik pengukuran untuk
        menghitung skala.</p>
    </div>
  </form>
</template>
