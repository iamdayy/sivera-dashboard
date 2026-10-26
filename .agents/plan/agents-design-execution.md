# Rencana dan eksekusi readiness serta perjalanan operator

Tanggal mulai: 25 Oktober 2026. Acuan: `AGENTS.md`, `DESIGN.md`, implementasi frontend, dan kontrak backend yang tersedia.

## Batas dan arah

- Repository ini hanya frontend. Tidak mengubah algoritma, database, deployment, atau source backend.
- Pertahankan Vue 3, TypeScript, Pinia, Vue Router, Axios, Tailwind v4, shadcn/vue, dan Bun.
- Antislop diterapkan selama perencanaan dan eksekusi (during, pilihan sesi).
- Dashboard operasional tenang, permukaan netral, aksen hijau terbatas: ENERGY 1 / RHYTHM 1 / MOTION 1.
- Gambar, status pengukuran, dan tindakan berikutnya menjadi fokus. Tidak menambah dekorasi atau KPI tanpa data.
- Satu organisasi. Tidak menambah akun/session palsu, user CRUD, role enforcement frontend-only, atau tenant selector.
- Pertahankan plan MediaMTX historis; dokumen ini tidak menimpa catatan verifikasi sebelumnya.

## Urutan pelaksanaan

### 1. Verifikasi kontrak

- [x] Cocokkan live `/openapi.json` dengan routes, schemas, dan tests backend untuk readiness.
- [x] Verifikasi endpoint, multipart, status job, scope akses, dan aturan intrinsics per sumber pada source/OpenAPI lokal; deployment terbaru masih perlu diuji live.
- [x] Konfirmasi binding gambar titik depth-scale ke input fit pada kontrak source dan tes frontend; inference nyata belum diverifikasi.
- Gunakan `X-API-Key`, origin tanpa prefix, dan `cameraPath()` tepat satu kali.
- Kontrak yang belum terverifikasi bukan bukti integrasi tersedia. Catat dependency backend tanpa meniru algoritmanya.

### 2. P0: perbaiki dan satukan readiness

File utama: `src/services/readiness.ts`, `src/services/predictions.ts`, `src/types/index.ts`, serta konsumen Ringkasan/Analisis.

- [x] Fetch ground model sebelum menentukan readiness; simpan ID dari respons sebenarnya.
- [x] Validasi kamera, kalibrasi, referensi tanah, dan ground model yang kompatibel.
- [x] Satu fungsi domain bertipe, digunakan semua konsumen prediction-readiness.
- [x] Bedakan konfigurasi siap, kurang/tidak cocok, dan pemeriksaan gagal karena akses/jaringan.
- [x] Ikuti aturan intrinsics per sumber; jangan memblokir upload legacy yang didukung backend.
- [x] Hapus readiness stale saat kamera/sumber/koneksi berubah dan periksa ulang sebelum POST.
- [x] Regresi: konfigurasi kompatibel, ground model hilang, mismatch kalibrasi/reference, intrinsics hilang, kegagalan API/jaringan, depth-scale hilang/tidak cocok, konteks stale.

### 3. P1: pastikan skala kedalaman benar

File utama: `src/services/depthScales.ts`, `src/lib/depth-scale-form.ts`, `src/components/depth-scales/`, `src/views/Dashboard/DepthScales.vue`.

- [x] Resolve skala aktif untuk ground model yang tepat dan identitas model yang benar-benar tersedia dari kontrak (`depth_model`, tanpa mengarang versi/file availability).
- [x] Bedakan 404 resource aktif, 401/403, gangguan jaringan, dan konfigurasi berubah dalam pemeriksaan readiness.
- [x] Selaraskan types, payload, dan kontrol formulir dengan schema 26 Oktober di source/OpenAPI lokal; verifikasi deployment dicatat terpisah.
- [x] Pulihkan validasi Z: kosong/nonfinite/tidak positif, titik duplikat, koordinat di luar gambar.
- [x] Kirim identitas source upload bersama titik preview yang berhasil didecode.
- [x] Setelah timeout POST, blokir pengiriman ulang dalam form dan tawarkan pemeriksaan daftar/skala aktif.
- [x] Perbarui klaim dokumentasi endpoint hanya setelah deployment dikonfirmasi.

