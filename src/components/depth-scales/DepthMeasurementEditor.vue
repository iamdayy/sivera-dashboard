<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { displayedPixel } from '@/lib/depth-scale-form'
import type { MeasurementInput } from '@/lib/depth-scale-form'

const props = defineProps<{ url: string; width: number; height: number; disabled: boolean }>()
const points = defineModel<MeasurementInput[]>({ required: true })
const emit = defineEmits<{ ready: [value: boolean] }>()
const imageRef = ref<HTMLImageElement | null>(null)
const rowsRef = ref<HTMLElement | null>(null)
const ready = ref(false)
const imageError = ref('')
const notice = ref('')
let nextId = 0
const locked = computed(() => props.disabled || !ready.value)
const markers = computed(() => points.value.filter(point => point.x.trim() && point.y.trim() &&
  Number.isInteger(Number(point.x)) && Number.isInteger(Number(point.y)) &&
  Number(point.x) >= 0 && Number(point.x) < props.width && Number(point.y) >= 0 && Number(point.y) < props.height))

watch(() => props.url, () => {
  ready.value = false
  imageError.value = ''
  emit('ready', false)
})

function loaded() {
  const image = imageRef.value
  ready.value = image?.naturalWidth === props.width && image?.naturalHeight === props.height
  imageError.value = ready.value ? '' : 'Dimensi preview berbeda dari respons backend. Unggah ulang gambar sebelum memilih titik.'
  emit('ready', ready.value)
}

function failed() {
  ready.value = false
  imageError.value = 'Preview tidak dapat ditampilkan. Muat ulang preview sebelum memilih titik.'
  emit('ready', false)
}

function add(x = '', y = '') {
  if (locked.value || points.value.length >= 100) return
  points.value.push({ id: nextId++, x, y, distance_m: '' })
  notice.value = `Titik ${points.value.length} ditambahkan. Isi kedalaman Z hasil pengukuran.`
}

function pick(event: MouseEvent) {
  if (locked.value || !imageRef.value) return
  const pixel = displayedPixel(event.clientX, event.clientY, imageRef.value.getBoundingClientRect(), props.width, props.height)
  if (!pixel) return
  if (points.value.some(point => point.x.trim() && point.y.trim() && Number(point.x) === pixel.x && Number(point.y) === pixel.y)) {
    notice.value = 'Pixel ini sudah dipilih. Gunakan pixel berbeda.'
    return
  }
  add(String(pixel.x), String(pixel.y))
}

async function addManual() {
  add()
  await nextTick()
  rowsRef.value?.querySelector<HTMLInputElement>('fieldset:last-child input')?.focus()
}
</script>

<template>
  <div class="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
    <section class="min-w-0 space-y-3" aria-labelledby="depth-preview-title">
      <h3 id="depth-preview-title" class="text-base font-semibold">Preview undistorted</h3>
      <p class="text-sm text-muted-foreground">{{ width }} × {{ height }} pixel. Klik atau tap gambar, atau tambah koordinat secara manual.</p>
      <div class="relative overflow-hidden rounded-md border bg-muted">
        <img ref="imageRef" :src="url" alt="Preview undistorted untuk titik pengukuran kedalaman" class="block h-auto w-full select-none" :class="{ 'cursor-crosshair': !locked }" draggable="false" @load="loaded" @error="failed" @click="pick" />
        <span v-for="point in markers" :key="point.id" class="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brand text-xs font-semibold text-white" :style="{ left: `${Number(point.x) / width * 100}%`, top: `${Number(point.y) / height * 100}%` }" aria-hidden="true">
          {{ points.indexOf(point) + 1 }}
        </span>
      </div>
      <p v-if="imageError" role="alert" class="text-sm text-destructive">{{ imageError }}</p>
      <p v-else-if="!ready" role="status" class="text-sm text-muted-foreground">Memuat preview gambar...</p>
      <p class="text-sm text-muted-foreground">Koordinat berasal dari pixel preview, bukan ukuran tampilan layar.</p>
    </section>

    <section class="min-w-0 space-y-4" aria-labelledby="depth-points-title">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 id="depth-points-title" class="text-base font-semibold">Pengukuran ({{ points.length }}/100)</h3>
        <Button type="button" variant="outline" :disabled="locked || points.length >= 100" @click="addManual">Tambah Titik Manual</Button>
      </div>
      <p id="depth-measurement-help" class="text-sm text-muted-foreground">Minimal 3 pixel berbeda dengan kedalaman yang bervariasi. Kedalaman Z pada sumbu kamera (m), bukan jarak miring rangefinder.</p>
      <p v-if="!points.length" class="rounded-md border p-4 text-sm text-muted-foreground">Belum ada titik. Pilih pixel pada gambar atau gunakan Tambah Titik Manual.</p>
      <div ref="rowsRef" class="space-y-4">
        <fieldset v-for="(point, index) in points" :key="point.id" :disabled="locked" class="min-w-0 rounded-md border p-3">
          <legend class="px-1 text-sm font-medium">Titik {{ index + 1 }}</legend>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label :for="`depth-x-${point.id}`">X (pixel)</Label>
              <Input :id="`depth-x-${point.id}`" v-model="point.x" inputmode="numeric" autocomplete="off" :aria-label="`X titik ${index + 1} (pixel)`" aria-describedby="depth-measurement-help" />
            </div>
            <div class="space-y-2">
              <Label :for="`depth-y-${point.id}`">Y (pixel)</Label>
              <Input :id="`depth-y-${point.id}`" v-model="point.y" inputmode="numeric" autocomplete="off" :aria-label="`Y titik ${index + 1} (pixel)`" aria-describedby="depth-measurement-help" />
            </div>
            <div class="space-y-2">
              <Label :for="`depth-z-${point.id}`">Kedalaman Z (m)</Label>
              <Input :id="`depth-z-${point.id}`" v-model="point.distance_m" inputmode="decimal" autocomplete="off" :aria-label="`Kedalaman Z titik ${index + 1} (m)`" aria-describedby="depth-measurement-help" />
            </div>
            <Button type="button" variant="ghost" class="self-end" :disabled="locked" :aria-label="`Hapus titik ${index + 1}`" @click="points.splice(index, 1)">Hapus Titik</Button>
          </div>
        </fieldset>
      </div>
      <p role="status" class="text-sm text-muted-foreground">{{ notice }}</p>
    </section>
  </div>
</template>
