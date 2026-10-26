# Fokus dialog setup dan regresi akhir

Tanggal: 26 Oktober 2026. Antislop `during`, pilihan sesi. Milestone sebelumnya: `c6524e4`.

## Perubahan dan diagnosis

- `src/components/ui/Dialog.vue`: scroll fokus setelah dua animation frame pada `focusin`/resize, guard dialog teratas, pembatalan saat close/unmount, serta `scroll-py-1` pada body untuk menjaga outline.
- `src/__tests__/Dialog.spec.ts`: 9 regresi penjadwalan, coalescing, fokus terkini/di luar modal, stacked dialogs, cleanup, dan native-summary focus trap.
- `e2e/dialog-focus.spec.ts`: 6 kasus per browser yang memeriksa field/footer, outline terhadap clipping ancestors, Escape/restoration, dan console pada 390/768/1440 px serta root text 100%/200%.
- `DESIGN.md`, roadmap, laporan hasil sebelumnya, dan dokumen ini: perilaku fokus serta hasil regresi akhir.

Full suite awal menghasilkan 290 passed, 14 failed, 8 skipped. Kegagalan menunjukkan field/footer Kamera/Kalibrasi keluar dari viewport setelah resize atau pembesaran teks. Instrumentasi produksi memperlihatkan Chromium masih menggunakan geometri dialog lama pada frame pertama. Scroll melalui dua frame mengatasi race itu; `focusin` juga menjadwalkan ulang pekerjaan bila fokus berubah setelah resize. Callback membaca `document.activeElement` saat dijalankan, bukan menyimpan field lama.

Review gambar berikutnya menemukan outline terpotong walaupun kotak input sudah terlihat seluruhnya. Scroll padding memperbaiki ruang untuk outline 2px dengan offset 2px. Assertion baru memeriksa clipping setiap ancestor scroll. Dua belas percobaan resize Chromium pada 320/390/1024 px dan empat diagnosis Kamera/Kalibrasi di Chromium/Firefox mencatat fokus terlihat setelah perbaikan. Assertions viewport existing tetap dipertahankan.

## Pemeriksaan yang dijalankan

| Pemeriksaan | Hasil | Jenis bukti |
| --- | --- | --- |
| `bun run build` | Lulus | Produksi Vite dan application type-check |
| `bun run type-check` | Lulus | Vue/TypeScript aplikasi |
| `bunx vue-tsc --noEmit --project tsconfig.vitest.json` | Lulus | Types unit frontend |
| `bunx vue-tsc --noEmit --project /tmp/opencode/dialog-e2e-tsconfig.json` | Lulus | Types E2E fokus dan imports |
| `bun run test:unit --run` | 331 passed, 23 file | Unit/frontend; browser geometry dimock pada unit dialog |
| E2E fokus, kedua browser | 12 passed | API mock, outline nyata pada build produksi |
| Full E2E, command di bawah | 316 passed, 8 skipped, 0 unexpected/flaky | Chromium/Firefox, API mock; tes live skipped |
| `bun /tmp/opencode/dialog-design-audit.ts` | 30 state, 30 outline utuh, 0 unresolved, 0 browser error | Probe/rules inspector asli, klasifikasi owner tercatat |
| Lint scoped, command di bawah | 0 FAIL, 1 WARN | Shadow pada modal existing |
| `git diff --check` | Lulus | Whitespace perubahan |

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5181 bun run test:e2e e2e/dialog-focus.spec.ts --project=chromium --project=firefox --output=/tmp/opencode/dialog-ring-browser-fixed
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5181 bun run test:e2e --project=chromium --project=firefox --output=/tmp/opencode/roadmap-browser-delivery
node /home/iamdayy/.agents/skills/design-taste-frontend/scripts/lint.mjs --app src/components/ui/Dialog.vue
```

Full suite memakai build scroll-padding yang stabil. Report HTML menyimpan total 324, expected 316, unexpected 0, flaky 0, skipped 8, ok true; `.last-run.json` menyatakan passed dan `failedTests: []`. Log: `/tmp/opencode/roadmap-browser-delivery.log`; ringkasan: `/tmp/opencode/roadmap-browser-delivery-summary.json`; screenshot/artifact: `/tmp/opencode/roadmap-browser-delivery/`.

Sebelum refinement scroll-padding, 80 tes Kamera/Kalibrasi dan full suite 304 passed/8 skipped juga lulus. Angka itu adalah pemeriksaan sebelumnya, bukan tambahan pada 316 tes akhir. Percobaan E2E baru pertama memakai fixture tanpa akses/kamera dan gagal membuka dialog; fixture kemudian dikonfigurasi berautentikasi dengan kamera berlabel fixture.

Probe `curl --fail --silent --show-error --max-time 5 http://localhost:8000/openapi.json` gagal dengan connection refused. Probe launch WebKit gagal karena `/home/iamdayy/.cache/ms-playwright/webkit-2370/pw_run.sh` tidak tersedia. Keduanya tidak dihitung sebagai tes lulus.