### 4. P1: lifecycle persisted job dan recovery

File utama: `src/composables/useJobPolling.ts`, `src/services/predictions.ts`, `src/views/Dashboard/Predictions.vue`.

- [x] Pertahankan `job_id` dari HTTP 202; status pending/processing/done/failed dari GET job.
- [x] Polling bertipe, tidak bertumpuk, menolak respons stale, dan menjelaskan kegagalan pemeriksaan status.
- [x] Pertahankan kamera/job melalui query `tracking` dan `job` pada navigasi/refresh.
- [x] Bedakan accepted, berhasil, gagal, dan hasil parsial; tidak ada toast sukses untuk job gagal.
- [x] Tes multipart upload/rtsp_frame/latest_rtsp, RTSP tanpa file/timestamp, confidence nol, outputs omitted/[]/subset.
- Tidak auto-retry POST, mengarang endpoint pembatalan, atau menganggap abort browser membatalkan backend.

### 5. P1: perjalanan operator

Alur: Pengaturan akses → Kamera → Kalibrasi → Referensi Tanah → Skala Kedalaman → Analisis → Status job → Hasil/Riwayat.

- [x] Tindakan berikutnya serta alasan primary action terblokir terlihat dekat kontrol pada preflight Analisis.
- [x] Link setup membawa konteks kamera; readiness diperiksa ulang setelah kembali ke Analisis.
- [ ] Pisahkan health, akses, stream runtime, frame freshness, readiness, dan status job.
- [ ] Lengkapi loading, empty, blocked, error, processing, success, serta partial-result.
- [x] Gunakan GET riwayat backend dan paginasi; tidak mensimulasikan persistence/auth/permissions.

### 6. P2: hasil dan visual

- [x] Pertahankan shell, typography, spacing, dan aksen existing; hindari redesign di luar kebutuhan workflow.
- [ ] Unit, metode, source, job, dan konfigurasi hanya dari respons API.
- [ ] Nilai hilang bukan nol; job berhasil/fit diterima bukan sertifikasi akurasi fisik.
- [x] Periksa keyboard, fokus, kontras, target sentuh 44px pada link recovery baru, mobile/tablet, dan teks 200% untuk perubahan readiness.
- [x] Jalankan Delivery Gate antislop dan rekam bukti click-through untuk delta readiness, bukan persetujuan seluruh dashboard.

## Gate pengujian

```bash
bun run type-check
bun run test:unit --run
bun run build
bun run test:e2e --project=chromium --project=firefox
```

Gunakan production preview untuk pemeriksaan browser. Pisahkan bukti mock dari live backend, hardware, playback, dan inference. Catat tes skipped serta prasyarat yang belum tersedia. Tidak melemahkan assertions agar tes lulus.

## Bukti awal dan blocker

- Working tree bersih sebelum eksekusi.
- Baseline `bun run type-check`: lulus.
- Baseline `bun run test:unit --run`: 173 tes lulus, 13 file; unit tests frontend, bukan bukti hardware/inference.
- Probe awal `http://localhost:8000/health` dan `/openapi.json`: connection refused. Probe berikutnya berhasil; lihat log verifikasi di bawah.
- Source/snapshot backend lokal memiliki depth-scale endpoints; adapter frontend sudah ada. Bukti ini bukan verifikasi deployment.
- Backend lokal mengizinkan upload legacy yang sudah undistorted; RTSP memerlukan `k_original` dan dimensi kalibrasi.
- Schema lokal `DepthScaleCreate` hanya menerima `known_distances`; fit memakai gambar kalibrasi pertama. Preview upload frontend belum terbukti identik dengan input fit.
- Model/version compatibility yang tidak diekspos kontrak tidak boleh disimpulkan dari konfigurasi frontend.

## Log eksekusi

### 25 Oktober 2026: mulai P0

Rencana disimpan. Tahap pertama adalah readiness correction dan regression tests dengan endpoint existing, tanpa mengubah kontrak request berdasarkan dugaan. Verifikasi depth-scale deployment, input fit, playback, model/hardware inference, dan perjalanan pengukuran live tetap belum tersedia.

### 25 Oktober 2026: hasil P0 dan sebagian P1

