# sivera-dashboard

Frontend dashboard SIVERA untuk pengelolaan kamera, kalibrasi, referensi tanah, dan hasil analisis. Backend berada di repository `iamdayy/sivera`; repository ini tidak menjalankan algoritma computer vision atau database.

## Konfigurasi backend

Salin `.env.example` ke konfigurasi lokal dan isi `VITE_API_BASE_URL` dengan origin backend, misalnya `http://localhost:8000`, tanpa `/api/v1`. Request kamera memakai `/api/v1/cameras`; `/health`, `/docs`, dan `/files` di luar prefix. Pengaturan lama dengan `/api/v1` ditampilkan sebagai migrasi yang perlu disimpan kembali; path lain ditolak, bukan dialihkan diam-diam ke backend lain.

API Key dimasukkan lewat Pengaturan dan disimpan di browser ini. Key dikirim melalui `X-API-Key`, bukan query atau Bearer token. Jangan menaruh privileged production key dalam `VITE_*`, source, atau repository. Produksi memerlukan keputusan secret handling server-side tersendiri. Probe kesehatan dan verifikasi akses `camera:read` terpisah; keduanya bukan bukti worker, MediaMTX, izin operasi lain, atau kamera berfungsi.

RTSP input hanya untuk penggantian sumber dan tidak dibaca kembali. Kosong saat edit mempertahankan sumber; penghapusan memerlukan konfirmasi. Preview/download artefak memakai authenticated fetch dan object URL lokal. Redirect dan origin artefak eksternal ditolak agar key tidak diteruskan.

## Status integrasi MediaMTX

Rencana dan hasil tiap tahap dicatat di [`.agents/plan/mediamtx-execution.md`](.agents/plan/mediamtx-execution.md). Backend saat ini menyediakan stream/WHEP, capture/compute, snapshot, dan persisted queued prediction (`upload`, `rtsp_frame`, `latest_rtsp`), tetapi UI workflow baru belum seluruhnya diterapkan. Tes mock membuktikan perilaku frontend, bukan playback/inference nyata. Depth-scale readiness belum tersedia melalui API publik.

Historis: backend sebelumnya memakai request kamera tanpa prefix, belum mengimplementasikan RTSP prediction, dan menjalankan upload prediction secara sinkron. Kontrak tersebut tidak berlaku untuk snapshot MediaMTX pada `openapi.json` saat ini. Tetap periksa live `/openapi.json` saat berganti deployment.

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
