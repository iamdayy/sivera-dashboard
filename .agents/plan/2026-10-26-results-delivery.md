# Detail hasil: verifikasi dan batas integrasi

Tanggal: 26 Oktober 2026. Antislop `during`, pilihan sesi. Milestone sebelumnya: `40a4e11`.

## Perubahan dan kontrak

- `src/components/PredictionResultSummary.vue`: volume Grid/Voxel dan Convex Hull 2D dipisahkan, disertai unit, batas validasi fisik, serta disclosure geometri/diagnostik.
- `src/lib/measurement-format.ts`: nilai hilang/nonfinite/negatif/nonnumeric menjadi `-`, nol dipertahankan, nilai positif di bawah presisi memakai `< threshold`, confidence dibatasi 0 sampai 1, dan timestamp sumber ditampilkan dalam UTC.
- `src/views/Dashboard/Predictions.vue`: hasil mendahului metadata, konfigurasi historis dari job, makna waktu RTSP, key sumber privat sebagai teks, format instance, serta recovery pembacaan volume. Metadata ikut scroll; hanya judul dialog tetap di atas. Reload memakai ukuran teks scalable.
- `src/components/ui/Dialog.vue`: native `summary` masuk focus trap. Tidak mengganti library atau mekanisme dialog existing.
- `src/__tests__/PredictionResultSummary.spec.ts`, `src/__tests__/measurement-format.spec.ts`, `src/__tests__/fixtures/prediction.ts`: 14 regresi unit baru dan fixture hasil.
- `e2e/fixtures/results.ts`, `e2e/prediction-results.spec.ts`: 13 skenario per browser untuk hasil, recovery, metadata, keamanan teks, keyboard, dan pembesaran teks.
- `e2e/job-polling.spec.ts`: assertion completion mengikuti copy baru; pembatalan request stale diperiksa secara eksplisit.
- `e2e/live-backend.spec.ts`: integrasi read-only hasil tersimpan, opt-in; tidak mengirim job inference.
- `DESIGN.md`, roadmap, dan dokumen ini: semantik hasil serta bukti verifikasi.

Tidak menambah endpoint atau mengubah payload. Probe `http://localhost:8000/openapi.json` terakhir connection refused. Snapshot `../sivera/openapi.json`, schema/routes prediksi, `api/services/volume_service.py`, dan tests backend dibaca, bukan diubah atau dijalankan. Grid memakai median tinggi sel yang memenuhi syarat dan luas sel penuh di batas; hull memakai luas footprint 2D dikali median tinggi, bukan convex hull 3D. `n_cells` mencakup sel dengan data finite, termasuk tinggi nol. Tidak ada metode utama yang tervalidasi fisik dalam kontrak.

`source_path` adalah identitas penyimpanan privat, bukan URL. RTSP `source_ts` adalah waktu penerimaan worker, bukan capture sensor. ID kalibrasi/ground/skala berasal dari job historis, bukan resource aktif sekarang. Ambang confidence segmentasi bukan akurasi volume.

## Commands yang dijalankan