- `resolveMeasurementContext()` mengambil kalibrasi, ground model, dan referensi aktif sebelum menilai kecocokan kamera/ID. `checkReadiness()` memeriksa intrinsics sesuai sumber dan skala aktif untuk ground model tersebut. `checkPredictionPrerequisites` adalah alias fungsi yang sama; setup skala memakai resolver konteks yang sama.
- Ringkasan/Analisis menampilkan alasan missing/mismatch, membedakannya dari kegagalan akses/jaringan, dan membawa kamera pada link setup. Analisis menghapus readiness lama saat konteks berubah serta memeriksa ulang sebelum POST. Tidak mengubah payload prediksi atau lifecycle polling dalam tahap ini.
- `DepthScales.vue` mendapat import `Label` yang sebelumnya hilang; formulir fit tidak dinyatakan selesai.
- Live `/health` dan `/openapi.json` di `http://localhost:8000` berhasil dibaca. Health melaporkan `healthy` dan database `connected`, bukan kesiapan inference. Paths/schema skala aktif dicocokkan dengan `api/routes/ground_refs.py`, pemilihan prasyarat prediksi, dan tests backend lokal. Tidak mengubah atau menjalankan tests backend.
- `DepthScaleResponse` memuat `depth_model`, bukan versi model/file availability. Deskripsi umum OpenAPI yang mengatakan endpoint publik tidak tersedia masih stale; README/DESIGN mengikuti paths/schema deployed.
- `DepthScaleCreate` hanya menerima `known_distances` (3 sampai 100 titik); backend memakai gambar kalibrasi pertama/default depth model. Titik dari preview upload frontend belum terikat ke input itu. P1 fit tetap terblokir sampai identitas input diselesaikan.

#### File berubah

- Domain/types: `src/services/readiness.ts`, `src/services/measurementContext.ts`, `src/services/predictions.ts`, `src/services/depthScales.ts`, `src/types/index.ts`.
- UI: `src/components/PredictionReadinessIssues.vue`, `src/views/Dashboard/Home.vue`, `src/views/Dashboard/Predictions.vue`, `src/views/Dashboard/DepthScales.vue`.
- Tests/fixtures: `src/__tests__/Readiness.spec.ts`, `e2e/readiness.spec.ts`, `e2e/fixtures/api.ts`, `e2e/live-backend.spec.ts`.
- Dokumentasi: `.agents/plan/agents-design-execution.md`, `README.md`, `DESIGN.md`.
- Script/screenshot pemeriksaan lokal berada di `/tmp/opencode/`, bukan source aplikasi atau file untuk di-commit.

#### Verifikasi yang benar-benar dijalankan

| Pemeriksaan | Hasil | Jenis bukti |
| --- | --- | --- |
| `bun run type-check` | Lulus | TypeScript/Vue frontend |
| `bunx vue-tsc --noEmit --project tsconfig.vitest.json` | Lulus | Types tests frontend |
| `bunx vue-tsc --noEmit --project /tmp/opencode/sivera-e2e-tsconfig.json` | Lulus | Types dua file E2E readiness/live serta imports-nya |
| `bun run test:unit --run` | 221 lulus, 14 file; termasuk 48 regresi readiness baru | Mock/frontend, bukan inference |
| `bun run build` | Lulus | Build produksi Vite |
| E2E readiness produksi terakhir, Chromium/Firefox | 30/30 lulus, termasuk navigasi setup, keyboard, screenshot stabil, viewport pendek, dan teks 200% | Respons API mock |
| Fokus viewport pendek/teks 200%, Chromium/Firefox | 8 kasus dalam 30 di atas, bukan 8 tes tambahan | Respons API mock, bukan keyboard perangkat fisik |
| Click-through recovery tambahan pada produksi | 16 tindakan terverifikasi di dua browser; script lokal `/tmp/opencode/sivera-readiness-clickthrough.ts` | Respons API mock, bukan tambahan kasus suite E2E |
| E2E live public-contract, Chromium/Firefox | 2 lulus | Dua request kontrak HTTP ke backend yang sama, bukan dua bukti hardware |
| E2E live key/configured-camera | 4 skipped | `SIVERA_API_KEY`/`SIVERA_CAMERA_ID` belum dikonfigurasi |
| Full E2E sebelumnya, Chromium/Firefox | 190 lulus, 12 gagal, 2 skipped | Mock; tidak dinyatakan hijau |
| Perbandingan baseline produksi untuk dialog kamera/kalibrasi | 2 lulus, 4 gagal | Mereproduksi cacat visibility fokus pada kode awal |
| Inspector produksi Analisis, 1440/768/390 | 0 FAIL, 0 WARN | Production assets melalui proxy fixture GET |
| Lint UI untuk empat file terkait | 0 FAIL, 15 WARN | Semua warning `font-mono`; alasan di catatan visual |
| `git diff --check` | Lulus | Whitespace diff |

