# Rencana referensi tanah dari kamera

Status: rencana implementasi, belum diimplementasikan.
Tanggal: 29 Oktober 2026.
Repositori: `sivera-dashboard` untuk UI; `../sivera` untuk API, persistence, dan pengolahan gambar.

## 1. Tujuan dan keputusan

Operator mengambil gambar lantai terkini dari kamera RTSP yang dipilih, menentukan pasangan titik piksel/metrik pada gambar tersebut, lalu menyimpan referensi tanah yang terikat ke gambar dan kalibrasi yang benar.

Alur utama:

`Pilih kamera → Lihat kamera → Ambil Gambar Tanah → Koreksi distorsi → Tandai titik pada gambar diam → Isi koordinat meter → Simpan dan aktifkan referensi → Tinjau BEV → Siapkan skala kedalaman`

- Kamera berarti kamera RTSP terdaftar pada backend. Gunakan layanan snapshot MediaMTX yang sudah ada.
- Live view membantu mengatur penanda. Titik selalu dipilih pada snapshot tetap agar koordinat tidak bergeser saat video bergerak.
- Snapshot diperoleh backend pada resolusi asli. Snapshot tidak diambil dari tangkapan layar elemen video browser.
- Kalibrasi aktif tetap digunakan untuk koreksi distorsi dan intrinsics. Gambar chessboard pertama tidak menjadi sumber otomatis alur baru.
- Referensi, sumber gambar, dan ground model harus dapat ditelusuri kembali setelah halaman dimuat ulang.

## 2. Temuan terverifikasi

Sumber diperiksa: `DESIGN.md`, layanan frontend, route/schema/service backend, serta `/openapi.json` pada backend lokal tanggal 29 Oktober 2026.

| Bagian | Kondisi sekarang |
|---|---|
| `GroundReferences.vue` | Memanggil preview undistort kalibrasi aktif sebagai gambar pemilihan titik. |
| `src/services/snapshots.ts` | Sudah menyediakan `takeSnapshot`, `getLatestSnapshot`, dan pengambilan blob gambar. |
| `src/components/media/WhepPlayer.vue` | Pemutar WHEP tersedia untuk ditinjau dan digunakan ulang. Keberhasilan playback pada alur baru masih perlu diuji. |
| `POST /api/v1/cameras/{camera_id}/snapshots` | HTTP 201, menyimpan JPEG asli dari RTSP. Memerlukan `camera:write`, stream enabled, dan relay yang sesuai. |
| `SnapshotResponse` | Memuat `id`, `camera_id`, `width`, `height`, `size_bytes`, `captured_at`, `image_url`. Waktu adalah penerimaan worker. |
| Snapshot image GET | JPEG mentah, `camera:read`; belum menyediakan preview undistort terikat kalibrasi. |
| Ground-reference POST | Menerima pasangan titik, unit, dan deskripsi; memilih kalibrasi aktif saat POST. Belum menerima identitas gambar sumber. |
| Format ground-reference POST | OpenAPI live menyatakan `application/x-www-form-urlencoded`; frontend sekarang memakai `FormData`. Implementasi harus menguji dan menyelaraskan dokumentasi/transport ini. |
| Ground-reference persistence | Pembuatan saat ini langsung mengaktifkan referensi baru, menonaktifkan referensi sebelumnya, dan membuat ground model dalam satu transaksi. |
| BEV | Default masih gambar kalibrasi; pemrosesan membaca gambar mentah lalu melakukan undistort. Tanpa mask, backend saat ini menghasilkan mask contoh. |

Kesimpulan: dibutuhkan perubahan backend dan frontend. Mengganti gambar UI saja dapat mengirim titik dari gambar mentah dengan intrinsics untuk gambar undistorted, atau mengaitkannya dengan kalibrasi yang berubah saat operator mengisi form.

## 3. Kontrak backend yang diusulkan

**Endpoint/field dalam bagian ini adalah usulan baru, belum tersedia di backend.** Finalisasi dan terbitkan OpenAPI sebelum frontend menggunakannya.

### 3.1 Sumber referensi terikat snapshot dan kalibrasi

Gunakan snapshot POST yang sudah ada, kemudian tambahkan:

| Usulan operasi | Tujuan |
|---|---|
| `POST /api/v1/cameras/{camera_id}/ground-reference-sources` | JSON `{ snapshot_id, calibration_id }`; menyiapkan dan menyimpan gambar undistorted, HTTP 201 untuk sumber baru. |
| `GET /api/v1/cameras/{camera_id}/ground-reference-sources/{source_id}` | Metadata sumber tersimpan. |
| `GET /api/v1/cameras/{camera_id}/ground-reference-sources/{source_id}/image` | PNG undistorted berautentikasi. |

