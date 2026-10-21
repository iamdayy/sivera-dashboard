# Migrasi shadcn/vue

Migrasi presentasi bertahap. Route dan request tetap menggunakan `src/services/`; pengujian fixture UI tidak membuktikan algoritma atau storage backend.

## Konvensi

- Import registry dari direktori lowercase, misalnya `@/components/ui/button`.
- Token warna CSS lengkap berada di `src/style.css`, dengan pemetaan Tailwind v4 melalui `@theme inline`.
- Light-only untuk migrasi ini. Tidak ada toggle dark mode.
- Gunakan font sistem untuk keterbacaan operasional tanpa unduhan font. Hijau gelap menandai aksi utama; permukaan netral menjaga citra dan pengukuran sebagai fokus.
- Panel memakai border tanpa shadow; overlay boleh memakai shadow untuk menunjukkan lapisan interaksi.
- Kontrol pending dinonaktifkan dan diberi teks status serta `aria-busy`.
- Field numeric kosong harus tetap kosong sampai validasi payload, bukan menjadi nol.

## Bukti per fase

### P0: baseline

- Commit `be9d3cf`: 10 tes Chromium lulus, 1 tes live dilewati karena environment tidak tersedia.
- CTA root membuka dashboard, aksi Home membuka route kamera/prediksi, modal dibuka dan dibatalkan, RTSP tetap disabled, menu mobile benar-benar menavigasi.

### P1/P2: fondasi dan pilot Pengaturan

- Type-check, 6 unit test, build produksi, serta 15 tes Chromium lulus; 1 tes live dilewati.
- Label terhubung ke field; Tampilkan/Sembunyikan mengubah masking; Enter mengirim sekali; pending memblokir submit kedua; sukses/403 tampil inline; tepat satu toast muncul.
- Screenshot produksi dibuka pada 390/768/1440 px. Inspector: 0 FAIL; warning canvas berasal dari form terpusat `max-w-3xl`, dengan margin kiri/kanan sama, bukan overflow.
- Contrast primary/white 7.13:1; muted text/surface 6.87:1; batas input/white 3.69:1 (indikator non-teks).
- Kritik visual: form konfigurasi memimpin, metadata sekunder di bawah; warna hanya pada aksi; field dan tombol menumpuk di layar sempit. Chrome header/footer masih legacy hingga P7.
- Hard Gate PASS untuk pilot: masking, submit, pending, error, responsive dan focus style memiliki tes/bukti; tidak ada key nyata atau data produksi dalam fixture.
- Purpose Gate PASS: warna, font, panel, ukuran field dan urutan form mendukung konfigurasi API.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1; header X-API-Key dan konteks backend memberi identitas layar.
- Craftsmanship PASS untuk pilot: checks di atas dijalankan; backend live tetap belum terverifikasi.

### P3: Kamera