Command browser readiness terakhir: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5180 PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/playwright bun run test:e2e e2e/readiness.spec.ts --project=chromium --project=firefox --output=/tmp/opencode/readiness-production-delivery --reporter=list`. Public-contract memakai `SIVERA_API_BASE_URL=http://localhost:8000` dan file `e2e/live-backend.spec.ts`. Tes live configured-camera hanya GET/read-only, tidak mengirim job.

#### Catatan visual dan batas review

- Arah tetap existing framed sheet, IBM Plex Sans, permukaan netral, hijau pada tindakan/status, ENERGY 1 / RHYTHM 1 / MOTION 1. Tidak ada draw/redraw, aset merek baru, atau data contoh yang ditanam pada aplikasi.
- Pertanyaan layar: apakah konfigurasi kamera cocok untuk sumber prediksi ini, dan setup mana yang perlu dibuka? Ringkasan prasyarat dan link recovery menjawabnya; siap berarti konfigurasi kompatibel, bukan jaminan worker/model/hardware.
- Enam screenshot inspector terakhir telah dibuka: fold dan page sheet desktop/tablet/mobile di `/tmp/opencode/sivera-readiness-inspect/`. Semua menampilkan assets produksi, bukan halaman kosong. Proxy lama menghasilkan `ERR_CONTENT_DECODING_FAILED`; header kompresi proxy pemeriksaan diperbaiki tanpa mengubah aplikasi.
- Enam screenshot dialog awal di `/tmp/opencode/readiness-production-final/` telah dibuka. Sebagian merekam opacity saat transition masuk, sehingga tidak dipakai sebagai bukti kontras final. Tes screenshot diperbarui untuk menunggu transition selesai dan mengambil viewport aktual, termasuk viewport pendek/teks 200%.
- Empat belas screenshot final di `/tmp/opencode/readiness-production-delivery/` telah dibuka, tujuh per browser: lebar 390/768/1440 pada tinggi normal/pendek serta teks 200%. Dialog sudah opaque; fokus link recovery dan input terlihat. Konten panjang tetap scrollable di dalam dialog, bukan dipaksakan muat dalam satu viewport. Teks 200% diuji melalui ukuran root font, bukan simulasi browser zoom atau keyboard ponsel fisik.
- Hierarki dan tepi panel sejajar; status diberi teks/icon, bukan warna saja. Mobile menumpuk panel dan melipat sidebar. Data mock kamera berlabel fixture, riwayat kosong tetap nol dari fixture, dan tidak ada grafik/hasil pengukuran yang dibuat-buat.
- Kekurangan existing yang tidak disentuh: ringkasan prasyarat mobile panjang sebelum alasan blocker, link empty-history berada dalam tabel scroll horizontal, serta dialog kamera/kalibrasi dengan fokus di luar viewport. Ini bukan persetujuan visual seluruh dashboard atau seluruh journey.
- Sebagian besar dari 15 warning monospace adalah ID/nama model dan angka diagnostik yang sesuai pengecualian app-screen. Satu pemakaian inherited di `Home.vue` menampilkan teks status stream `Aktif`/`Nonaktif`, bukan angka atau identifier. Pemakaian itu dicatat sebagai inkonsistensi typography existing di luar delta readiness, bukan dibenarkan sebagai angka. Tidak ada mono baru dalam komponen recovery.
- Kontras komponen recovery dihitung: teks utama `#131416`/`#fffef9` 18.25:1; muted `#5d5f60`/`#fffef9` 6.36:1; link `#166534`/`#fffef9` 7.06:1; pesan legacy `#92400e`/putih 7.09:1. Scope hanya pasangan warna readiness yang ditambah, bukan audit semua artefak/gambar.

