# Rencana Kerja SIVERA Dashboard

Audit: 20 Oktober 2026. Sumber kebenaran: kode aktual di `iamdayy/sivera-dashboard` dan `iamdayy/sivera`, bukan asumsi. Mode antislop: DURING.

## 1. Kontrak backend terverifikasi (dari source, 20 Okt 2026)

- Auth: header `X-API-Key`. 401 berarti key hilang/tidak valid, 403 berarti scope kurang. Scope: `camera:read/write`, `calibration:read/write`, `ground_ref:read/write`, `predict:read/write`.
- Prefix: TIDAK ADA `/api/v1`. Route dipasang langsung (`/cameras`, dst). Base URL benar untuk dev: `http://localhost:8000`.
- Kamera: `GET /cameras` (paginasi `items/total/page/page_size/total_pages`, item TIDAK punya status kalibrasi), `GET /cameras/{id}` (memiliki `active_calibration_id/version/rms`), `POST`, `PATCH`, `DELETE` (cascade ke kalibrasi, referensi tanah, riwayat prediksi).
- Kalibrasi: `POST /cameras/{id}/calibrations` multipart dengan field `chessboard_cols`, `chessboard_rows`, `square_m`, `alpha`, `notes`, `files` (min 10 gambar). Juga `GET` list, `GET /active`, `GET /{id}`, `POST /{id}/activate`, `GET /{id}/undistort-preview`, `DELETE /{id}` (ditolak jika kalibrasi aktif).
- Referensi tanah: `POST /cameras/{id}/ground-references` adalah **Form multipart**: `image_points` (string JSON), `world_points` (string JSON), `world_units` (`meter` atau `metre`), `description`. Minimal 4 pasang titik. Juga `GET` list, `GET /active`, `GET /{id}`, `POST /{id}/activate` (menghitung ulang ground model). **Tidak ada DELETE referensi tanah.**
- Ground model: `GET /cameras/{id}/ground-models/active`, `GET /{ground_model_id}`, `GET /{ground_model_id}/bev-preview?test_image_path=&mask_path=`. Response menyertakan URL `/files/...`.
- Prediksi: `POST /cameras/{id}/predict` multipart: `source_type` (upload, rtsp_frame, latest_rtsp), `timestamp`, `seg_model`, `seg_conf`, `seg_classes` (string JSON), `volume_cell_m`, `volume_min_pts_per_cell`, `return_outputs` (string JSON), `file`. **Asinkron via Celery** (route mengirim task, worker berjalan di docker-compose). Status job: `pending` -> `processing` -> `done` atau `failed` (sukses adalah `done`, BUKAN `completed`). Prasyarat submit: kalibrasi aktif + ground model aktif + depth scale (selain itu ditolak 400 dengan pesan jelas). RTSP: worker `NotImplementedError`, jangan tawarkan sebagai fitur yang berfungsi.
- Riwayat prediksi: `GET /cameras/{id}/predict` (list paginasi), `GET /{job_id}`, `GET /{job_id}/outputs`, `GET /{job_id}/outputs/{output_type}` (stream), `GET /{job_id}/instances`, `GET /{job_id}/volumes`. **Tidak ada DELETE job.**
- Output type dari worker: `mask`, `overlay`, `instances_json`, `depth_raw_vis`, `depth_scaled_vis`, `depth_masked`, `height_map`, `lifted_points_npz`, `volume_heatmap`, `volume_result_npz`, `bev_image`, `bev_mask_proyeksi`, `bev_overlay`.
- Artefak: `file_path` pada output adalah storage key. Backend local menyimpan `/files/{key}` dan me-mount `/files` tanpa auth, jadi URL gambar = `{origin API}/files/{key}`.
- `/health`: tanpa auth. Hanya membuktikan konektivitas, bukan validitas API Key.
- Catatan AGENTS.md dashboard yang sudah usang: prediksi kini asinkron dan riwayat job tersedia (terverifikasi dari `api/routes/predictions.py` + `api/workers/tasks/predict_task.py` + `docker-compose.yml`). Batasan RTSP tetap berlaku.

## 2. Temuan audit utama

Integritas dan keamanan:
- A1: `VolumeCard` punya default prop data volume palsu (2.5 m3, 2500 L) yang dirender di dashboard tanpa label demo.
- A2: fallback API key hardcoded `wst_dev_key_12345` di `services/api.ts`.
- A3: prefix `/api/v1` di `.env.example`, `.env` lokal, dan fallback kode, padahal route backend langsung.

Kontrak API rusak:
- B1: referensi tanah dikirim sebagai JSON body, backend menuntut Form multipart (selalu 422).
- B2: status sukses job adalah `done`, UI memetakan `completed` sehingga tombol Output/Instance/Volume tidak pernah aktif.
- B3: `has_active_calibration` tidak ada di response list kamera (hanya di detail kamera).
- B4: prasyarat prediksi tidak dicek di UI.
- B5: opsi RTSP ditawarkan seolah berfungsi.
- B6: header `Content-Type: multipart/form-data` diset manual.
- B7: hasil prediksi dibuang sebagai JSON mentah ke toast.

