# sivera-dashboard

Frontend dashboard SIVERA untuk pengelolaan kamera, kalibrasi, referensi tanah, dan hasil analisis. Backend berada di repository `iamdayy/sivera`; repository ini tidak menjalankan algoritma computer vision atau database.

## Konfigurasi backend

Salin `.env.example` ke konfigurasi lokal dan isi `VITE_API_BASE_URL` dengan origin backend, misalnya `http://localhost:8000`, tanpa `/api/v1`. Request kamera memakai `/api/v1/cameras`; `/health`, `/docs`, dan `/files` di luar prefix. Pengaturan lama dengan `/api/v1` ditampilkan sebagai migrasi yang perlu disimpan kembali; path lain ditolak, bukan dialihkan diam-diam ke backend lain.

API Key dimasukkan lewat Pengaturan dan disimpan di browser ini. Key dikirim melalui `X-API-Key`, bukan query atau Bearer token. Jangan menaruh privileged production key dalam `VITE_*`, source, atau repository. Produksi memerlukan keputusan secret handling server-side tersendiri. Probe kesehatan dan verifikasi akses `camera:read` terpisah; keduanya bukan bukti worker, MediaMTX, izin operasi lain, atau kamera berfungsi.

RTSP input hanya untuk penggantian sumber dan tidak dibaca kembali. Kosong saat edit mempertahankan sumber; penghapusan memerlukan konfirmasi. Preview/download artefak memakai authenticated fetch dan object URL lokal. Redirect dan origin artefak eksternal ditolak agar key tidak diteruskan.

## Status integrasi MediaMTX

Rencana dan hasil tiap tahap dicatat di [`.agents/plan/mediamtx-execution.md`](.agents/plan/mediamtx-execution.md). Backend saat ini menyediakan stream/WHEP, capture/compute, snapshot, dan persisted queued prediction (`upload`, `rtsp_frame`, `latest_rtsp`), tetapi UI workflow baru belum seluruhnya diterapkan. Tes mock membuktikan perilaku frontend, bukan playback/inference nyata. Live OpenAPI pada 25 Oktober 2026 memuat endpoint skala kedalaman aktif untuk ground model tertentu; ketersediaan worker dan file/versi model tidak tercakup pemeriksaan konfigurasi ini.

Historis: backend sebelumnya memakai request kamera tanpa prefix, belum mengimplementasikan RTSP prediction, dan menjalankan upload prediction secara sinkron. Kontrak tersebut tidak berlaku untuk snapshot MediaMTX pada `openapi.json` saat ini. Tetap periksa live `/openapi.json` saat berganti deployment.

### Live view publik

Buka `/public/cameras/<camera_id>` untuk playback tanpa API Key. Halaman memakai `VITE_API_BASE_URL` sebagai origin API dan endpoint `/api/v1/public/cameras/{camera_id}/stream/whep`. Administrator mengaktifkan stream melalui pengelolaan kamera.

WHEP memerlukan OPTIONS **204**, POST **201** dengan SDP answer dan `Location` backend, serta DELETE **204**. Header `Location`, `ETag`, `Link`, `Accept-Post`, dan `Accept-Patch` harus diekspos lewat CORS backend. OPTIONS preflight CORS boleh **200**. Error “Respons signaling WHEP tidak valid” pada proxy lama diperbaiki di backend; restart API yang berjalan tanpa reload setelah pembaruan.