| Pemeriksaan | Hasil | Bukti |
| --- | --- | --- |
| `bun run build` | Lulus | Build produksi dan `vue-tsc --build` |
| `bunx vue-tsc --noEmit --project tsconfig.vitest.json` | Lulus | Types unit frontend |
| `bunx vue-tsc --noEmit --project /tmp/opencode/result-e2e-tsconfig.json` | Lulus | Types scoped E2E beserta imports |
| `bun run test:unit --run` | 322 lulus, 22 file | Unit/frontend mock |
| Browser produksi, command di bawah | 112 lulus, 8 skipped, 0 unexpected/flaky | API mock Chromium/Firefox; 8 live belum dikonfigurasi |
| `bun /tmp/opencode/result-design-audit.ts` | 12 state, 0 unresolved, 0 browser error | Inspector probes/rules asli pada build produksi |
| Lint scoped UI, command di bawah | 0 FAIL, 7 WARN | Enam identifier mono dan shadow modal existing |
| `git diff --check` | Lulus | Whitespace diff |

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5181 bun run test:e2e e2e/prediction-results.spec.ts e2e/job-polling.spec.ts e2e/operator-journey.spec.ts e2e/navigation.spec.ts e2e/live-backend.spec.ts --project=chromium --project=firefox --output=/tmp/opencode/result-browser-stable
node /home/iamdayy/.agents/skills/design-taste-frontend/scripts/lint.mjs --app src/components/PredictionResultSummary.vue src/views/Dashboard/Predictions.vue src/components/ui/Dialog.vue
```

`result-browser-stable/.last-run.json` menyatakan passed tanpa failedTests. Report HTML menyimpan total 120, expected 112, unexpected 0, flaky 0, skipped 8. Percobaan sebelumnya sempat gagal pada reload preview: trace mencatat HTTP 404 ketika `dist/` sedang ditulis ulang oleh build. Sesudah build selesai, suite penuh di atas lulus tanpa melemahkan assertion. Jangan membangun ulang folder yang sedang dilayani selama gate browser.

Firefox dapat melaporkan satu handled `CanceledError` saat polling kamera lama dibatalkan. Tes hanya menerima nama/message pembatalan yang dikenali pada Firefox, maksimal satu, dengan requestfailed yang cocok. Native unhandled rejection dan semua page error lain tetap ditolak. Ini pengecualian pelaporan debugger, bukan izin mengabaikan error aplikasi umum.

## Visual dan kritik tujuh lintasan

Arah existing: framed sheet SIVERA, IBM Plex Sans, netral dengan hijau terbatas, ENERGY 1 / RHYTHM 1 / MOTION 1. Tidak ada draw/redraw, aset merek, atau data produksi rekaan. Pertanyaan layar: berapa estimasi tiap metode, dari sumber dan konfigurasi mana, serta apa batas maknanya?

Lima belas gambar `/tmp/opencode/result-design-final/{complete,partial,error,expanded,context}-{390,768,1280}.png` dibuka. Dua belas gambar top/context teks 200% dari Chromium/Firefox juga dibuka; pemeriksaan ulang Chromium menggunakan `result-browser-stable`. Pembesaran adalah root font 200%, bukan browser zoom atau keyboard perangkat fisik. Tes mengassert ukuran teks disclosure/reload berlipat dua, body scroll lebih tinggi dari setengah dialog, konfigurasi dapat dicapai, dan tidak ada overflow horizontal halaman/body/dialog.

Raw report mempertahankan 12 temuan `FAIL heavy-shadow`, satu per state. Semua mempunyai tepat satu shadow owner: `role=dialog`, `aria-modal=true`; dua lapisan shadow milik panel modal yang sama. Aturan app-screen mengizinkan dialog mengapung. Exception hanya untuk kondisi owner tersebut, bukan semua shadow. Tidak ada temuan unresolved/WARN pada inspector. Enam lint mono adalah ID job/kamera/kalibrasi/ground/skala; tidak ada heading atau instruksi mono.

Kontras token hasil dihitung: teks utama/putih 18,43:1, muted/putih 6,42:1, brand dan fokus/putih 7,13:1, warning/warning-bg opaque 6,84:1, muted/warning-bg opaque 6,19:1, control border/putih 3,88:1. Warning surface 50% pada putih lebih terang dari token opaque tersebut. Semua pasangan teks memenuhi AA. Tidak mengklaim audit semua isi gambar artifact.

1. Volume dan metode dibaca sebelum ID/diagnostik; dua estimasi tidak dijumlahkan. Pada 200% ponsel, status/reload memakai fold pertama dan volume dicapai melalui scroll yang nyata, tanpa mengecilkan teks.
2. Peer metode berbagi tepi body. Diagnostik dan konfigurasi dilipat menurut jenis data, bukan kartu fitur. Putaran layout memperbaiki header tinggi dengan memindahkan metadata ke body agar ruang baca tidak habis.
3. Hijau memberi fokus/tindakan existing; amber menyatakan hasil parsial atau akses detail. Angka tidak dipromosikan sebagai sertifikasi. Sans, frame, dan nama metode mempertahankan konteks SIVERA.
4. Fixture grid `0,125 m³ / 125 L` dan hull `0,180 m³ / 180 L` tampil terpisah; `0,305` tidak tampil. Unit memakai nilai API masing-masing, bukan konversi frontend. ID historis berbeda dari ID aktif fixture dan diuji tidak tertukar.
5. Nol tampil `0,000`/`0`; kecil positif `< 0,001`/`< 1`; missing/invalid `-`. Confidence nol `0,0%` tetap terlihat. Tidak menambah uncertainty atau count badge rekaan.
6. Tidak menambah chart/legend. Disclosure menjelaskan footprint/median/boundary yang benar; source key untrusted tidak menjadi elemen HTML/link/gambar. Metadata membungkus di body tanpa tabrakan horizontal.
7. Navigasi existing terlipat pada ponsel. Summary minimal 44px dan focus outline terlihat; Tab/Shift+Tab, Enter/Space, Escape, serta restoration ke tombol Detail diuji. Konfigurasi panjang tetap scrollable pada tiga lebar dan teks 200% di kedua browser.

## Bukti interaksi

Semua tindakan berikut memakai build produksi dengan API mock Chromium/Firefox. Result suite memeriksa page error/Vue warning; audit driver juga mencatat browser error. HTTP negatif fixture disengaja.

- `Detail` membuka job yang dipilih; Escape menutup dan mengembalikan fokus ke trigger.
- `Muat Ulang Detail` pada parsial membaca GET lagi dan menampilkan volume baru setelah fixture dipulihkan; missing tidak berubah menjadi nol.
- `Muat Ulang Detail` setelah volumes 403 memulihkan nilai dan menghapus warning. Job ID/status tetap ada; tidak menghasilkan POST ulang.
- `Rincian Grid/Voxel` menampilkan luas sel/boundary/median dan diagnostik; `Rincian Convex Hull 2D` menampilkan geometri 2D, bukan klaim 3D.
- `Konfigurasi job tersimpan` membuka ID historis/parameter serta penjelasan confidence; resource aktif tidak menggantikannya.
- Tab dari reload mencapai ketiga summary; Enter membuka, Space menutup. Tab akhir kembali ke close, Shift+Tab kembali ke summary terakhir. Outline dan Escape diperiksa.
- Pada 390/768/1280 dan 200% teks, setiap disclosure diklik/difokuskan, konfigurasi discroll sampai penjelasan terakhir, dan Escape menutup tanpa overflow horizontal.
- Upload/RTSP menampilkan UTC dengan makna sumber yang tepat. Key berisi markup untrusted tampil sebagai teks; tidak ada request menuju private path atau elemen HTML hasil injeksi.
- Polling accepted → processing → done tetap satu submission; partial, transient failure, pause/retry, stale camera, serta navigasi operator/header mendapat regresi dalam gate 112 tes.

## Delivery Gate antislop: PASS untuk delta hasil

Batas: presentasi hasil, metadata/configuration, format instance, copy recovery volume, serta native-summary focus trap. Bukan persetujuan seluruh dashboard, semua formulir existing, screen reader menyeluruh, atau integrasi hardware.

### Hard Gate

- R-02 PASS: diff copy baru dan laporan tidak memakai em dash.
- R-03 PASS: tiga lebar dan teks 200% diuji, summary minimal 44px, overflow halaman/body/dialog ditolak.
- R-17 PASS: nilai produksi berasal API; fixture hanya di tests; tally berasal report command.
- R-18 PASS: tidak menambah testimonial/identitas orang.
- R-23 PASS: memakai shell/aset existing dan layout hasil dalam plan; tidak menciptakan aset tanpa izin.
- R-24 PASS: tidak menambah navbar atau route rekaan; navigasi existing mendapat regresi.
- R-25 PASS: pasangan teks/fokus di atas dihitung dan screenshot opaque diperiksa.
- R-26 PASS: reload, tiga disclosure, trigger/close/Escape mempunyai bukti tindakan di atas.
- R-27 PASS: loading, empty/partial, complete, failed job, dan access-error/recovery diuji.
- R-28 PASS: tidak menambah FAQ.
- R-32 PASS: focus trap kedua arah, Enter/Space, outline, Escape/restoration, dan inner scroll diuji.
- R-33 PASS: edit langsung via patch source; scripts audit hanya mengukur dan menyimpan bukti.
- R-34 PASS: tema terang existing diperiksa; tidak menambah mode/theme toggle.
- R-35 PASS: build, 322 unit dan 112 browser test dijalankan; interaksi direkam per kontrol.
- R-36 PASS: experimental/akurasi belum diverifikasi tertulis; mock tidak disebut inference live.
- R-37 PASS: DESIGN dan Design Read 1/1/1 mendahului perubahan.
- R-38 PASS: metode/metadata mengikuti schema/source; source privat tidak direka menjadi URL.

### Purpose-Gate

- R-01 PASS: hijau existing untuk tindakan/fokus, amber semantik untuk warning; tanpa gradient.
- R-04 PASS: glyph native summary menunjukkan disclosure; ikon close existing menutup modal.
- R-06 PASS: Sans untuk baca operasional, mono hanya identifier teknis, angka tabular untuk pembandingan.
- R-07 PASS: ground existing opaque, tanpa pattern tambahan.
- R-08 PASS: tidak menambah panah CTA dekoratif.
- R-09 PASS: badge existing menyatakan status job backend, bukan promosi.
- R-10 PASS: body hasil opaque tanpa blur/glass.
- R-12 PASS: hanya modal dialog mempunyai elevasi; raw findings dan owner-based exception dicatat.
- R-13 PASS: tidak menambah glow; outline untuk fokus keyboard.
- R-14 PASS: peer estimasi berbagi struktur; diagnostik/configuration dilipat sebagai data sekunder.
- R-19 PASS: perilaku transition dialog existing mendukung open/close, tanpa motion/scroll baru.
- R-22 PASS: tidak menambah ilustrasi; artifact hanya dari respons terdaftar.

### Liveliness

- Dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 tertulis sebelum eksekusi.
- Konsistensi PASS: screenshot tenang dengan kelompok data predictable, tanpa ornament baru.
- Fokus PASS: estimasi/metode mendahului metadata; state/recovery mendapat prioritas saat bermasalah.
- Whitespace PASS: jarak memisahkan status, metode, metadata, dan output; disclosure mengurangi kepadatan.
- Aksen PASS: hijau untuk tindakan/fokus existing, warning berteks dan tidak tersebar dekoratif.
- Motif identitas PASS: rantai kalibrasi/ground/skala dan geometri Grid/Hull spesifik pengukuran SIVERA.
- Design Read PASS: detail hasil untuk operator, framed sheet/Sans existing, 1/1/1 dicatat.

### Craftsmanship dan Quality Locks

- C-1 PASS: alasan layout, typography, warna, jarak, dan disclosure tercatat dalam kritik/Purpose-Gate.
- C-2 PASS: semua kontrol delta diuji tanpa POST retry rekaan.
- C-3 PASS: blok berasal dari hasil, sumber, konfigurasi tersimpan, dan artifact API.
- C-4 PASS: state negatif/parsial, keyboard, dua browser, tiga lebar, dan teks 200% diperiksa.
- C-5 PASS: batas source/mock/live/hardware dinyatakan, tanpa klaim sertifikasi akurasi.
- R-05 PASS: hasil → metadata → konfigurasi → output mengikuti tugas review, bukan template pemasaran.
- R-11 PASS: radius mengikuti komponen existing; disclosure bukan pill dekoratif.
- R-15 PASS: CTA menyebut `Muat Ulang Detail` atau rincian metode/konfigurasi yang dibuka.
- R-16 PASS: copy menjelaskan geometri, nilai hilang, izin, serta recovery tanpa buzzword.
- R-20 PASS: unit/metode dan konfigurasi historis memberi identitas pengukuran, bukan generic KPI grid.
- R-21 PASS: mempertahankan tema terang operasional DESIGN; tidak memaksakan dark mode/toggle baru.
- R-29 PASS: netral/hijau existing dan warna status semantik; tidak menambah keluarga warna.
- R-30 PASS: refinement komponen existing tanpa meniru produk lain.
- R-31 PASS: volume dahulu untuk review; disclosure untuk diagnostik; header hanya judul untuk ruang baca; Sans untuk instruksi; tabular angka untuk perbandingan; hijau untuk action/fokus.

## Pekerjaan tersisa

Implementasi roadmap readiness/depth/job/operator/hasil selesai di frontend. Full regression berikutnya menemukan cacat fokus formulir setup; perbaikan dan hasil akhir 316 passed/8 live skipped tercatat dalam [2026-10-26-dialog-focus-delivery.md](2026-10-26-dialog-focus-delivery.md). Authenticated readiness, hasil tersimpan live, queued inference, worker/model availability, snapshot/playback, alur pengukuran lengkap, dan akurasi fisik masih belum terverifikasi. Tes live memerlukan origin/key/camera dan job hasil existing; jangan commit kredensial. WebKit belum dijalankan. `photorec.se2` tidak diketahui asalnya, tetap tidak disentuh atau di-stage.
