<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-3xl font-bold text-gray-900">
          Sivera Dashboard
        </h1>
        <p class="mt-2 text-sm text-gray-600">
          Monitoring dan estimasi volume sampah dari CCTV
        </p>
      </div>
    </header>

    <main class="flex-1">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid gap-8 md:grid-cols-2">
          <div>
            <div class="rounded-lg border bg-white p-6 shadow-sm">
              <h2 class="text-lg font-medium leading-6 text-gray-900">
                Selamat Datang
              </h2>
              <p class="mt-4 text-sm text-gray-500">
                Sivera Dashboard adalah antarmuka untuk mengelola kamera CCTV, menjalankan kalibrasi kamera,
                menentukan referensi tanah, dan memprediksi volume sampah menggunakan computer vision.
              </p>
              <div class="mt-6">
                <router-link to="/dashboard" class="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors">
                  Buka Dashboard
                </router-link>
              </div>
            </div>
          </div>

          <div>
            <div class="rounded-lg border bg-white p-6 shadow-sm">
              <h2 class="text-lg font-medium leading-6 text-gray-900">
                Fitur Utama
              </h2>
              <ul class="mt-4 space-y-3 text-sm text-gray-500">
                <li class="flex items-start gap-3">
                  <div class="flex-shrink-0 mt-0.5">
                    <svg class="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-gray-900">Manajemen Kamera</p>
                    <p class="text-xs text-gray-400">Daftar, edit, dan pantau status kalibrasi kamera CCTV.</p>
                  </div>
                </li>
                <li class="flex items-start gap-3">
                  <div class="flex-shrink-0 mt-0.5">
                    <svg class="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-gray-900">Kalibrasi Kamera</p>
                    <p class="text-xs text-gray-400">Upload gambar chessboard, hitung parameter intrinsik, aktifkan versi terbaik.</p>
                  </div>
                </li>
                <li class="flex items-start gap-3">
                  <div class="flex-shrink-0 mt-0.5">
                    <svg class="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1h5V6a4 4 0 00-8 0v1h5v6a4 4 0 108 0V7h5V6a4 4 0 00-4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-gray-900">Prediksi Volume Sampah</p>
                    <p class="text-xs text-gray-400">Segmentasi, estimasi kedalaman, proyeksi BEV, dan perhitungan volume (grid & convex hull).</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="bg-white border-t">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p class="text-sm text-gray-500 text-center">
          &copy; {{ currentYear }} Sivera Dashboard. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const currentYear = ref(new Date().getFullYear())
</script>