## Gambar, inspector, dan batas temuan

Design Read: formulir setup operasional SIVERA untuk operator, framed sheet/IBM Plex Sans existing, permukaan netral dengan hijau terbatas, ENERGY 1 / RHYTHM 1 / MOTION 1. Perubahan menjaga field yang sedang dipakai dan tindakannya tetap terlihat.

Tiga puluh screenshot `/tmp/opencode/dialog-design-final/{cameras,calibrations}-{initial,short-field,short-footer,text-200-field,text-200-footer}-{390,768,1440}.png` dibuka. Run inspector akhir berada di `/tmp/opencode/dialog-design-verified/`: 18 gambar identik berdasarkan hash, 12 gambar yang berbeda dibuka kembali. Dua belas screenshot field/footer 200% Firefox dari full suite juga dibuka. Outline field dan footer utuh; halaman/modal tidak overflow horizontal. Pembesaran memakai root font dan viewport pendek 420px, bukan keyboard ponsel fisik atau browser zoom native.

Raw `report.json` menyimpan setiap temuan beserta bukti owner dan klasifikasi. Hasil scoped fokus lulus; angka raw tetap berikut:

| Temuan raw | Jumlah | Penilaian |
| --- | --- | --- |
| FAIL `heavy-shadow` | 30 | Satu-satunya owner adalah modal nyata `role=dialog`, `aria-modal=true`; elevasi overlay diizinkan aturan app-screen |
| WARN `heavy-borders` | 2 | Seluruh owner adalah kontrol/link aktif, dengan kontras 3,30 sampai 3,88:1; bukan batas panel istirahat |
| WARN `small-title` | 18 | Mengacu pada h1 halaman di belakang modal; judul modal h2 mempunyai accessible name yang diperiksa |
| WARN `app-title-size` | 12 | H1 background membesar pada root text 200%; di luar perubahan fokus |
| FAIL/WARN `blank-gap` | 1/5 | Probe flow gap mengecualikan fixed layer; gap berasal dari halaman background, termasuk 572px pada Kamera desktop |
| WARN `panel-void` | 1 | Owner adalah panel background Manajemen Kamera |
| FAIL `headline-lines` | 4 | Reflow existing pada 390px/200%: judul modal tiga baris, paragraf/help besar, serta footer background ikut terukur |

Empat temuan reflow terakhir tetap merupakan batas typography existing, bukan exception yang menyatakan seluruh desain lulus. Teks tidak diperkecil untuk memenuhi batas dua baris inspector. Tiga puluh tujuh temuan background juga tetap tercatat. Outline/fokus, overflow, dan browser error mempunyai assertion tersendiri; semuanya lulus pada 30 state.

Driver audit sempat menghitung elemen modal tersembunyi ketika menggunakan selector DOM pertama; perbaikannya memakai locator modal yang terlihat. Warning Canvas2D berasal dari helper pembacaan warna dan hilang setelah context memakai `willReadFrequently`. Run akhir mencatat nol warning/error browser tanpa menyaring pesan tersebut. Lint mempertahankan satu warning shadow dengan alasan modal yang sama.

Kontras outline hijau `#166534` terhadap putih: 7,13:1. Token teks existing telah dihitung pada laporan hasil: utama/putih 18,43:1 dan muted/putih 6,42:1. Batas kontrol yang ditandai inspector: `#7c8289` pada `#ebedee` 3,30:1, pada putih 3,88:1. Tidak ada token warna baru.

## Kritik tujuh lintasan

