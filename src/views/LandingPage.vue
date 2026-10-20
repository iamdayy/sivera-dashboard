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
        <div class="grid gap-8">
          <div class="col-span-1">
            <div class="rounded-lg border bg-white p-6 shadow-sm">
              <h2 class="text-lg font-medium leading-6 text-gray-900">
                Selamat Datang
              </h2>
              <p class="mt-4 text-sm text-gray-500">
                Gunakan dashboard untuk mengelola camera, kalibrasi, referensi tanah,
                dan menjalankan prediksi volume sampah.
              </p>
            </div>
          </div>

          <div class="col-span-1">
            <div class="rounded-lg border bg-white p-6 shadow-sm">
              <h2 class="text-lg font-medium leading-6 text-gray-900">
                Fitur Utama
              </h2>
              <ul class="mt-4 space-y-2 text-sm text-gray-500">
                <li class="flex items-start">
                  <div class="flex-shrink-0">
                    <span class="ltr:mr-2.5 rtl:ml-2.5 ltr:ml-2 rtl:mr-2">
                      <svg class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clip-rule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <div class="min-w-0 break-words">
                    <p class="font-medium text-gray-900">Manajemen Camera</p>
                  </div>
                </li>
                <li class="flex items-start">
                  <div class="flex-shrink-0">
                    <span class="ltr:mr-2.5 rtl:ml-2.5 ltr:ml-2 rtl:mr-2">
                      <svg class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414l-1.293 1.293zm2.586 6.414a1 1 0 01-1.414 0l-1-1a1 1 0 10-1.414 1.414l1.293 1.293a1 1 0 001.414 1.414l1.293-1.293a1 1 0 011.414 0z"
                          clip-rule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <div class="min-w-0 break-words">
                    <p class="font-medium text-gray-900">Kalibrasi Otomatis</p>
                  </div>
                </li>
                <li class="flex items-start">
                  <div class="flex-shrink-0">
                    <span class="ltr:mr-2.5 rtl:ml-2.5 ltr:ml-2 rtl:mr-2">
                      <svg class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd"
                          d="M3 10a7 7 0 1114 0H3zM13 9a1 1 0 11-2 0 1 1 0 012 0zm-1 5a1 1 0 10-2 0v2h2v-2zM6.75 7.5a.75.75 0 00-1.5 0v2.06l-1.018-.51a.75.75 0 00-.96.96l.51 1.018a.75.75 0 001.102 0l1.018-.51-.51-1.018a.75.75 0 00-.96-.96V7.5z"
                          clip-rule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <div class="min-w-0 break-words">
                    <p class="font-medium text-gray-900">Prediksi Volume Sampah</p>
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
        <p class="text-sm text-gray-500">
          &copy; <span id="year"></span> Sivera Dashboard. All rights reserved.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
onMounted(() => {
  const yearSpan = document.getElementById('year')
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear().toString()
  }
})
</script>