- Migrasi `src/views/Dashboard/Cameras.vue` memakai registry Table, Badge, Dialog dan AlertDialog. Request tetap melalui `src/services/cameras.ts`, tanpa perubahan route/header. `src/lib/camera-form.ts` memisahkan nilai field dari payload numeric.
- Create/PATCH mempertahankan default yang ada; koordinat kosong dihilangkan dari JSON, 0 dan desimal tetap angka, bilangan wajib yang kosong/invalid ditolak. RTSP opsional tetap metadata, bukan sumber prediksi yang didukung.
- Loading/error/empty dibedakan. Pemeriksaan kalibrasi yang gagal menampilkan "Gagal diperiksa", bukan "Belum Dikalibrasi".
- Dialog controlled mempertahankan input setelah gagal, reset melalui jalur tutup yang sama, serta memblokir submit/tutup selama mutasi pending. Fokus kembali ke trigger; setelah delete, ke Tambah Kamera.
- `DialogContent` meneruskan props/events Reka melalui `as-child` ke elemen DOM nyata. Focus/resize men-scroll kontrol aktif, termasuk ketika tinggi viewport turun menjadi 420 px.
- `bun run build` (termasuk type-check), `bun run test:unit -- --run`: 23 tes lulus. `bun run test:e2e -- --project=chromium`: 33 lulus, 1 live dilewati. Target `e2e/cameras.spec.ts`: 18 lulus.
- Enam lebar 320/390/600/768/1024/1440 px: halaman tanpa overflow horizontal, tabel scroll di container, dialog di dalam viewport, 13 Tab tetap di dialog. Longitude harus terlihat utuh sebelum/sesudah resize.
- Tes scroll memakai 24 kamera fixture: halaman terkunci untuk Dialog/AlertDialog, kembali dapat di-scroll setelah Escape. Tes teks 200% pada viewport 720x450 (reflow setara zoom desktop 1440x900) menjangkau Nama, Longitude, submit dan cancel tanpa overflow dialog. Ini simulasi reflow/text resize, bukan tes zoom browser atau keyboard perangkat fisik.
- Contrast dari style produksi dan rumus WCAG: foreground/white 17.74:1, muted/white 7.56:1, primary/white 7.13:1, destructive/white 6.47:1, badge Siap 6.81:1, badge secondary 13.34:1, badge error 5.91:1; batas input/white 3.69:1, outline focus/white 7.13:1. Border panel bersifat struktural, bukan satu-satunya penanda kontrol/status.
- Audit registry memeriksa import named/default, helper `@/lib/utils`, dependency yang sudah tersedia, type-check dan runtime. Lint scope P3: 0 FAIL, 3 WARN shadow pada komponen overlay nyata, termasuk varian scroll registry.
- Inspector produksi dengan fixture pada 390/768/1440: tabel 0 FAIL/1 WARN; create 0 FAIL/0 WARN; delete 0 FAIL/1 WARN. Semua 18 screenshot final dan screenshot viewport pendek/teks 200% dibuka.
- Allowance `heavy-shadow` hanya untuk run create/delete karena keduanya overlay interaksi, bukan panel resting (R-12). `covered-text` hanya untuk create karena heading halaman di belakang modal sengaja tertutup dan tidak interaktif; title, field, serta tombol dialog tetap terlihat. Tidak ada allowance global untuk halaman atau penurunan assertion.
- WARN `hero-void` berasal dari satu baris fixture dan konfirmasi pendek di shell tinggi layar. Tinggi tabel mengikuti isi; tidak ada panel kosong yang diregangkan, dan data/ilustrasi palsu tidak ditambahkan untuk mengisi halaman.
- Percobaan suite lintas browser sebelum dua tes tambahan: 31 Chromium lulus, 62 gagal launch karena executable Firefox/WebKit tidak terpasang, 3 live dilewati. Kedua browser tetap belum terverifikasi. OpenAPI localhost:8000 terakhir gagal connection error 7; tidak ada bukti live CRUD.
- Warning compiler `defineEmits` dari komponen legacy masih ada, tidak dibersihkan di P3.

#### Click-through P3

| Kontrol | Bukti fixture Chromium |
| --- | --- |
| Tambah Kamera | Membuka dialog dan fokus Nama; Enter mengirim satu POST numeric; sukses memperbarui tabel dan satu toast |
| Edit | Memuat nilai kamera terpilih termasuk 0; gagal mempertahankan input; retry PATCH memakai UUID yang sama |
| Batal, Tutup dialog, Escape, klik luar | Menutup/reset tanpa request; fokus kembali ke trigger |
| Submit pending | Disabled, teks status, tidak mengirim ulang dan Escape tidak menutup |
| Hapus | Konfirmasi menyebut kamera/akibat; Batal dan Escape tidak mengirim DELETE |
| Hapus pending/gagal | Tidak menutup saat gagal/pending; retry satu DELETE; sukses menutup dan memperbarui empty state |
| Coba Lagi | Load error menjadi baris fixture; error/loading tidak disamarkan sebagai kosong |
| Buka Pengaturan | Tanpa key, menavigasi ke route settings; create disabled dengan alasan |

#### Kritik visual final P3

ROUND 2 (setelah memperbaiki fokus viewport pendek)