#### Kritik final app-screen

1. Pertanyaan readiness dijawab oleh blok prasyarat dan alasan blocker, tanpa KPI rekaan. Di dialog, heading tindakan dan blocker terbaca sebelum parameter; ringkasan mobile di halaman tetap panjang dan belum direstrukturisasi.
2. Panel mengikuti tepi sheet; form menumpuk pada ponsel. Tidak ada strip kosong atau overflow baru pada komponen recovery. Tabel riwayat existing tetap mempunyai scroll horizontal lokal.
3. Hijau menandai tindakan/status positif, amber/red memberi status dengan teks pendamping. IBM Plex Sans dan framed sheet existing tetap terlihat; tidak menambah warna dekoratif.
4. Status model/kalibrasi/skala pada halaman dan dialog berasal dari resolver yang sama. Fixture menampilkan nol job, konsisten dengan GET daftar kosong; tidak ada agregat atau delta baru yang perlu direkonstruksi.
5. Nol riwayat adalah nol fixture yang nyata; ID resource yang tidak tersedia tetap `null`. Tidak menambah count badge atau mengubah angka hilang menjadi nol.
6. Tidak menambah chart, legend, atau artifact pada readiness. Label dan link tidak bertabrakan di screenshot akhir, termasuk teks 200%.
7. Sidebar terlipat pada ponsel; recovery tetap terbaca, target link minimal 44px, dan fokus dapat discroll ke viewport pendek. Belum ada bukti keyboard ponsel fisik atau audit screen reader menyeluruh.

#### Bukti click-through delta readiness

Semua tindakan berikut dijalankan pada assets produksi dengan API mock di Chromium dan Firefox. Bukan bukti setup/POST/inference live. Suite mengassert tidak ada page error/Vue warning atau console error tak terduga; error resource untuk respons negatif fixture dikecualikan secara eksplisit.

- `Jalankan Prediksi Baru` membuka dialog; `Escape` dan `Batal` menutupnya. Screenshot ditunggu sampai transition selesai.
- `Buka Skala Kedalaman` dari Ringkasan dan Analisis membuka `/dashboard/depth-scales?camera=<id>` dengan heading `Skala Kedalaman`.
- `Buka Kalibrasi` dan `Buka Referensi Tanah` dari dialog diaktifkan dengan Shift+Tab lalu Enter; URL kamera dan heading tujuan diperiksa. Kembali ke Analisis mempertahankan kamera dan membaca ulang readiness setelah fixture diperbaiki.
- Pemilih kamera A → B → A tidak menerbitkan respons A lama. Pemilih sumber upload → `rtsp_frame`/`latest_rtsp` → upload memicu loading dan aturan intrinsics yang sesuai.
- Upload fixture mengaktifkan submit hanya ketika konfigurasi cocok. Submit membaca ulang prasyarat: model yang kini hilang tidak menghasilkan POST dan file dipertahankan; konfigurasi cocok menghasilkan tepat satu POST/202, bukan pesan prediksi selesai.
- `Coba Lagi` pada Ringkasan, halaman Analisis, dan dialog membaca ulang setelah fixture 403 dipulihkan. `Buka Pengaturan` pada ketiganya diaktifkan dengan Enter dan membuka `/dashboard/settings` dengan heading yang tepat. Bukti tambahan: `PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/playwright bun /tmp/opencode/sivera-readiness-clickthrough.ts`.
- Sumber RTSP belum dikonfigurasi dan stream belum diaktifkan masing-masing memblokir submit dengan alasan berbeda; `Buka Manajemen Kamera` membuka `/dashboard/cameras?camera=<id>`.
- Link recovery mempunyai outline minimal 2px setelah navigasi keyboard dan tinggi minimal 44px pada 390/768/1440. Link/input/footer dapat difokuskan dalam viewport pendek dan teks 200% tanpa overflow horizontal dialog/halaman.

#### Delivery Gate antislop: PASS untuk delta readiness