1. Saat pengguna berpindah field, fokus dan field tersebut menjadi titik perhatian. Pada viewport pendek, konten lain dapat discroll untuk mencapai tindakan simpan.
2. Struktur formulir dan tepi body tetap konsisten. Scroll padding menyediakan ruang outline, bukan ruang dekoratif atau perubahan ukuran teks.
3. Hijau menandai fokus dan tindakan simpan. Shadow memisahkan modal dari halaman; permukaan tetap opaque dan tenang.
4. Input kamera, ukuran chessboard, dan file tetap mengikuti form existing. Tes CRUD/multipart memastikan interaksi menghasilkan request yang sesuai fixture.
5. Tidak ada angka pengukuran/count baru. Nilai nol dan payload opsional mendapat regresi dari suite existing; fixture tidak menjadi data aplikasi.
6. Tidak ada chart/legend. Audit tetap mencatat typography/background existing; tombol tutup fixed masih berada di atas konten nonfokus yang sedang tergulir.
7. Tab/Shift+Tab, close, Escape, restoration, scroll lock, dan focus ring diperiksa. Coarse-pointer CSS existing menyediakan tinggi kontrol minimal 44px; screenshot desktop-pointer dapat menampilkan kontrol 36px. Perangkat sentuh dan screen reader fisik belum diuji.

## Bukti interaksi

Build produksi, API mock Chromium/Firefox:

- `Tambah Kamera` membuka dialog dengan fokus Nama Kamera; `Buat Kalibrasi Baru` membuka dialog dengan fokus Chessboard Cols.
- Tab mencapai kontrol berikutnya. Longitude dan Gambar chessboard tetap terlihat bersama seluruh outline setelah resize ke tinggi 420px, pada root text 100% dan 200%.
- Fokus `Tambah Kamera`/`Buat Kalibrasi` membawa footer beserta outline ke area terlihat pada ketiga lebar.
- Escape menutup dan mengembalikan fokus ke trigger. Suite existing juga mengklik Batal, tombol Tutup dialog, dan overlay; draft/file dibersihkan tanpa request simpan.
- Submit kamera mengirim JSON numerik sekali; submit kalibrasi mempertahankan file native, field multipart, dan Alpha nol. Saat pending, penutupan/submission tambahan diblokir; kegagalan mempertahankan input untuk retry.
- Field wajib/numerik tidak valid dan gambar chessboard terlalu sedikit mencegah submit. Load error mempunyai Coba Lagi; kegagalan akses tidak dianggap daftar kosong.
- Konfirmasi hapus/RTSP menampilkan target, Batal/Escape tidak menghapus, dan retry mengikuti action yang dipilih. Stacked dialogs mengembalikan fokus ke dialog sebelumnya.
- Body scroll terkunci saat modal terbuka dan pulih setelah close. Native summary ikut focus trap dua arah; unit memeriksa disabled/collapsed controls dilewati serta listener/frame dibersihkan.

## Delivery Gate antislop: PASS untuk perubahan fokus

Gate mencakup scrolling fokus, outline, lifecycle dialog, dan regresinya. Batas typography/background di atas tetap terbuka; laporan ini bukan audit aksesibilitas seluruh dashboard.

### Hard Gate

- R-02 PASS: teks tambahan dan laporan diperiksa tanpa em dash.
- R-03 PASS: outline utuh dan overflow halaman/modal ditolak di tiga lebar, viewport pendek, teks 200%; ukuran target CSS existing dipertahankan.
- R-17 PASS: jumlah tes berasal report; data kamera hanya fixture pengujian.
- R-18 PASS: perubahan tidak memasukkan testimonial atau identitas orang.
- R-23 PASS: komponen dan aset existing digunakan dalam scope plan yang disetujui.
- R-24 PASS: route existing Kamera/Kalibrasi dibuka; tidak ada route/link baru.
- R-25 PASS: outline 7,13:1; token teks existing AA dan batas kontrol 3,30 sampai 3,88:1 tercatat.
- R-26 PASS: open, close, submit/validation/retry, dan konfirmasi mempunyai bukti tindakan di atas.
- R-27 PASS: empty/loading/error, pending/success, dan retry tercakup full suite mock.
- R-28 PASS: diff tidak menambah FAQ.
- R-32 PASS: fokus field/footer, trap dua arah, native summary, Escape/restoration, dan cleanup diuji.
- R-33 PASS: perubahan ditulis langsung melalui patch source; driver audit hanya mengukur halaman dan menyimpan bukti.
- R-34 PASS: tema terang existing diperiksa; tidak ada theme toggle dalam delta.
- R-35 PASS: build, 331 unit, 316 browser test, dan daftar interaksi tercatat; audit akhir nol browser error.
- R-36 PASS: mock, skipped, dan batas perangkat/backend dinyatakan; tidak mengklaim inference live.
- R-37 PASS: DESIGN dan Design Read 1/1/1 mendahului perubahan.
- R-38 PASS: tidak menambah kemampuan/data produksi rekaan; API fixture berada di tests.