- Seen in one second: Manajemen Kamera dan aksi Tambah; saat overlay terbuka, form atau keputusan Hapus menjadi fokus.
- Idea (one sentence): Identitas kamera, resolusi/FPS dan kesiapan kalibrasi berada pada satu baris yang bisa langsung diedit sebelum alur analisis berikutnya.
- Live thing: create/edit/delete terhadap service nyata, diuji dengan fixture terpisah.
- Layout words by section: title=baris aksi / data=tabel / create=form / delete=konfirmasi.
- Scores: design 7, usability 8, creativity 6, content 8, overall 7.2. Ini penilaian visual, bukan skor aksesibilitas atau bukti backend.
- Caps applied: pendekatan tabel operasional masih dikenal umum; tidak mengklaim identitas visual baru. Cap foto/motion/hero marketing tidak berlaku untuk app screen ini.
- Top three problems: (1) desktop tabel satu baris menyisakan ruang kosong (`sivera-cameras-inspected/desktop-fold.jpg`), dipertahankan karena isi nyata tidak boleh dipalsukan; (2) mobile butuh scroll tabel untuk status/aksi (`mobile-fold.jpg`), container menahan scroll dan keyboard bisa mencapai aksi; (3) header/footer masih legacy dan tepinya berbeda dari canvas (`desktop-fold.jpg`), ditunda sesuai scope P7, bukan dirombak di Kamera.
- Tujuh pertanyaan app-screen: tabel menjawab kamera mana/kalibrasi apa; canvas dan panel memakai tepi yang sama; warna hanya aksi/status; kolom angka rata kanan/tabular; koordinat null menjadi '-' dan 0 dipertahankan oleh tes; tidak ada chart/legend/total duplikat; nav terlipat serta form/tombol menumpuk di mobile. Tidak ada redraw, font baru, mark/aset baru, atau fixture dalam bundle produksi.

#### Delivery gate P3 (scope Kamera)

- Hard Gate PASS, R-02/03: copy baru tanpa em dash/emoji; enam lebar, resize 420 px dan teks 200% lulus tanpa overflow halaman.
- Hard Gate PASS, R-17/18/23/36/38: tidak ada klaim, statistik, testimonial, aset atau route baru; data fixture bertanda UI hanya dalam tes/preview sementara.
- Hard Gate PASS, R-24/26/27: click-through di atas membuktikan aksi/navigation/loading/error/empty; pending jelas disabled, RTSP tidak diklaim berfungsi.
- Hard Gate PASS, R-25/32: rasio contrast diukur; label terhubung, Tab/Enter/Escape, focus trap/return dan indikator focus terbukti.
- Hard Gate PASS, R-28/33/34/35/37: tidak ada FAQ/script rewrite source/theme toggle; arah dari DESIGN.md, build dan runtime dijalankan.
- Purpose Gate PASS, R-01/04/06/07/08/09/10/12/13/14/19/22: hijau hanya primary/status, badge menyatakan pemeriksaan kalibrasi, X hanya penutup bernama, font sistem dan tabel untuk scan operasional, shadow hanya overlay, tanpa gradient/glass/glow/ilustrasi/arrow dekoratif/animasi masuk.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1; focal point data/form, jarak 16 px antarfield dan 24 px antarblok, satu aksen deliberate, motif identitas kamera plus status kalibrasi sesuai Design Read rencana.
- Craftsmanship/Quality Locks PASS, C-1..C-5 dan R-05/11/15/16/20/21/29/30/31: tabel/form mengikuti objek dan aksi yang ada, radius konsisten 6/8 px, CTA spesifik, light-only untuk operasi citra dan scope migrasi, tidak meniru shell baru; semua keputusan utama beralasan di atas. Status ini tidak mencakup backend live, browser yang tidak terpasang, atau shell legacy P7.

### P4: Kalibrasi