Batas gate adalah logika readiness, pesan dan link recovery baru, serta preflight yang berubah. Bukan audit semua kontrol form existing, formulir fit skala, polling job, atau persetujuan seluruh dashboard. Cacat baseline dan batas live di atas tetap berlaku.

Hard Gate:

- R-02 PASS: teks baru tidak memakai em dash; pemeriksaan diff copy dan plan dilakukan.
- R-03 PASS: 30 tes browser mencakup overflow halaman/dialog dan link 44px pada tiga lebar; empat belas screenshot akhir ditinjau.
- R-17 PASS: tidak menambah statistik; hasil jumlah tes berasal dari command yang dijalankan, data kamera browser ditandai fixture.
- R-18 PASS: tidak menambah testimonial atau identitas orang.
- R-23 PASS: tidak membuat logo, avatar, foto, atau struktur navigasi baru; link recovery memakai route existing.
- R-24 PASS: tujuan kalibrasi, referensi, skala, kamera, dan pengaturan benar-benar dibuka dan heading/URL diperiksa.
- R-25 PASS: empat pasangan warna teks recovery dihitung 6.36:1 sampai 18.25:1; dialog final opaque.
- R-26 PASS: semua kontrol baru/berubah dalam delta mempunyai bukti tindakan pada daftar click-through di atas.
- R-27 PASS: loading, resource hilang/mismatch, siap, kegagalan akses, serta retry diuji; error tidak disebut konfigurasi hilang.
- R-28 PASS: tidak ada FAQ pada perubahan ini.
- R-32 PASS: Shift+Tab/Enter pada recovery, outline 2px, Escape, dan fokus viewport pendek diuji di kedua browser.
- R-33 PASS: perubahan aplikasi ditulis langsung melalui patch source; script pemeriksaan tidak menulis ulang source/CSS aplikasi.
- R-34 PASS: tidak menambah theme toggle atau mode baru; delta diperiksa pada tema terang existing.
- R-35 PASS: build produksi dijalankan, 30 E2E dan 16 tindakan tambahan diperiksa dengan daftar bukti; batas console negatif dijelaskan.
- R-36 PASS: tidak mengklaim inference, worker, akurasi, security compliance, atau akses live yang belum terbukti.
- R-37 PASS: arah `DESIGN.md` dan Design Read operasional mendahului perubahan; tidak melakukan redesign.
- R-38 PASS: copy kesiapan mengikuti resource/API; data pengujian berlabel fixture dan tidak ditanam sebagai data produksi.

Purpose-Gate:

- R-01 PASS: hijau existing memberi tindakan/status; tidak menambah gradient atau glow.
- R-04 PASS: check/cross menjelaskan tersedia/tidak tersedia dengan label teks, bukan ikon dekoratif baru.
- R-06 PASS: IBM Plex Sans dipertahankan untuk keterbacaan operasional; tidak ada heading mono atau tracking dekoratif baru.
- R-07 PASS: tidak menambah grid/pattern latar.
- R-08 PASS: tidak menambah panah CTA dekoratif.
- R-09 PASS: badge existing menyatakan status resource dari resolver, bukan label promosi.
- R-10 PASS: komponen recovery opaque tanpa blur/glass baru.
- R-12 PASS: tidak menambah shadow pada panel; elevasi dialog existing memisahkan tugas modal dari halaman.
- R-13 PASS: tidak menambah glow.
- R-14 PASS: ringkasan resource existing dipertahankan untuk membandingkan tiga prasyarat nyata; blocker memakai daftar sesuai masalah, bukan kartu fitur pemasaran.
- R-19 PASS: tidak menambah animasi; feedback fokus/loading dan perilaku dialog existing mendukung perubahan state, bukan pertunjukan scroll.
- R-22 PASS: tidak menambah ilustrasi atau gambar stand-in.

Liveliness:

- Dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 tercatat sebelum eksekusi.
- Konsistensi PASS: screenshot akhir tenang, struktur predictable, tanpa dekorasi/motion baru.
- Fokus PASS: judul tugas dan blocker menjelaskan tindakan utama; konfigurasi tidak siap menonaktifkan submit dengan alasan dekat kontrol.
- Whitespace PASS: jarak memisahkan prasyarat, sumber, parameter, dan footer; recovery tidak mempunyai area kosong yang dibuat-buat.
- Aksen PASS: hijau existing pada tindakan/link, status semantik tidak dijadikan dekorasi halaman.
- Motif identitas PASS: framed sheet dan urutan kamera/kalibrasi/ground/skala menunjukkan konteks pengukuran SIVERA, bukan template marketing.
- Design Read PASS: dashboard operasional untuk operator, permukaan netral/hijau terbatas, dials 1/1/1 dicatat pada batas dan arah.

Craftsmanship dan Quality Locks:

- C-1 PASS: tujuan warna, typography, panel, jarak, ikon, dan link dijelaskan pada kritik serta Purpose-Gate.
- C-2 PASS: kontrol delta readiness mempunyai tindakan browser yang tercatat, tanpa frontend account/auth rekaan.
- C-3 PASS: daftar isu berisi prerequisite nyata; tidak menambah section pengisi template.
- C-4 PASS: state dan reflow delta diuji pada dua browser, tiga lebar, viewport pendek, dan teks 200%; bukan sertifikasi seluruh UI/perangkat.
- C-5 PASS: mock, live contract, skipped integration, dan hardware yang belum diverifikasi dipisahkan.
- R-05 PASS: struktur mengikuti setup/prediksi existing dan RHYTHM 1, bukan hero/pricing/testimonial template.
- R-11 PASS: radius komponen existing dipertahankan; recovery berupa panel/link, bukan pill pada setiap elemen.
- R-15 PASS: CTA menyebut tujuan konkret, seperti `Buka Skala Kedalaman` dan `Buka Pengaturan`.
- R-16 PASS: pesan menjelaskan resource hilang/mismatch dan recovery, tanpa buzzword promosi.
- R-20 PASS: isi kesiapan dan konteks kamera tetap spesifik untuk kalibrasi/ground/skala SIVERA; tidak mengklaim redesign identitas global.
- R-21 PASS: mempertahankan tema terang untuk dashboard operasional existing; tidak menambah dark default atau menunda toggle yang diminta.
- R-29 PASS: permukaan netral dan hijau existing, dengan amber/red semantik untuk warning/error; tidak menambah palet baru.
- R-30 PASS: tidak meniru produk lain atau mengganti shell dengan template baru.
- R-31 PASS: warna untuk tindakan/status, sans untuk baca, panel untuk prasyarat, jarak untuk kelompok tugas, dan link untuk setup mempunyai alasan satu baris.

#### Pekerjaan berikutnya

1. Selesaikan identitas preview/input fit dan validasi depth-scale P1; jangan memetakan titik gambar berbeda atau meniru algoritma backend.
2. Perbaiki persisted-job polling: types, request bertumpuk/stale, kegagalan GET status, failed versus done/partial-result, dan konteks job setelah navigasi/refresh.
3. Lanjutkan perjalanan operator dan result explainability sesuai checklist di atas, dengan regression tests per tahap.
4. Jalankan authenticated readiness dan alur pengukuran live saat key, kamera kompatibel, file/versi model, worker, dan hardware tersedia. Playback, snapshots, inference, serta akurasi fisik belum terverifikasi.

P0 telah di-commit sebagai `be511a5`. Catatan di atas adalah bukti tahap P0, bukan status akhir P1. Belum ada push. `src/components/ui/Dialog.vue` tidak diubah; cacat baseline dicatat untuk pekerjaan terpisah, tanpa melemahkan assertions.

### 26 Oktober 2026: P1 depth scale dan persisted job

Implementasi tahap 3/4 selesai untuk frontend. Bukti, file, batas live, kritik visual, dan Delivery Gate ada di [2026-10-26-p1-delivery.md](2026-10-26-p1-delivery.md). Alignment backend sebelumnya tetap dicatat di [2026-10-26-depth-contract-alignment.md](2026-10-26-depth-contract-alignment.md).

Tahap berikutnya adalah Ringkasan untuk operator baru: satu tindakan setup dari readiness yang sudah ada, konteks kamera pada navigasi, serta status konfigurasi stream yang tidak menyatakan runtime aktif. Auth tetap mengikuti kontrak API key existing.