Dead controls dan navigasi:
- C1: `Dashboard/Index.vue` tanpa `<router-view>`, semua child route tidak pernah render.
- C2: modal kalibrasi tidak pernah terbuka (`showCreateModal` tidak didefinisikan).
- C3: `closeModal` prediksi mereferensikan variabel yang tidak ada.
- C4: route edit kamera tidak ada (tombol Edit mati).
- C5: navigasi tidak memuat section aplikasi, link `/api/docs` mati, tombol Masuk mengarah ke halaman itu sendiri.
- C6: tombol dekoratif: Preview kalibrasi, Aktifkan di card, Model Ground, BEV Preview, Hapus (calibration, ground-ref, job).
- C7: bagian Aktivitas Terbaru tanpa sumber data (selalu kosong).
- C8: landing: klaim "Kalibrasi Otomatis", dua SVG path rusak, tanpa CTA ke dashboard.

Aksesibilitas dan state:
- D1: modal manual tanpa focus trap dan aria (Headless UI Dialog tersedia sebagai dependensi tapi tidak dipakai).
- D2: state `loading` ada di semua view tapi tidak pernah dirender.
- D3: kontrol Theme, Bahasa, Auto-refresh di Settings tanpa implementasi.
- D4: `index.html`: `lang` kosong, judul "Vite App", stylesheet dimuat dua kali.
- D5: `toLocaleDateString` dipakai dengan opsi jam (jam tidak pernah tampil).
- D6: `confirm()` native untuk aksi destruktif.

Styling (terbukti dari hasil build):
- E1: token shadcn tidak dipetakan ke `@theme` Tailwind v4, kelas `text-primary`/`bg-primary` tidak ada di CSS build.
- E2: `tailwind.config.js` gaya v3 diabaikan `@tailwindcss/vite`.
- E3: DESIGN.md meminta aksen hijau restrained, kode memakai biru default shadcn.
- E4: dua lockfile dikomit (bun + pnpm).
- E5: variabel toast didefinisikan di scoped `:root` sehingga tidak pernah berlaku.

Testing:
- F1: `bun run type-check` gagal (4 error), otomatis membuat build produksi gagal.
- F2/F3: unit test dan e2e masih scaffold "You did it!" dan gagal.
- F4: tipe tidak sinkron dengan schema backend (`cameraId: number`, `Record<string, any>`, tipe `Activity` fiktif).

## 3. Rencana implementasi

| # | Prioritas | Pekerjaan | Status |
|---|---|---|---|
| 0 | P0 | Perbaiki error type-check, hapus lockfile pnpm, perbaiki `index.html` | ✅ Selesai |
| 1 | P0 | Fondasi styling: `@theme` Tailwind v4 dengan aksen hijau, hapus config mati, perbaiki variabel toast | ✅ Selesai |
| 2 | P0 | API layer: hapus key hardcoded, base URL benar, normalisasi error terpusat, tipe sinkron schema, service per domain | ✅ Selesai |
| 3 | P1 | Shell: `<router-view>`, navigasi lengkap desktop dan mobile, indikator koneksi | ✅ Selesai |
| 4 | P1 | Komponen Dialog berbasis Headless UI (modal form), hapus `confirm()` dan `useModal` | ✅ Selesai |
| 5 | P1 | Halaman Kamera lengkap (status kalibrasi via detail endpoint, modal create/edit/delete, state loading/empty/error) | ✅ Selesai |
| 6 | P2 | Kalibrasi: create/activate/delete/preview undistort wiring penuh | ✅ Selesai |
| 7 | P2 | Referensi Tanah: transport Form multipart difix, create/activate, ground model + BEV via endpoint nyata, tombol delete dihapus (tidak ada di API) | ✅ Selesai |
| 8 | P2 | Prediksi: status `done` (bukan `completed`), RTSP disabled dengan label, create/upload wiring penuh, tombol delete dihapus (tidak ada di API) | ✅ Selesai |
| 9 | P2 | Settings: semantik koneksi & auth benar, kontrol Theme/Bahasa/Auto-refresh dihapus (dark mode non-fungsional) | ✅ Selesai |
| 10 | P3 | Home: kesiapan alur kerja per kamera (kalibrasi aktif, ground model, siap prediksi), statistik agregat dari semua kamera, recent jobs nyata | ✅ Selesai |
| 11 | P3 | LandingPage rework: CTA ke dashboard, ikon valid, copy jujur, hapus klaim "Kalibrasi Otomatis" | ✅ Selesai |
| 12 | P4 | Unit test diperbarui & pass, build pass, type-check pass | ✅ Selesai |

## 4. Catatan dan risiko terbuka

- Depth scale chicken-and-egg: submit prediksi pertama untuk kamera baru dapat ditolak 400 "No depth scale" karena scale baru dibuat di dalam pipeline atau lewat script seeding. Item P2 #8 harus menerjemahkan error ini dengan jelas. Perlu verifikasi dengan backend berjalan.
- Home masih menghitung statistik dari kamera pertama saja (diperbaiki menyeluruh di item 10).
- Hasil prediksi masih ditampilkan sebagai JSON (diperbaiki di item 8).
- E2E penuh butuh backend, worker, redis, dan model berjalan.
- Dark mode dihapus dari Settings sampai ada keputusan implementasi penuh (aturan: mode yang diship harus berfungsi).

<!-- verification-log -->