- Migrasi `src/views/Dashboard/Calibrations.vue` memakai Select, Textarea, Table, Badge, Dialog dan AlertDialog registry. `src/lib/calibration-form.ts` memvalidasi angka dan mempertahankan objek `File[]`; `src/services/calibrations.ts` dan resolver URL tidak berubah.
- Satu watcher kamera memuat daftar awal/pergantian tepat sekali, langsung membersihkan baris lama, dan mengabaikan success/error/finally dari respons usang. Tes menunggu respons usang selesai sebelum memeriksa data dan loading kamera baru.
- Upload tetap `Input type="file"`, `multiple`, `accept="image/*"`, event change native. Fields multipart tetap `chessboard_cols`, `chessboard_rows`, `square_m`, `alpha`, `notes` opsional dan `files` berulang, tanpa boundary manual. Minimum 10 file dipilih tidak berarti 10 gambar chessboard valid.
- Input kosong/invalid ditolak, Alpha 0 dipertahankan, nilai RMS/square 0 tampil sebagai 0 dan null menjadi '-'. Default, batas angka, satuan meter pada form dan cm pada tabel tetap.
- Dialog mempertahankan field/file setelah gagal; cancel/Escape/klik luar/tutup membersihkan draft. Pending memblokir submit kedua, perpindahan kamera dan penutupan. AlertDialog menyebut kamera/versi dan tidak menutup sebelum DELETE berhasil; hapus versi aktif disabled dengan penjelasan.
- Preview tetap memakai service dan URL yang dikembalikan API. Link fallback muncul setelah respons, tanpa mengklaim tab terbuka. Tes memblokir `window.open`, membuka link dan membuktikan fixture PNG benar-benar termuat.
- Kontrak diperiksa dari backend `api/routes/calibrations.py`, schema dan tes/configuration terkait: parameter upload, minimum gambar, respons preview dan penolakan delete aktif. OpenAPI live localhost:8000 masih connection error 7; prefix deployment tidak diasumsikan. Return activation service masih bertipe `Calibration` sementara backend mengirim `CalibrationActivateResponse`; hasil return tidak digunakan dalam migrasi ini.
- Verifikasi terakhir: `bun run type-check`, `bun run build`, `bun run test:unit -- --run` (47 lulus/5 file), `bun run test:e2e -- --project=chromium` (53 lulus, 1 live skipped). Target Kalibrasi memiliki 20 tes lulus. `git diff --check` dan `bun install --frozen-lockfile` lulus.
- Enam lebar 320/390/600/768/1024/1440 px lulus: halaman tanpa overflow horizontal, tabel scroll dalam container, opsi Select minimal 44 px, 11 Tab tetap dalam dialog. Tinggi viewport 420 px tetap menjangkau file/submit; tes 200% text resize pada 720x450 dan reduced motion lulus. Ini simulasi reflow/viewport, bukan zoom browser atau keyboard fisik.
- Scroll lock create/delete dan pelepasan saat Escape/unmount route diuji dengan 24 baris fixture. Runtime produksi dan tes enam lebar tidak mencatat pageerror/console error; warning compiler legacy `defineEmits` masih ada.
- Contrast computed style produksi, dikomposisi untuk background transparan dan diperiksa melalui `antislop-human/contrast-check.py`: foreground/white 17.74:1, muted/white 7.56:1, primary/white 7.13:1 (hover 5.67:1), destructive/white 6.47:1 (hover 5.88:1), Aktif 6.81:1, Non-Aktif 13.34:1, opsi highlighted 16.12:1. Batas input 3.69:1; outline focus 7.13:1 pada putih dan 6.48:1 pada opsi highlighted. Semua 16 pasangan unik lulus ambang teks/non-teks yang relevan; kontrol disabled dikecualikan dari pengukuran aktif.
- Audit registry memeriksa import named/default, helper `@/lib/utils`, dependency yang sudah ada, type-check dan runtime. Lint scope P4: 0 FAIL/1 WARN `shadow-md` pada menu Select yang benar-benar overlay.
- Inspector produksi pada 390/768/1440: tabel 0 FAIL/1 WARN, create 0 FAIL/0 WARN, delete 0 FAIL/1 WARN, Select terbuka 0 FAIL/1 WARN. Semua 24 screenshot final serta enam viewport pendek dan satu teks 200% dibuka. Bukti sementara berada di `/tmp/opencode/sivera-calibrations*-final/` dan `sivera-calibrations-contrast*.json`, bukan bundle produksi.
- Allowance inspector: `heavy-shadow,covered-text` hanya create, `heavy-shadow` hanya delete; tidak ada allowance tabel/Select. Heading latar create sengaja tertutup modal dan tidak interaktif. WARN `hero-void` berasal dari dua baris fixture dalam shell tinggi layar, bukan panel kosong yang diregangkan. Data palsu tidak ditambahkan untuk mengisinya.
- `package.json` dan `bun.lock` tetap di luar commit P4 karena menyertakan perubahan awal user/CLI. Lucide tetap `^1.60.0`/`1.60.0`; tidak ada dependency/import `cn` terpisah. Relokasi transitive commander/estree-walker telah diperiksa, bukan penghapusan versi yang masih dibutuhkan konsumennya.
- Firefox/WebKit belum terverifikasi karena executable tidak tersedia. Keberhasilan kalibrasi/storage live membutuhkan gambar sah; percobaan sebelumnya mendapat HTTP 400 `Only 0 valid images; minimum 10 required`. Fixture UI bukan pembuktian OpenCV, storage, autentikasi artefak atau kalibrasi sampai prediksi.