Verifikasi Chrome lokal pada 31 Oktober 2026 berhasil memutar 1920×1080 dan menutup sesi saat navigasi. Tes live berikut memeriksa playback, header yang terbaca browser, dan cleanup tanpa mengirim prediksi:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:5173 \
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome \
SIVERA_API_BASE_URL=http://localhost:8000 \
SIVERA_CAMERA_ID='<camera_uuid>' \
bun run test:e2e e2e/public-whep.live.spec.ts --project=chromium
```

Gunakan Chrome yang terpasang atau hilangkan `PLAYWRIGHT_CHROMIUM_CHANNEL` untuk browser Playwright. Dev server harus memakai `VITE_API_BASE_URL` yang sama. Tanpa variabel kamera/API, tes live dilewati. Tes unit kontrak/state publik ada di `PublicWhepService.spec.ts` dan `usePublicWhepPlayer.spec.ts`; keduanya memakai mock. Segmentasi positif dan penyimpanan volume berubah masih memerlukan uji scene sampah.

## Eksekusi readiness dan perjalanan operator

Rencana aktif: [`.agents/plan/agents-design-execution.md`](.agents/plan/agents-design-execution.md). P0 menyatukan readiness Ringkasan/Analisis, memeriksa kecocokan ID kalibrasi/reference/model/skala aktif, serta membedakan konfigurasi kurang dari kegagalan akses/jaringan. Analisis memeriksa ulang sebelum POST dan menolak hasil pemeriksaan stale. Upload legacy tetap didukung hanya untuk gambar yang sudah undistorted; RTSP memerlukan intrinsics asli dan dimensi kalibrasi.

Probe ulang pada 25 Oktober 2026 berhasil membaca `/health` dan `/openapi.json` dari `http://localhost:8000`. Kontrak deployed memuat `GET /api/v1/cameras/{camera_id}/ground-models/{ground_model_id}/depth-scales/active` dengan `DepthScaleResponse`, termasuk `depth_model`. Deskripsi umum OpenAPI masih memuat pernyataan lama bahwa endpoint publik tidak tersedia; adapter mengikuti paths/schema yang dicocokkan dengan routes dan tests backend. Request resource berautentikasi belum diverifikasi live karena key/kamera uji belum dikonfigurasi.

Penyelarasan 26 Oktober 2026 memperbarui form agar mengirim `test_image` dari upload bersama titik preview undistorted. Tanpa source key, backend tetap memakai gambar kalibrasi pertama. Respons scale menambah identity weights/preprocessing; active GET menolak identity hilang/model berubah/fit tidak valid dengan 409, dan readiness menyediakan tindakan membuat scale baru. Weights tidak tersedia mendapat 503. Deskripsi OpenAPI terbaru sudah diperbaiki.

Halaman Skala Kedalaman kini memuat konteks saat dibuka dengan parameter kamera. Regresi browser mencakup upload → preview berautentikasi → tiga titik → creation pada lebar 390/768/1280 px menggunakan API mock. Model/clipping opsional mengikuti batas schema; field kosong memakai default backend. Readiness tetap tidak membuktikan worker/kamera tersedia atau akurasi fisik. Rencana dan hasil: [`.agents/plan/2026-10-26-depth-contract-alignment.md`](.agents/plan/2026-10-26-depth-contract-alignment.md). Deployment backend memerlukan migrasi 006/007, fit baru untuk identity legacy, dan regenerasi preview tanpa registrasi.

P1 mempertahankan job diterima melalui URL `tracking`, memisahkan kegagalan GET dari status job, dan menyediakan retry pemeriksaan. Hasil tanpa volume lengkap ditandai parsial; detail/riwayat dapat dimuat ulang. Pengiriman yang tidak mendapat konfirmasi mengarahkan operator ke riwayat, tanpa mengulang POST otomatis. Bukti frontend dan gate antislop: [`.agents/plan/2026-10-26-p1-delivery.md`](.agents/plan/2026-10-26-p1-delivery.md). Probe backend terkini ditolak koneksi; inference live masih belum diverifikasi.

Tes opt-in `e2e/live-backend.spec.ts` memeriksa public OpenAPI dengan `SIVERA_API_BASE_URL`. Tambahkan `SIVERA_API_KEY` untuk verifikasi akses `camera:read`, serta `SIVERA_CAMERA_ID` untuk readiness kamera yang sudah dikonfigurasi. Tes kamera hanya membaca resource dan membuka preflight, tidak mengirim prediksi. Gunakan key uji berscope terbatas; trace tes gagal dapat memuat data akses, sehingga jangan dibagikan atau di-commit. Tes yang kekurangan konfigurasi dilaporkan skipped, bukan verified.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
bun install
```

### Compile and Hot-Reload for Development

```sh
bun dev
```

### Type-Check, Compile and Minify for Production

```sh
bun run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
bun run test:unit --run
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
bun run build

# Runs the end-to-end tests
bun run test:e2e
# Runs the tests only on Chromium
bun run test:e2e --project=chromium
# Runs the tests of a specific file
bun run test:e2e e2e/settings.spec.ts
# Runs the tests in debug mode
bun run test:e2e --debug
```