Metadata: `id`, `camera_id`, `snapshot_id`, `calibration_id`, `captured_at`, `width`, `height`, `coordinate_system: "undistorted_pixels"`, dan `image_url` dari API.

Backend wajib:

1. Memastikan snapshot dan kalibrasi milik kamera yang sama; snapshot berasal dari sumber RTSP saat ini; kalibrasi yang dipilih masih aktif.
2. Memastikan original intrinsics/dimensi tersedia dan resolusi snapshot cocok. Alur ini menolak kalibrasi legacy yang tidak bisa mengoreksi gambar mentah.
3. Menggunakan fungsi persiapan gambar yang sama dengan prediksi: raw → undistort satu kali, tanpa crop/resize tambahan, dengan target K yang konsisten.
4. Menyimpan snapshot ID, calibration ID, dimensi, versi persiapan gambar, digest gambar dan identitas sumber privat. Simpan bytes preview dan metadata sebelum mengirim URL.
5. Mendaftarkan akses preview berdasarkan resource yang tersimpan. Endpoint download memeriksa scope, kamera, dan keberadaan resource; `/files` tidak boleh membuka orphan.
6. Menangani permintaan persiapan sumber yang sama secara idempoten, misalnya uniqueness `(snapshot_id, calibration_id, preparation_version)` dan respons 200 saat memakai sumber yang sudah ada. Tetapkan status tersebut dalam OpenAPI.
7. Memeriksa batas bytes/piksel dan menangani storage/encoding failure tanpa mengembalikan URL sukses.

Scope usulan: persiapan sumber memerlukan `ground_ref:write`, `camera:read`, dan `calibration:read`; pembacaan sumber memerlukan `ground_ref:read`. Seluruhnya tetap camera-bound. Capture sendiri tetap memakai `camera:write`. Dokumentasikan kombinasi izin yang diperlukan pada alur operator.

### 3.2 Simpan referensi dengan identitas sumber

- Tambahkan `source_id` pada POST ground-reference yang sudah ada. Kalibrasi diambil dari sumber tersebut, bukan diam-diam dari kalibrasi aktif terbaru.
- Untuk kompatibilitas, request legacy tanpa `source_id` tetap mengikuti kontrak lama; dashboard alur kamera selalu mengirim `source_id`.
- Tambahkan sumber nullable pada respons list/detail. Data lama ditandai sumber tidak tersedia, tanpa mengarang snapshot historis.
- Di bawah lock kamera, validasi ulang kalibrasi aktif, identitas RTSP, sumber, dan dimensi; alokasikan versi dan tulis referensi/ground model/aktivasi dalam satu transaksi. Kegagalan tidak menonaktifkan referensi lama.
- Minimal empat pasangan titik, jumlah sama, bentuk `[u,v]`/`[X,Y]`, seluruh angka finite, piksel dalam gambar, unit meter/metre, tanpa duplikat atau konfigurasi geometris degenerat. Dukungan koordinat dunia negatif tetap sah.
- Validasi rank/kolinearitas pada kedua himpunan dan kegagalan homography/pose di backend. Jangan mewajibkan persegi panjang; itu hanya petunjuk penempatan yang mudah bagi operator.
- HTTP 409 dengan kode stabil yang baru didokumentasikan jika konteks berubah; UI meminta frame/konteks baru. HTTP 4xx untuk input/geometri invalid, 401/403 untuk akses, 503 untuk capture/storage sementara.
- Jika POST simpan putus setelah dikirim, UI menjelaskan hasil belum diketahui dan memeriksa riwayat berdasarkan source ID; jangan otomatis mengirim ulang dan membuat versi baru.

### 3.3 Migrasi dan BEV

- Usulkan tabel `GroundReferenceSource` dan FK nullable dari `GroundReference`. Tetapkan hubungan snapshot/kalibrasi, constraint, index, dan kebijakan penghapusan agar referensi tersimpan tetap memiliki sumber yang dapat dibaca.
- Tentukan revision Alembic setelah memeriksa head aktual. Uji upgrade/downgrade hanya pada database disposable; data legacy tidak diberi provenance palsu.
- Sumber yang belum dipakai referensi tetap private; penutupan form tidak menghapus snapshot melalui endpoint yang tidak tersedia. Retensi fisik mengikuti kebijakan backend.
- BEV untuk referensi baru secara default memakai snapshot yang terikat sumber itu. Proses snapshot raw satu kali dengan kalibrasi yang dipin; hindari mengundistort ulang PNG yang sudah dikoreksi.
- Tampilkan BEV gambar sumber untuk verifikasi. Mask contoh yang sekarang dibuat otomatis tidak boleh dilabel sebagai hasil segmentasi nyata; pisahkan/hilangkan overlay contoh pada alur ini.
- Refresh readiness setelah referensi aktif berubah. Skala kedalaman untuk ground model lama tidak dianggap kompatibel dengan model baru; arahkan operator membuat skala yang sesuai.