#### Click-through P4

| Kontrol | Bukti Chromium |
| --- | --- |
| Pilih Kamera | Klik/Enter/Space membuka; End/ArrowDown memilih UUID; satu fetch per perubahan; Escape kembali fokus tanpa mengubah kamera |
| Buat Kalibrasi Baru | Membuka dialog dan fokus Cols; default 9/6/0.025/0 tampil; field/label terhubung |
| Cols, Rows, Square Size, Alpha, Catatan | Input numeric dan teks menghasilkan payload sesuai nilai; kosong/range/fraction integer ditolak; Catatan kosong dihilangkan, bukan diganti nilai palsu |
| Gambar chessboard | Native upload mempertahankan 10 File/nama dan fields berulang; 9 file ditolak sebelum request |
| Buat Kalibrasi/Enter | Mengirim satu POST; pending disabled dan tidak menutup; sukses refresh serta satu toast; gagal mempertahankan file/field dan dapat retry |
| Batal, Tutup dialog, Escape, klik luar | Menutup/reset tanpa request; fokus kembali trigger; scroll halaman kembali tersedia |
| Aktifkan | Gagal terlihat inline tanpa mengganti status; retry pending satu POST UUID, refresh versi aktif dan aturan hapus |
| Preview/Buka Preview | Error tampil, pending disabled; hanya URL response dipakai; link fallback membuka PNG fixture hingga `naturalWidth > 0` |
| Hapus/Batal/Escape | Versi aktif disabled dengan alasan; konfirmasi menyebut v2/kamera, cancel tidak DELETE; gagal tetap terbuka; retry menghapus sekali dan fokus kembali Buat Kalibrasi Baru |
| Coba Lagi | Error kamera/daftar menjadi data setelah retry, loading/error tidak disamarkan sebagai kosong |
| Buka Pengaturan/Manajemen Kamera | Empty tanpa key/kamera menuju route nyata; tombol create disabled sebelum konteks tersedia |

#### Kritik visual final P4

ROUND 3 (setelah perbaikan overflow Select dan capture menu terbuka)