### Purpose-Gate

- R-01 PASS: hijau existing untuk fokus/tindakan; tidak ada gradient baru.
- R-04 PASS: ikon X existing menutup modal; tidak ada ikon dekoratif baru.
- R-06 PASS: IBM Plex Sans mengikuti instruksi operasional existing; ukuran teks tetap mengikuti stylesheet aplikasi.
- R-07 PASS: background opaque existing, tanpa pattern baru.
- R-08 PASS: tidak ada panah CTA tambahan dalam diff.
- R-09 PASS: tidak ada badge baru dalam diff.
- R-10 PASS: dialog tetap opaque, tanpa blur/glass.
- R-12 PASS: modal adalah satu-satunya owner shadow yang diizinkan pada setiap state audit.
- R-13 PASS: outline memberi indikator fokus, tanpa glow tambahan.
- R-14 PASS: formulir berisi field tugas, tanpa feature-card baru.
- R-19 PASS: nearest scroll mengikuti fokus setelah reflow; tidak menambah animasi dekoratif.
- R-22 PASS: tidak ada ilustrasi baru dalam diff.

### Liveliness

- Dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 tercatat dalam plan.
- Konsistensi PASS: sheet, Sans, form grouping, dan warna tetap tenang dalam screenshot.
- Fokus PASS: field/tindakan aktif terlihat penuh pada 30 state audit.
- Whitespace PASS: scroll padding menjaga outline di tepi body tanpa menambah panel kosong.
- Aksen PASS: hijau yang sama menghubungkan fokus keyboard dengan tindakan.
- Identitas PASS: formulir berisi sumber kamera, koordinat, dan kalibrasi chessboard SIVERA.
- Design Read PASS: arah formulir setup operasional mendahului implementasi.

### Craftsmanship dan Quality Locks

- C-1 PASS: dua frame menyelesaikan stale geometry; scroll padding memperbaiki clipping yang terlihat pada gambar.
- C-2 PASS: interaksi dialog dan form tercatat per tindakan pada suite produksi.
- C-3 PASS: tidak menambah section; fokus mengikuti pekerjaan setup yang sedang dilakukan.
- C-4 PASS: viewport pendek, teks 200%, dua browser, stacked dialogs, dan close/unmount mempunyai regresi.
- C-5 PASS: report raw, kegagalan awal, hasil akhir, dan keterbatasan tetap dicatat.
- R-05 PASS: kelompok field existing mengikuti setup kamera/kalibrasi, bukan template pemasaran.
- R-11 PASS: radius existing dipertahankan dan scroll padding tidak mengubah bentuk kontrol.
- R-15 PASS: label tindakan menyebut Tambah Kamera/Buat Kalibrasi/Batal.
- R-16 PASS: dokumentasi menyebut perilaku, command, dan hasil terukur tanpa buzzword.
- R-20 PASS: konteks sumber kamera/chessboard dan framed sheet tetap memberi identitas operasional.
- R-21 PASS: tema terang mengikuti DESIGN; tidak memaksakan mode baru.
- R-29 PASS: perubahan tidak menambah keluarga warna.
- R-30 PASS: perbaikan komponen repository, tanpa menyalin produk lain.
- R-31 PASS: guard top-dialog mencegah scroll lapisan bawah; cleanup mencegah callback sesudah close; nearest alignment menjaga konteks; padding melindungi outline.

## Status roadmap dan verifikasi tersisa

Implementasi readiness, depth scale, persisted job, perjalanan operator, penjelasan hasil, dan full regression frontend selesai. Authenticated readiness, deployment backend terbaru, hasil tersimpan live, queued inference, worker/model, snapshot/playback, alur pengukuran lengkap, serta akurasi fisik masih belum terverifikasi. Tes live opt-in memerlukan `SIVERA_API_BASE_URL`, `SIVERA_API_KEY`, `SIVERA_CAMERA_ID`, dan untuk hasil existing `SIVERA_RESULT_JOB_ID`.

WebKit, keyboard ponsel fisik, browser zoom native, dan audit screen reader menyeluruh belum dijalankan. Raw inspector dan screenshot berada di `/tmp/opencode/`; temuan typography/background existing di atas tetap tersedia untuk pekerjaan lanjutan. `photorec.se2` tetap tidak disentuh atau di-stage. Tidak ada push.
