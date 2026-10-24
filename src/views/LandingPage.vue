<template>
  <div class="flex min-h-screen flex-col bg-white">
    <a
      href="#konten-utama"
      class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:border focus:border-sheet-border focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-medium"
    >
      Lewati ke konten
    </a>

    <header class="sticky top-0 z-40 border-b border-sheet-border bg-white">
      <nav
        class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
        aria-label="Navigasi utama"
      >
        <RouterLink
          to="/"
          class="flex min-h-11 items-center gap-2 rounded-md text-text"
          aria-label="Sivera, beranda"
        >
          <svg class="h-8 w-8 text-brand" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="currentColor" />
            <path d="M8 16L14 22L24 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="hidden text-lg font-semibold sm:inline">Sivera</span>
        </RouterLink>

        <div class="flex items-center gap-1 sm:gap-2">
          <a
            href="#alur-kerja"
            class="hidden min-h-11 items-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors hover:text-text md:flex"
          >
            Alur kerja
          </a>
          <a
            href="#tentang"
            class="hidden min-h-11 items-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors hover:text-text md:flex"
          >
            Tentang
          </a>
          <RouterLink
            to="/dashboard"
            class="btn btn-primary btn-sm min-h-11 whitespace-nowrap px-3 sm:px-4"
            aria-label="Buka Dashboard"
          >
            <span class="hidden sm:inline">Buka Dashboard</span>
            <span class="sm:hidden">Dashboard</span>
          </RouterLink>
        </div>
      </nav>
    </header>

    <main id="konten-utama" class="flex-1">
      <section class="px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
        <div class="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12 lg:items-start lg:gap-10">
          <div class="lg:col-span-5">
            <h1 class="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-text sm:text-5xl">
              Estimasi sampah dari kamera
            </h1>
            <p class="mt-6 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
              Sivera membaca gambar kamera CCTV, mengangkat titik ke bidang tanah, lalu menghitung estimasi
              volume tumpukan sampah. Hasilnya tersimpan sebagai job yang dapat ditinjau kembali.
            </p>

            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <RouterLink to="/dashboard" class="btn btn-primary min-h-11 px-5">
                Buka Dashboard
              </RouterLink>
              <a href="#alur-kerja" class="btn btn-outline min-h-11 px-5">
                Lihat alur kerja
              </a>
            </div>

            <dl class="mt-10 grid gap-4 border-t border-sheet-border pt-6 sm:grid-cols-3">
              <div>
                <dt class="text-xs font-medium text-text-muted">Input</dt>
                <dd class="mt-1 text-sm text-text">Gambar kamera</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-text-muted">Prasyarat</dt>
                <dd class="mt-1 text-sm text-text">Kalibrasi dan model ground</dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-text-muted">Keluaran</dt>
                <dd class="mt-1 text-sm text-text">Volume m³ dan liter</dd>
              </div>
            </dl>
          </div>

          <div class="lg:col-span-6 lg:col-start-7">
            <div class="rounded-xl border border-frame-border bg-frame p-4 sm:p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="text-base font-semibold text-text">Urutan konfigurasi</h2>
                  <p class="mt-1 text-sm text-text-muted">Pilih langkah untuk melihat input, syarat, dan keluarannya.</p>
                </div>
                <span class="shrink-0 rounded-md border border-frame-border bg-white px-2 py-1 font-mono text-xs text-text-muted">
                  01 / 04
                </span>
              </div>

              <div class="mt-5 space-y-1" role="tablist" aria-label="Langkah konfigurasi">
                <button
                  v-for="(step, index) in steps"
                  :id="`langkah-tab-${step.id}`"
                  :key="step.id"
                  type="button"
                  role="tab"
                  :aria-selected="index === activeStep"
                  :aria-controls="`langkah-panel-${step.id}`"
                  :tabindex="index === activeStep ? 0 : -1"
                  class="flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
                  :class="index === activeStep
                    ? 'border-brand/30 bg-white text-text'
                    : 'border-transparent text-text-muted hover:bg-white/70 hover:text-text'"
                  @click="selectStep(index)"
                  @keydown="onTabKeydown($event, index)"
                >
                  <span class="font-mono text-xs tabular-nums">{{ String(index + 1).padStart(2, '0') }}</span>
                  <span class="text-sm font-medium">{{ step.title }}</span>
                </button>
              </div>

              <div
                :id="`langkah-panel-${activeStepData.id}`"
                class="mt-4 border-t border-frame-border pt-4"
                role="tabpanel"
                :aria-labelledby="`langkah-tab-${activeStepData.id}`"
                tabindex="0"
              >
                <dl class="space-y-3 text-sm">
                  <div>
                    <dt class="font-medium text-text-muted">Input</dt>
                    <dd class="mt-0.5 text-text">{{ activeStepData.input }}</dd>
                  </div>
                  <div>
                    <dt class="font-medium text-text-muted">Syarat</dt>
                    <dd class="mt-0.5 text-text">{{ activeStepData.requirement }}</dd>
                  </div>
                  <div>
                    <dt class="font-medium text-text-muted">Keluaran</dt>
                    <dd class="mt-0.5 text-text">{{ activeStepData.output }}</dd>
                  </div>
                </dl>
                <RouterLink
                  :to="activeStepData.to"
                  class="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline"
                >
                  Buka {{ activeStepData.linkLabel }}
                </RouterLink>
              </div>

              <p class="mt-4 text-xs leading-relaxed text-text-muted">
                Panel ini menjelaskan urutan konfigurasi, bukan status kamera Anda. Status nyata tampil di
                dashboard setelah API diatur.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="alur-kerja"
        class="scroll-mt-20 border-t border-sheet-border bg-frame px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      >
        <div class="mx-auto max-w-7xl">
          <div class="max-w-2xl">
            <h2 class="text-3xl font-semibold tracking-tight text-text sm:text-4xl">Alur kerja</h2>
            <p class="mt-4 text-base leading-relaxed text-text-muted sm:text-lg">
              Setiap langkah bergantung pada hasil langkah sebelumnya. Melewati satu langkah membuat analisis
              tidak dapat dijalankan.
            </p>
          </div>

          <ol class="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            <li v-for="(step, index) in steps" :key="step.id" class="border-t border-frame-border pt-5">
              <div class="flex items-baseline gap-4">
                <span class="font-mono text-sm tabular-nums text-text-muted">{{ String(index + 1).padStart(2, '0') }}</span>
                <div class="min-w-0">
                  <h3 class="text-lg font-semibold text-text">{{ step.title }}</h3>
                  <p class="mt-2 text-sm leading-relaxed text-text-muted">{{ step.description }}</p>
                  <p class="mt-2 text-sm leading-relaxed text-text-muted">
                    <span class="font-medium text-text">Syarat:</span> {{ step.requirement }}
                  </p>
                  <RouterLink
                    :to="step.to"
                    class="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Buka {{ step.linkLabel }}
                  </RouterLink>
                </div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="tentang" class="scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div class="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12">
          <div class="lg:col-span-4">
            <h2 class="text-3xl font-semibold tracking-tight text-text sm:text-4xl">Tentang SIVERA</h2>
            <p class="mt-4 text-base leading-relaxed text-text-muted">
              Dashboard ini adalah antarmuka operasional. Perhitungan computer vision berjalan di backend
              terpisah dan diakses lewat HTTP.
            </p>
          </div>

          <div class="space-y-10 lg:col-span-7 lg:col-start-6">
            <section>
              <h3 class="text-lg font-semibold text-text">Yang dihasilkan</h3>
              <p class="mt-2 text-sm leading-relaxed text-text-muted">
                Satu job prediksi dapat mengembalikan beberapa artefak berikut.
              </p>
              <ul class="mt-3 space-y-2 text-sm leading-relaxed text-text">
                <li>Mask segmentasi sampah dan overlay pada gambar asli.</li>
                <li>Peta kedalaman relatif serta visualisasi kedalaman terskala.</li>
                <li>Proyeksi Bird's Eye View dari titik yang diangkat ke bidang tanah.</li>
                <li>Estimasi volume dengan metode grid/voxel dan convex hull, dalam m³ dan liter.</li>
              </ul>
            </section>

            <section class="border-t border-sheet-border pt-8">
              <h3 class="text-lg font-semibold text-text">Prasyarat analisis</h3>
              <ul class="mt-3 space-y-2 text-sm leading-relaxed text-text">
                <li>Kalibrasi kamera aktif dengan parameter intrinsik terverifikasi.</li>
                <li>Referensi tanah aktif dengan minimal empat pasangan titik gambar dan dunia.</li>
                <li>
                  Skala kedalaman yang tersedia dan dapat diperiksa melalui API.
                </li>
              </ul>
            </section>

            <section class="border-t border-sheet-border pt-8">
              <h3 class="text-lg font-semibold text-text">Metode estimasi volume</h3>
              <div class="mt-3 space-y-3 text-sm leading-relaxed text-text-muted">
                <p>
                  <span class="font-medium text-text">Grid/Voxel</span> membagi area menjadi sel 3D dan
                  menghitung titik per sel. Nilai awal 0,05 m dengan minimal dua titik per sel.
                </p>
                <p>
                  <span class="font-medium text-text">Convex Hull</span> membungkus titik terangkat dengan
                  cangkang konveks. Pilih metode yang sesuai karakteristik tumpukan yang diamati.
                </p>
              </div>
            </section>

            <section class="border-t border-sheet-border pt-8">
              <h3 class="text-lg font-semibold text-text">Batasan yang perlu diketahui</h3>
              <ul class="mt-3 space-y-2 text-sm leading-relaxed text-text">
                <li>Kedalaman bersifat relatif sampai diskalakan oleh model ground.</li>
                <li>BEV adalah proyeksi 2D, bukan rekonstruksi 3D penuh.</li>
                <li>
                  Backend menyediakan sumber frame RTSP, tetapi alur tangkapan dan prediksi RTSP belum
                  terintegrasi di dashboard ini.
                </li>
                <li>
                  Artefak hanya ditampilkan dari URL yang dikembalikan API, bukan dari path yang ditebak.
                </li>
              </ul>
            </section>

            <section class="border-t border-sheet-border pt-8">
              <h3 class="text-lg font-semibold text-text">Keamanan dan arsitektur</h3>
              <p class="mt-2 text-sm leading-relaxed text-text-muted">
                Frontend ini terpisah dari backend. Setiap permintaan memakai header
                <code class="rounded bg-frame px-1 font-mono text-xs">X-API-Key</code>. Variabel
                <code class="rounded bg-frame px-1 font-mono text-xs">VITE_API_BASE_URL</code> hanya berisi
                origin backend, sedangkan prefix <code class="rounded bg-frame px-1 font-mono text-xs">/api/v1/cameras</code>
                diterapkan satu kali di kode. API key produksi tidak disimpan di bundle browser.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-sheet-border bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div class="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p class="font-semibold text-text">Sivera Dashboard</p>
          <p class="mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
            Antarmuka untuk mengelola kamera, kalibrasi, referensi tanah, dan analisis volume sampah.
          </p>
        </div>
        <nav aria-label="Tautan produk">
          <p class="text-sm font-semibold text-text">Tautan</p>
          <ul class="mt-2 space-y-1 text-sm text-text-muted">
            <li><RouterLink to="/dashboard" class="inline-flex min-h-11 items-center hover:text-text">Dashboard</RouterLink></li>
            <li><a href="#alur-kerja" class="inline-flex min-h-11 items-center hover:text-text">Alur kerja</a></li>
            <li>
              <a
                href="https://github.com/iamdayy/sivera"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center hover:text-text"
              >
                Backend di GitHub
                <span class="sr-only">(membuka tab baru)</span>
              </a>
            </li>
          </ul>
        </nav>
        <div class="text-sm text-text-muted sm:text-right">
          <p>Versi {{ appVersion }}</p>
          <p class="mt-2">&copy; {{ currentYear }} Sivera</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { version as appVersion } from '../../package.json'