- Seen in one second: Manajemen Kalibrasi, kamera yang dipilih dan daftar versi; overlay mengalihkan fokus ke input atau keputusan Hapus.
- Idea (one sentence): Kamera, pola chessboard, ukuran fisik square dan RMS dalam px tetap melekat pada versi yang akan diaktifkan sebelum analisis.
- Live thing: pilih kamera, unggah file, aktifkan versi dan buka preview melalui service yang ada, dengan pembuktian terpisah memakai fixture UI.
- Layout words by section: title=baris aksi / scope=selector / data=tabel / create=form / delete=konfirmasi.
- Scores: design 7, usability 8, creativity 6, content 8, overall 7.2. Skor visual di bawah 7.5; bukan sertifikasi aksesibilitas atau bukti backend.
- Caps applied: pendekatan operasional tabel masih konvensional (creativity maksimal 6); tidak mengklaim redesign atau art direction baru. Cap foto/motion/hero marketing tidak berlaku pada app screen.
- Top three problems: (1) ruang di bawah dua versi pada `sivera-calibrations-final/desktop-fold.jpg`, dipertahankan karena tinggi tabel mengikuti data dan menambah filler tidak benar; (2) status/aksi tabel memerlukan scroll pada `mobile-fold.jpg`, dipertahankan untuk perbandingan kolom, dengan container/Tab diuji; (3) shell header masih legacy dan tepinya berbeda pada `desktop-fold.jpg`, ditunda ke P7 sesuai scope. Overflow menu sebelumnya sudah diperbaiki; screenshot final Select tidak keluar viewport.
- Tujuh pertanyaan app-screen: tabel menjawab versi mana untuk kamera ini; scope/tabel berbagi tepi canvas; hijau hanya primary/status aktif; angka rata kanan/tabular dan tidak ada total rekaan; 0/null dibuktikan tes; tidak ada chart/legend duplikat; nav terlipat, form/aksi menumpuk dan Select tetap terbaca pada ponsel. Tidak ada font, mark, aset atau struktur nav baru.

#### Delivery gate P4 (scope Kalibrasi)

- Hard Gate PASS, R-02/03: copy baru tanpa em dash/emoji; enam lebar, viewport pendek dan teks 200% lulus tanpa overflow halaman/menu/dialog.
- Hard Gate PASS, R-17/18/23/36/38: tidak ada klaim/statistik/testimonial/aset/fitur baru yang dibuat; angka mengikuti API dan fixture ditandai UI dalam tes/preview saja.
- Hard Gate PASS, R-24/26/27: click-through per kontrol di atas dijalankan; loading/error/empty dan retry nyata, active-delete disabled dengan alasan.
- Hard Gate PASS, R-25/32: 16 pasangan contrast produksi lulus; keyboard Select, Tab/Enter/Escape, focus trap/return, label dan target 44 px diuji.
- Hard Gate PASS, R-28/33/34/35/37: tidak ada FAQ/script rewrite source/theme toggle; DESIGN.md dan Design Read rencana dipertahankan; build/runtime/console/click-through terverifikasi.
- Purpose Gate PASS, R-01/04/06/07/08/09/10/12/13/14/19/22: hijau untuk aksi/status nyata, font sistem untuk pembacaan operasional, tabel untuk versi berkolom; chevron membuka/men-scroll Select, check menyatakan pilihan dan X menutup dialog, semuanya affordance bernama, bukan ikon dekoratif. Shadow hanya overlay; tidak ada gradient/glass/glow/ilustrasi/arrow dekoratif/animasi masuk.
- Liveliness PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 konsisten; data/form menjadi focal point, jarak 16 px field/24 px blok memberi struktur, satu aksen terbatas, motif kamera-versi-chessboard-satuan memberi konteks SIVERA.
- Craftsmanship/Quality Locks PASS, C-1..C-5 dan R-05/11/15/16/20/21/29/30/31: setiap blok mengikuti operasi yang ada, CTA spesifik, radius field/panel konsisten, light-only untuk operasi citra, tidak meniru shell produk lain; alasan warna/font/layout/jarak/panel/ikon ditulis di atas. PASS hanya scope UI yang diuji, bukan backend live, Firefox/WebKit atau shell legacy P7.

## Batas yang tetap terbuka

- Backend lokal tidak tersedia saat baseline. Prefix route harus diverifikasi dengan OpenAPI live sebelum mengubah request.
- Koordinat display, world point awal, dan reference/model ID pada Referensi Tanah memerlukan perbaikan integrasi terpisah.
- Depth scale, autentikasi URL artefak, dan polling belum dibuktikan oleh fixture UI.
- Keberhasilan kalibrasi hingga prediksi membutuhkan backend dan citra kalibrasi yang sah.
