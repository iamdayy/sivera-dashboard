# Integrasi kontrak depth scale, 26 Oktober 2026

Backend: `../sivera/.agents/plan/2026-10-26-design-agents-alignment.md`.

Status alignment awal: implementasi, unit, browser mock, build, dan verifikasi backend Docker disposable selesai. Angka di bawah adalah hasil tahap alignment sebelumnya, bukan run ulang pada penutupan P1. Bukti frontend terkini: [2026-10-26-p1-delivery.md](2026-10-26-p1-delivery.md). Alur dashboard live dengan weights/kamera nyata serta validasi fisik masih menunggu prasyarat.

## Checklist

- [x] Kirim source key `test_image` hasil upload bersama titik preview undistorted. Request tanpa source key tetap memakai gambar kalibrasi pertama.
- [x] Tipe creation mendukung model dan clipping opsional; field kosong memakai default backend.
- [x] Respons memuat identitas weights/preprocessing. Readiness memberi recovery untuk 409 `depth_scale_identity_missing`, `depth_scale_model_mismatch`, dan `depth_scale_invalid_saved_fit`.
- [x] Preview memakai fetch berheader `X-API-Key` dan blob URL; submit gambar upload menunggu preview berhasil decode. Creation mengikuti respons sinkron 201.
- [x] Perbaiki pemuatan konteks saat halaman dibuka dengan query kamera, menggunakan watcher `immediate: true`.
- [x] Perbarui AGENTS, DESIGN, README dan regresi unit/browser.
- [x] Verifikasi kontrak HTTP backend dengan lifespan aktif, PostgreSQL/PostGIS disposable pada migrasi 007, key database, dan preview berautentikasi.
- [ ] Verifikasi ulang kontrak terhadap deployment yang sudah menjalankan migrasi 006/007 dan weights nyata.
- [ ] Jalankan alur pengukuran/kamera fisik dan dataset held-out; mock tidak membuktikan akurasi.

## Perubahan utama

- `src/components/depth-scales/DepthScaleForm.vue` dan `src/lib/depth-scale-form.ts`: bind source upload ke payload/titik, validasi dimensi, dan preview readiness.
- `src/types/index.ts`: identity weights/preprocessing serta kode prerequisite/recovery.
- `src/services/api.ts` dan `src/services/readiness.ts`: pesan dan tindakan membuat scale baru untuk identity/fit tidak kompatibel.
- `src/views/Dashboard/DepthScales.vue`: fetch konteks kamera pada inisialisasi. Bug direproduksi lewat browser sebelum diperbaiki.
- `src/__tests__/Readiness.spec.ts`, `src/__tests__/depth-contract-alignment.spec.ts`, dan `e2e/depth-contract.spec.ts`: regresi source binding, fallback tanpa source, recovery, serta alur browser.

Perubahan form, helper, types, polling, tes form, `Predictions.vue`, dan `e2e/job-polling.spec.ts` sudah ada sebelum integrasi ini. Implementasi diterapkan di atas pekerjaan tersebut; seluruh diff dashboard bukan hasil tugas ini.

## Hasil pemeriksaan aktual

| Perintah | Hasil |
| --- | --- |
| `bun run test:unit --run` | **241 passed**, 16 file |
| `env PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/playwright-browsers bun run test:e2e e2e/depth-contract.spec.ts --project=chromium` | **2 passed**, lebar 390 dan 1280 px, API mock |
| `bun run build` | Berhasil, termasuk type-check, setelah perbaikan watcher |
| `git diff --check` | Bersih |

Bukti interaksi Chromium pada kedua ukuran:

1. Tautan `/dashboard/depth-scales?camera=<UUID>` memuat konteks aktif.
2. Buat Skala Baru membuka form dengan submit belum aktif.
3. Upload PNG memuat preview dari request berheader `X-API-Key`.
4. Tambah Titik Manual dan pengisian tiga titik valid mengaktifkan Hitung dan Aktifkan.
5. Submit mengirim satu POST dengan `test_image` yang sama dan koordinat/Z yang diisi; respons 201 menutup form.
6. Tidak ada `pageerror` selama alur tersebut.

Percobaan browser awal belum menemukan executable Chromium. Setelah dipasang, tes mengungkap watcher konteks yang tidak berjalan pada query awal. Dua tes lulus setelah perbaikannya. Ini bukti perilaku frontend dengan API mock, bukan inferensi nyata.

## Deployment dan pekerjaan tersisa

- Backend menerbitkan kontrak terbaru di `../sivera/openapi.json`. Verifikasi Docker lanjutan memakai HTTP server dengan lifespan aktif dan PostgreSQL 16.4/PostGIS 3.4.3: OpenAPI identik, `/health` healthy/connected. Ini memperbarui pemeriksaan awal tanpa database/lifespan.
- Migrasi 006 mengikat scale ke identity/provenance dan 007 mendaftarkan preview ke satu parent. Legacy scale membutuhkan fit baru, preview tanpa registrasi perlu dibuat ulang. Migrasi database pengguna belum dijalankan.
- Backend Docker full suite: **354 passed, 15 skipped**. Run integrasi terpisah: **14 passed, 1 skipped**, mencakup migrasi, otorisasi JSONB, constraint/cascade preview, concurrency depth activation, prediction pins, RTSP sintetis, signaling WHEP, dan Celery termasuk crash worker. Satu skip memerlukan weights depth nyata. Kedua hasil tidak dijumlahkan sebagai satu run.
- HTTP smoke lulus untuk key valid/expired/invalid, scope/camera denial, registered/orphan files, recovery legacy identity 409, upload 201, dan preview berautentikasi 200. Cascade metadata menolak akses tanpa menghapus file fisik.
- Akses Docker sudah diberikan dan empat container disposable telah dibersihkan. Bukti XML/JSON/log ada di `/tmp/opencode/sivera-docker-verify/`; detail pada rencana backend. Prediction integration memakai inferensi mock dan WHEP hanya signaling. Alur dashboard live, weights/kamera nyata, playback/ICE browser, serta akurasi fisik held-out masih belum diverifikasi.
- Seluruh hostname/IP RTSP/RTSPS tetap diterima sesuai keputusan pengguna; validasi URL, auth, scope dan camera binding tetap berlaku.
- Alignment ini digabung dalam milestone P1 depth scale/persisted jobs; rencana historis dipertahankan. Penutupan P1 tidak menjalankan ulang suite backend Docker.