interface WorkflowStep {
  id: string
  title: string
  description: string
  input: string
  requirement: string
  output: string
  to: string
  linkLabel: string
}

const steps: WorkflowStep[] = [
  {
    id: 'kamera',
    title: 'Kamera',
    description: 'Daftarkan kamera CCTV beserta resolusi dan FPS yang diketahui.',
    input: 'Identitas kamera dan alamat stream bila tersedia.',
    requirement: 'Resolusi dan FPS sesuai gambar yang akan dianalisis.',
    output: 'Kamera tersimpan di backend dan siap dikalibrasi.',
    to: '/dashboard/cameras',
    linkLabel: 'Manajemen Kamera',
  },
  {
    id: 'kalibrasi',
    title: 'Kalibrasi',
    description: 'Hitung parameter intrinsik kamera dari beberapa gambar papan catur.',
    input: 'Minimal 10 gambar papan catur dari sudut yang berbeda.',
    requirement: '15 sampai 30 gambar disarankan. Versi terbaik perlu diaktifkan.',
    output: 'Matriks intrinsik dan galat reproyeksi untuk analisis.',
    to: '/dashboard/calibrations',
    linkLabel: 'Kalibrasi',
  },
  {
    id: 'referensi-tanah',
    title: 'Referensi tanah',
    description: 'Hubungkan koordinat gambar dengan koordinat dunia memakai titik kontrol.',
    input: 'Minimal empat pasangan titik gambar dan dunia.',
    requirement: 'Satuan dunia ditetapkan, misalnya meter.',
    output: 'Model ground untuk mengangkat titik ke bidang tanah.',
    to: '/dashboard/ground-references',
    linkLabel: 'Referensi Tanah',
  },
  {
    id: 'analisis',
    title: 'Analisis',
    description: 'Kirim gambar, pantau job, lalu tinjau artefak dan estimasi volume.',
    input: 'Gambar dari kamera dan opsi inferensi.',
    requirement: 'Kalibrasi aktif dan model ground aktif. Depth scale belum dapat diverifikasi lewat API.',
    output: 'Job dengan status, artefak, instance, dan volume per metode.',
    to: '/dashboard/predictions',
    linkLabel: 'Analisis Sampah',
  },
]

const activeStep = ref(0)
const activeStepData = computed(() => steps[activeStep.value]!)
const currentYear = new Date().getFullYear()

function selectStep(index: number, moveFocus = false) {
  activeStep.value = index
  if (!moveFocus) return
  nextTick(() => {
    document.getElementById(`langkah-tab-${steps[index]!.id}`)?.focus()
  })
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()

  let next = index
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % steps.length
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + steps.length) % steps.length
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = steps.length - 1
  selectStep(next, true)
}
</script>