## 4. Alur operator dan state frontend

### A. Persiapan kamera

- Pilih kamera; tampilkan kalibrasi aktif, resolusi, status stream, dan petunjuk memasang minimal empat penanda sebidang tanah dengan koordinat yang diukur.
- Gunakan WHEP player yang ada untuk live view, lengkap dengan state koneksi. Kegagalan playback browser tidak otomatis dianggap kegagalan snapshot RTSP; tampilkan keduanya terpisah.
- Tombol **Ambil Gambar Tanah** mengambil snapshot baru, kemudian menyiapkan sumber undistort. Hindari polling `latest` untuk mengganti sumber yang sedang dianotasi.
- Tampilkan waktu tangkap, kamera, resolusi, versi kalibrasi, dan label **Gambar terkoreksi distorsi**.

### B. Pemilihan titik pada frame tetap

- Aktifkan pemilihan titik hanya setelah blob tervalidasi dan gambar selesai decode.
- Tampilkan nomor titik dan tabel pasangan `Image (u,v)` serta `Dunia (X,Y), meter`.
- Sediakan hapus satu titik, koreksi posisi, kosongkan titik, serta input piksel/metrik yang bisa dioperasikan lewat keyboard. Nilai kosong bukan nol otomatis.
- Zoom/pan dan skala tampilan tidak mengubah piksel sumber. Invers transform harus memperhitungkan ukuran natural, offset/letterbox, zoom, pan, dan batas gambar.
- **Ambil Ulang** menjelaskan bahwa titik akan diganti. Pertahankan draft lama bila capture/persiapan baru gagal; reset titik hanya saat operator menerima frame baru yang berhasil decode.
- Pergantian kamera, koneksi, atau sumber tidak boleh menerapkan respons terlambat ke draft baru. Batalkan request browser dan revoke object URL saat diperlukan; abort tidak membatalkan snapshot backend yang sudah dibuat.

### C. Penyimpanan dan hasil

- Tombol **Simpan dan Aktifkan Referensi** mencerminkan perilaku backend saat ini. Jelaskan bahwa referensi baru menggantikan referensi aktif dan membutuhkan pemeriksaan skala kedalaman yang kompatibel.
- Nonaktifkan simpan bila sumber belum siap, pasangan belum lengkap, validasi gagal, atau request masih berjalan; alasan tampil di dekat tombol.
- HTTP 201 berarti transaksi referensi/ground model tersimpan, bukan job queued. Tampilkan hasil tersimpan, sumbernya, reprojection error bila ada, BEV, dan langkah kesiapan berikutnya.
- State minimum: belum memilih kamera, setup belum lengkap, live connecting/error, mengambil snapshot, menyiapkan sumber, decode error, siap menandai, input invalid, menyimpan, konflik konteks, hasil belum diketahui, sukses.
- Tautan pemulihan: konfigurasi kamera/stream, aktivasi kalibrasi, ambil ulang, perbaiki titik, muat ulang riwayat, dan skala kedalaman. Nilai form tetap tersedia pada kegagalan yang bisa dipulihkan.
- Ikuti komponen shadcn/vue dan arah visual `DESIGN.md`. Gambar menjadi area kerja utama; tabel tetap dapat dipakai di ponsel dan keyboard.

## 5. Urutan implementasi

1. **P0: kontrak dan sumber gambar backend.** Finalisasi schema/status/scope, persist source, migrasi, persiapan undistort, artifact access, serta tes sumber. Publikasikan OpenAPI.
2. **P0: simpan source-bound.** Validasi pasangan, context-change fences, transaksi versi/aktivasi, respons provenance, BEV dari sumber yang sama, dan tes rollback/race.
3. **P1: integrasi frontend.** Adapter sumber typed, capture melalui service snapshot, pemakaian WHEP, state draft, dan penggantian loader gambar kalibrasi pada `GroundReferences.vue`.
4. **P1: anotasi dan pemulihan.** Transform koordinat, input keyboard, ambil ulang, status/izin/error, simpan/riwayat sumber, dan refresh readiness.
5. **P1: verifikasi penuh.** Unit/route/integration/browser, uji kamera nyata, lalu dokumentasi hasil dan keterbatasan.

