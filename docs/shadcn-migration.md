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

## Batas yang tetap terbuka

- Backend lokal tidak tersedia saat baseline. Prefix route harus diverifikasi dengan OpenAPI live sebelum mengubah request.
- Koordinat display, world point awal, dan reference/model ID pada Referensi Tanah memerlukan perbaikan integrasi terpisah.
- Depth scale, autentikasi URL artefak, dan polling belum dibuktikan oleh fixture UI.
- Keberhasilan kalibrasi hingga prediksi membutuhkan backend dan citra kalibrasi yang sah.