## 6. Lokasi perubahan yang diperkirakan

Frontend:
- `src/views/Dashboard/GroundReferences.vue`
- `src/services/groundReferences.ts`, `src/services/snapshots.ts`, `src/services/api.ts`, `src/types/index.ts`
- Komponen anotasi domain baru bila dibutuhkan; gunakan ulang `src/components/media/WhepPlayer.vue`.
- `src/__tests__/` untuk adapter/state/transform; `e2e/` untuk perjalanan referensi kamera.
- `DESIGN.md` dan dokumentasi handoff.

Backend:
- `api/routes/ground_refs.py`, route sumber baru, `api/schemas/ground_ref.py`
- `api/services/ground_model_service.py`, service sumber baru; gunakan ulang snapshot/image preparation/storage services.
- `api/models/orm.py`, migrasi `api/alembic/versions/`, serta akses artifact sesuai namespace sumber yang dipilih.
- `tests/`, `openapi.json`, `DESIGN.md`, `AGENTS.md`, dokumentasi API.

## 7. Pengujian dan kriteria selesai

### Otomatis

- Sumber: raw snapshot benar-benar dikoreksi sekali; ukuran/K konsisten; missing intrinsics/resolusi/snapshot lintas kamera ditolak; registration commit sebelum download; encoding/storage gagal tidak sukses.
- Persistence: sumber tetap dapat diakses sesudah reload; legacy nullable tetap terbaca; permintaan bersamaan tidak menggandakan sumber; referensi lama tetap aktif bila transaksi gagal.
- Geometri: fixture diketahui untuk homography/pose; titik kolinear/duplikat/nonfinite/out-of-bounds ditolak; tidak mengganti hasil hilang menjadi nol.
- Konflik: kalibrasi/source RTSP berubah saat anotasi atau simpan; response lama setelah ganti kamera; putus jaringan sesudah POST; titik tidak terpasang pada frame pengganti.
- Authorization: 401/403, scope domain, source/snapshot/calibration lintas kamera, parent dihapus, orphan bytes, serta URL download berheader.
- UI: click/zoom/pan menghasilkan koordinat natural yang sama di desktop/mobile; input keyboard; frame baru gagal mempertahankan draft; capture gagal dapat dicoba lagi; semua pesan pemulihan memiliki tindakan nyata.
- BEV memakai source yang sama dengan anotasi; ground-model baru memperbarui readiness dan memerlukan depth scale yang cocok.
- Perintah frontend: `bun run type-check`, unit test terkait, `bun run build`, Playwright workflow terkait di Chromium/Firefox. Backend: pytest terkait, migrasi disposable, ekspor/diff OpenAPI.

### Kamera/backend nyata

1. Pasang kamera pada posisi pengukuran tetap dan minimal empat penanda tanah terukur yang tersebar.
2. Ambil frame aktual; buktikan frame/timestamp baru, preview bisa decode, serta klik berada pada gambar undistorted yang sama dengan perhitungan backend.
3. Isi koordinat hasil meteran, simpan, buka ulang detail dan BEV dari sumber yang sama.
4. Periksa beberapa titik/jarak tambahan yang tidak dipakai fitting; catat hasil dan metode ukur. Sukses API atau reprojection error kecil bukan bukti akurasi fisik volume.
5. Coba ambil ulang, gangguan stream, dan konflik kalibrasi secara terkendali pada lingkungan uji. Laporkan hardware/playback/model behavior yang belum diuji.

Penerimaan: operator menyelesaikan referensi tanah dari frame kamera terkini tanpa memakai gambar chessboard pertama; gambar, koordinat, kalibrasi, dan hasil tersimpan konsisten; kegagalan memiliki recovery; referensi lama dan data historis tetap dapat dibaca.

## 8. Batas bukti perencanaan

Pada penyusunan rencana ini hanya dilakukan inspeksi kode dan pembacaan OpenAPI live. Tidak ada pengambilan snapshot, migrasi, perubahan aplikasi, atau uji workflow baru. Capture, playback, ground model, serta akurasi fisik alur yang direncanakan belum terverifikasi. Pergeseran fisik kamera dengan URL RTSP tetap tidak dapat dideteksi dari source hash; operator perlu membuat referensi baru setelah posisi kamera berubah.
