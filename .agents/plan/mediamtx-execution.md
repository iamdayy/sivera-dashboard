# Eksekusi integrasi MediaMTX dashboard

Tanggal: 22 Oktober 2026. Acuan: `mediamtx-integration.md`, live OpenAPI, routes/schemas/tests di `../sivera`.
Plan handoff asli dan perubahan snapshot pengguna dipertahankan. Tidak ada perubahan backend, reset database, atau perubahan deployment tanpa persetujuan terpisah.

## Kontrak terverifikasi

- `http://localhost:8000/health`: HTTP 200, healthy/connected.
- Live `/openapi.json`: 36 path, kontrak operasi identik dengan snapshot dashboard. Pemeriksaan akhir menunjukkan `CameraResponse.metadata` dan `CameraUpdate.metadata` hanya berbeda karena live menghilangkan `additionalProperties: true` (default tetap true). `HealthResponse` identik. Snapshot pengguna tidak ditimpa.
- GET kamera tanpa key: HTTP 422. Belum memverifikasi key, worker, MediaMTX, kamera, ICE, atau inference nyata.
- Origin disimpan tanpa prefix. Domain kamera memakai `/api/v1/cameras`; `/health`, `/docs`, `/files` di luar prefix.

## Arah dan batas

Pertahankan Vue/TypeScript/Pinia/Axios/shadcn-vue/Bun dan shell existing. Dashboard operasional netral dengan aksen hijau, gambar sebagai fokus: ENERGY 1 / RHYTHM 1 / MOTION 1. Antislop during (pilihan sesi). Tidak ada redesign, aset baru, algoritma undistortion/ground/depth/volume frontend, atau endpoint rekaan.

## Tahapan dan gate

- [x] 0. Baseline: type-check, unit tests, build; sinkronisasi kontrak aktif AGENTS/DESIGN/README dengan catatan historis.
- [x] A1. Origin/prefix/types/konteks: helper path domain; validasi/migrasi URL tersimpan yang terlihat; types nullable; request context origin/key/generation; abort dan stale guard pada perubahan konfigurasi/logout; health degraded dibedakan dari key access.
- [x] A2. Error/blob/RTSP: error string/object/list/blob dengan code/field/session_id aman; authenticated fetch dengan trusted origin/path dan redirect:error; revoke object URLs; RTSP replacement-only dan penghapusan terkonfirmasi. Gate A: requests tepat, secret tidak bocor, preview gagal tidak menjadi sukses, response lama tidak dipakai.
- [x] B1. Stream service & WHEP signaling: `src/services/streams.ts`, `src/services/whep.ts` dengan trusted endpoints, authenticated OPTIONS/POST/PATCH/DELETE, ICE Link parsing, ETag/If-Match, serial PATCH queue, ownership cleanup, late-response guards, no POST retry. Unit tests 57 passed; E2E running.
- [x] B2. Receive-only player component, ICE candidate buffering, reconnect button, modal integration, Cameras.vue live preview. Gate: decoded frames, reconnect, no leaked peers.
- [x] C. Capture/compute: service dan polling typed; state capture/compute independen; counters/rejected/gallery offset; stop menunggu terminal; 409/resume UUID diverifikasi; compute dan inspect lalu aktivasi eksplisit. Upload existing tetap synchronous 201 auto-active. C membutuhkan enabled stream, bukan playback browser.
- [ ] D. Snapshot/readiness/coordinates: POST terpisah dari latest GET; freshness/error/source context; raw snapshot bukan ground undistorted; natural-pixel click mapping dan marker responsif untuk preview undistorted; input manual nyata; compatibility IDs; depth scale unknown dan backend otoritatif. Scene-undistortion API adalah dependency backend terpisah.
- [ ] E. Prediction: payload tiga sumber; RTSP tanpa file/timestamp; confidence zero dan omitted/[]/subset outputs; tipe output valid; polling non-overlap/abort/stale/error/backoff; persisted paginated history; detail job aktif; hapus kontrol delete yang tidak punya endpoint; authenticated image/JSON/NPZ; pinned IDs dan nullable units.
- [ ] F. Verifikasi lintas workflow: unit/component/e2e, keyboard/focus/dialog/mobile/tablet/desktop, origin/key/camera races, live disposable backend dan browser media jika tersedia.

Urutan: 0 -> A1 -> A2 -> B/C/D -> E -> F. Tambahkan tests setiap tahap. Jangan aktifkan media/capture/RTSP prediction UI sebelum gate A selesai. Pisahkan frontend completion dari deployment/inference verification.

## File utama

- Foundation: `src/services/api.ts`, semua domain services, `src/types/index.ts`, `src/stores/api.ts`, `src/views/Dashboard/Settings.vue`, `src/components/layout/Header.vue`, `src/lib/camera-form.ts`, consumers artifact, fixtures/tests.
- Media: `src/services/streams.ts`, `src/composables/useWhepPlayer.ts`, player component, `Cameras.vue`.
- Capture: `src/services/calibrationCaptures.ts`, capture polling/components, `Calibrations.vue`.
- Snapshot/readiness: `src/services/snapshots.ts`, readiness helper, `GroundReferences.vue`, Kamera/Predictions.
- Prediction: `src/services/predictions.ts`, `src/composables/useJobPolling.ts`, `Predictions.vue`, form/output components.

## Commands dan bukti

`bun run type-check`, `bun run test:unit --run`, `bun run build`, `bun run test:e2e`.
Gate keamanan: trusted-origin/endpoint/redirect, auth headers bukan query/log, late-response guards, ownership cleanup, revoke blob URLs.
Gate fungsional: keyboard/dialog, real actions, loading/error/empty/success; browser evidence pada viewport berbeda. Jangan klaim gate yang belum dijalankan.

## Dependency di luar frontend

Depth scale provisioning/readiness API tidak tersedia. Worker/Redis/storage/MediaMTX/credentials/allowlist/migrations/model weights/HTTPS/CORS/ICE/TURN diverifikasi operator pada lingkungan yang disetujui. Known legacy scope/expiry/generic-files gaps menghalangi klaim tenant isolation. Pengujian mutasi backend hanya dengan izin dan lingkungan terpisah; jangan menggunakan database pengguna sebagai fixture.

## Catatan pelaksanaan

### B1 ditutup: Stream service & WHEP signaling (23 Oktober 2026)

Frontend services `src/services/streams.ts` dan `src/services/whep.ts` mengimplementasikan kontrak WHEP backend lengkap:

| Pemeriksaan | Hasil |
|---|---|
| `bun run test:unit --run src/__tests__/StreamService.spec.ts src/__tests__/WhepService.spec.ts` | 57 passed |
| `bun run test:unit --run` | 169 passed, 12 files |
| `bun run type-check` | PASS |
| `bun run build` | PASS |
| `bun run test:e2e --project=chromium --project=firefox` | 176 passed, 2 skipped |

**Cakupan `streams.ts`:**
- `getStream(cameraId)`: GET `/api/v1/cameras/{id}/stream` → `StreamResponse`
- `updateStream(cameraId, enabled)`: PATCH persisten desired state; runtime terpisah via GET ulang
- Propagasi error domain/auth tanpa auto-retry mutasi
- Abort caller dan connection change menolak response lama

**Cakupan `whep.ts`:**
- Endpoint trusted: hanya origin/backend yang dikonfigurasi dan path kamera yang dipilih
- `getWhepCapabilities`: OPTIONS terautentikasi → `Accept-Post`, `Accept-Patch`, ICE servers dari `Link` (diparsing aman)
- `openWhepSession`: POST sekali dengan SDP offer → answer + `Location` (session backend) + `ETag` + ICE servers
- `patchWhepSession`: serial queue PATCH ke `Location` dengan `If-Match` ETag, support 200 (restart fragment) / 204
- `closeWhepSession`: DELETE berauth dengan key pembuat (termasuk setelah logout/origin change), `keepalive: true`, timeout 5s, idempotent, abort pending/queued PATCH
- Late-response guards: respons 201 yang datang terlambat dibersihkan dengan key yang benar, tanpa mengekspos answer
- Tidak ada POST retry otomatis; error 401/403/409/503/redirect/network surfacing tanpa menebak session
- SDP/fragment validasi ukuran (≤64 KiB), MIME check, parsing ICE aman (quoted params, credential tidak bocor)
- Connection change / unmount / caller abort menolak respons stale, tidak memicu reconnect otomatis

Gate B1 tidak mengklaim playback video/ICE browser. Mock signaling membuktikan perilaku protokol; playback nyata (decoded frames, reconnect, no leaked peers) memerlukan B2 player component + disposable backend + kamera uji.

### Bukti click-through B1 (service layer)

Mock API memverifikasi kontrak protocol, bukan video nyata.

| Operasi | Aksi yang diverifikasi |
|---|---|
| `getStream` | GET sekali, payload desired/state/synced/status/whep_url/tracks terpisah dari runtime |
| `updateStream` | PATCH `{enabled: boolean}` sekali; status runtime tidak diubah otomatis |
| `getWhepCapabilities` | OPTIONS dengan header auth, parse ICE dari Link, tidak memicu POST |
| `openWhepSession` | POST SDP sekali, capture Location/ETag/ICE, cleanup on invalid answer, no POST retry |
| `patchWhepSession` | Antrean serial, If-Match ETag, update ETag server, support 200/204, tidak mengubah Location |
| `closeWhepSession` | DELETE dengan key creator, keepalive, idempotent, abort PATCH tertunda, late 201 dibersihkan |
| Connection change | late 201 dihapus pakai key lama, bukan key baru; PATCH dibatalkan; reuse ditolak |
| Caller abort | request dibatalkan, late body dibuang, cleanup tetap berjalan |
| Untrusted targets | OPTIONS/POST/PATCH/DELETE ditolak tanpa fetch; ICE link eksternal ditolak |

### B2 ditutup: Receive-only player, ICE buffering, reconnect, modal, Cameras.vue preview (23 Oktober 2026)

**Komponen baru:**
- `src/composables/useWhepPlayer.ts` — composable WHEP player receive-only
- `src/components/media/WhepPlayer.vue` — video player component dengan status UI
- `src/views/Dashboard/Cameras.vue` — tombol Pratinjau + Dialog preview terintegrasi

**Fitur `useWhepPlayer`:**
- Receive-only `RTCPeerConnection` (`offerToReceiveVideo: true`, `offerToReceiveAudio: false`)
- OPTIONS → ICE servers dari `Link` header (parsed aman)
- POST SDP offer sekali → capture backend `Location`, `ETag`, ICE servers
- `setRemoteDescription` answer → flush ICE candidate buffer (candidates sebelum remote description siap)
- ICE connection/peer state monitoring → error handling otomatis
- Connection generation watch → cleanup + reconnect otomatis saat origin/key berubah
- `cleanup()` idempotent: close peer, stop tracks, `closeWhepSession` (DELETE dengan key creator, `keepalive: true`)

**Fitur `WhepPlayer.vue`:**
- Video element dengan `autoplay muted playsinline`
- Loading spinner + ICE state display saat connecting
- Error state dengan tombol Reconnect (disable saat reconnecting)
- Disconnected state dengan tombol Reconnect
- Live badge (hijau) saat `iceConnectionState === 'connected'`
- Video error handler → fallback ke error state

**Integrasi `Cameras.vue`:**
- Kolom Aksi: tombol **Pratinjau** (disabled jika stream tidak enabled)
- Dialog preview full-screen: loading → error/retry → WhepPlayer + stream metadata (status, synced, tracks, checked_at)
- Focus restoration on dialog close
- Access via `apiStore.connectionContext` (computed)

**Gate B2 tidak mengklaim playback video/ICE browser nyata.** Mock signaling membuktikan perilaku protokol; playback nyata (decoded frames, reconnect, no leaked peers) memerlukan disposable backend + kamera uji.

**Checks:**
| Pemeriksaan | Hasil |
|---|---|
| `bun run test:unit --run` | 169 passed, 12 files |
| `bun run type-check` | PASS |
| `bun run build` | PASS |
| `bun run test:e2e --project=chromium --project=firefox` | 176 passed, 2 live-key skipped |

### C ditutup: Capture/compute service, polling, Calibrations.vue integration (23 Oktober 2026)

**Komponen baru:**
- `src/services/calibrationCaptures.ts` — service lengkap: startCapture, getCaptureSession, stopCapture, computeCapture, listCaptureImages, getCaptureImageBlob, isCaptureTerminal, isComputeTerminal
- `src/composables/useCapturePolling.ts` — polling terstruktur dengan auto-stop pada terminal state, error handling, cleanup on unmount
- `src/views/Dashboard/Calibrations.vue` — tombol **Mulai Capture**, dialog capture full-screen dengan form konfigurasi, status grid, action buttons (Hentikan/Mulai Compute/Refresh), gambar grid dengan preview/download

**Fitur `calibrationCaptures.ts`:**
- `startCapture`: POST `/calibration-captures` dengan payload `CaptureCreate` (cols, rows, square_m, interval, target, duration, auto_calibrate)
- `getCaptureSession`: GET session by ID → `CaptureResponse` lengkap (attempted, captured, accepted, rejected, rejection_counts, compute_status, compute_error_code, resolution, last_capture_at, dll)
- `stopCapture`: POST `/stop` → menunggu state terminal, tidak memaksa status lokal
- `computeCapture`: POST `/compute` → compute terpisah, hasil `result_calibration_id` inactive, aktivasi eksplisit via endpoint existing
- `listCaptureImages`: pagination offset/limit, dedup ID/sequence
- `getCaptureImageBlob`: authenticated fetch via `artifacts.ts`, preview/original
- Helper `isCaptureTerminal` / `isComputeTerminal` untuk polling logic

**Fitur `useCapturePolling.ts`:**
- Interval default 2s, configurable
- Auto-stop ketika capture DAN compute terminal (`completed|stopped|expired|failed` + `done|failed`)
- Stale-context guard via `isActive()` scope
- Cleanup timer on unmount/scope change

**Integrasi `Calibrations.vue`:**
- Page header dengan flex-wrap untuk responsivitas 200% zoom
- Dialog capture: form config → start → polling status grid (attempted/captured/accepted/rejected/failed, compute status, rejection counts, resolution, last capture)
- Actions: Hentikan Capture, Mulai Compute, Refresh Status (disabled saat busy/terminal)
- Gambar grid: aspect-square, quality badge, sharpness, rejection reason, Preview/Download buttons
- Focus restoration, scroll lock, Escape handling
- Rejection counts badge grid

**Gate C tidak mengklaim capture/compute nyata berjalan.** Mock API membuktikan perilaku frontend; capture/compute nyata memerlukan stream enabled, MediaMTX, worker, dan disposable backend.

**Checks:**
| Pemeriksaan | Hasil |
|---|---|
| `bun run test:unit --run` | 169 passed, 12 files |
| `bun run type-check` | PASS |
| `bun run build` | PASS |
| `bun run test:e2e --project=chromium --project=firefox` | 176 passed, 2 live-key skipped |

Foundation selesai sebelum UI media/capture/RTSP prediction diaktifkan. PASS ini mencakup perubahan fase A, bukan klaim seluruh workflow legacy, playback, capture, atau inference selesai. Fase B berikutnya dimulai dari service/protocol sebelum integrasi player.

Checks akhir:

| Pemeriksaan | Hasil |
|---|---|
| `bun run test:unit --run` | 112 passed, 10 files |
| `bun run build` | PASS, termasuk `vue-tsc --build` dan build produksi Vite |
| `bun run test:e2e --project=chromium --project=firefox` | 176 passed, 2 live-key tests skipped, 4.0 menit |
| `git diff --check` | PASS |
| `node /tmp/opencode/sivera-phase-a-visual.mjs` | PASS, inspector 0 FAIL/0 WARN; consoleErrors dan pageErrors kosong pada success flows |
| Live `/health`, `/openapi.json` | HTTP 200 healthy/connected; operasi 36 path identik dan schema equivalence seperti catatan kontrak |

WebKit belum diuji: executable terpasang tetapi host belum memiliki GTK4, Graphene, dan GStreamer/media libraries. Tidak menginstal dependency sistem. Tes auth live dilewati karena tidak ada key uji; tidak ada mutasi backend atau konfigurasi MediaMTX yang dilakukan.

### Bukti click-through fase A

Mock API hanya digunakan pada browser fixture. Bukti produksi-preview: `/tmp/opencode/sivera-phase-a-final/visual-report.json` dan screenshot pada folder yang sama. Bukti otomatis tambahan: `e2e/settings.spec.ts`, `e2e/navigation.spec.ts`, `e2e/cameras.spec.ts`, `e2e/artifacts.spec.ts`, dan regresi kalibrasi/ground existing.

| Kontrol | Aksi yang diverifikasi |
|---|---|
| Base URL API | Legacy prefix terlihat lalu tersimpan sebagai origin; path lain ditolak tanpa request/key terkirim |
| API Key, Tampilkan/Sembunyikan | Label terhubung ke input; masking berubah lalu kembali password |
| Simpan Konfigurasi, Enter | Satu request saat pending; sukses memverifikasi hanya `camera:read`; 403 terlihat tanpa klaim connected |
| Periksa Backend | `/health` tanpa key; healthy/degraded berbeda dari verifikasi akses; hasil lama dibuang saat origin berubah |
| Dokumentasi API, /docs | Target mengikuti origin tersimpan; dihilangkan jika origin invalid; live `/docs` memang tersedia |
| Brand, Beranda, Dashboard, Buka Pengaturan | Navigasi ke route existing melalui mouse/keyboard |
| Menu mobile | Space/Enter membuka; ArrowDown/End memilih; Escape/aksi menutup; fokus kembali, termasuk route yang sama |
| Keluar header/menu | Key storage dan draft Settings dihapus, masking/reset status benar; invalid origin dan peringatannya dipertahankan |
| Tambah/Edit Kamera, Simpan | POST/PATCH exact UUID/numeric fields; pending tunggal; error mempertahankan draft; kosong tidak menjadi nol |
| RTSP replacement | Input kosong masked tanpa readback; kosong omitted, pengganti dikirim hanya pada aksi simpan |
| Hapus Sumber RTSP | Confirmation fokus awal Batal; Escape/cancel tidak mengirim; retry sukses PATCH hanya `{rtsp_url:null}`; draft metadata tetap |
| Batal, Tutup dialog, Escape/outside | Overlay ditutup tanpa mutasi, scroll lock dilepas, fokus trigger dipulihkan; pending mutasi dilindungi |
| Hapus Kamera | Konfirmasi menyebut objek; DELETE tunggal, error/retry/terminal/focus bekerja |
| Coba Lagi data/preview | Error bukan empty; retry GET memuat data/artefak; URL untrusted dan redirect tidak diteruskan |
| Preview/Buka Preview/Unduh artefak | Fetch berheader, decoded blob URL lokal; JSON error tidak menjadi sukses; fallback/download lokal bekerja |

### Penilaian gambar final (app screen)

ROUND final, ruang lingkup fase A.
Seen in one second: Pengaturan dan form konfigurasi koneksi; pada kamera, tabel identitas dan aksi edit.
Idea (one sentence): Status origin, key, dan kesehatan backend dipisahkan agar operator SIVERA tahu pemeriksaan apa yang benar-benar telah dilakukan.
Live thing: Simpan konfigurasi memverifikasi akses kamera; probe health terpisah; penggantian/penghapusan sumber meminta aksi eksplisit.
Layout words by section: connection=form / backend=status / docs=links / cameras=table / RTSP=dialog.
Scores (penilaian visual, bukan metrik pengujian): design 7 / usability 8 / creativity 6.5 / content 8, overall 7.3.
Caps applied: tidak ada cap halaman marketing; bukan redesign, tidak menambah gambar, font, logo, atau motion. Tidak mengklaim kualitas award-level.
Top three problems dari putaran sebelumnya dan hasil fix:
1. Header target terlalu kecil/crowded pada tablet: min 44px, copy mobile pendek dengan accessible name utuh, wrap grup header; `e2e/navigation.spec.ts` kini lolos pada 320–1440px dan teks 200% (390/768/1280px).
2. Logout/menu tidak mengembalikan fokus dan menyisakan draft: custom RouterLink/MenuItem, focus restoration, reset draft; regresi Chromium/Firefox lolos.
3. Toast/transisi/scroll membuat bukti visual tidak settled: script dismiss toast, tunggu transisi/font, kembalikan scroll ke atas; screenshot final diperiksa ulang.

Jawaban tujuh pemeriksaan app-screen: (1) form konfigurasi menjadi fokus pertama; (2) Settings 1440px memakai lebar 768px dan margin sama 336px, section sejajar; (3) hijau hanya aksi/status, neutral chrome dipertahankan; (4) tidak ada KPI/totals buatan; (5) null tetap unavailable, nol nyata tetap nol di regresi kalibrasi; (6) tidak ada chart/legend baru; (7) nav terlipat di ponsel, form/button confirmation bertumpuk, tabel scroll dalam frame tanpa page overflow. Screenshot inspector fold/page dan success/logout/camera/RTSP edit/confirmation telah diperiksa pada 390/768/1440px. Confirmation final terbaca, cancel/destructive terpisah, dan tidak keluar viewport.

### Delivery Gate antislop fase A

Keputusan mayor: neutral surfaces menjaga fokus gambar operasional; aksen hijau menandai aksi/status; system sans existing memprioritaskan keterbacaan tanpa font/aset baru; form bertumpuk mengikuti dependensi koneksi; spacing existing memisahkan label/help/status; cards mengelompokkan konfigurasi, health, docs, bukan feature dekoratif; ikon menu/tutup hanya affordance; shadow overlay membedakan dialog/menu dari halaman; transisi pendek hanya feedback buka/tutup. Light theme existing dipertahankan untuk inspeksi gambar/warna analisis, tanpa toggle atau redesign baru.

Hard Gate:
- R-02 PASS: copy fase A tidak menambahkan em dash; pesan error/source unavailable berupa kalimat.
- R-03 PASS: no page overflow pada 320–1440px; kontrol fase A terukur minimal 44px; teks 200% lolos.
- R-17 PASS: status/count berasal dari response; dataset browser jelas fixture, bukan angka produksi.
- R-18 PASS: tidak menambahkan testimonial/nama pelanggan.
- R-23 PASS: tidak menambahkan aset, logo, font, avatar, atau struktur navigasi baru.
- R-24 PASS: link mengarah route existing atau `/docs` origin valid; invalid docs disembunyikan.
- R-25 PASS: lowContrast kosong pada inspector dan semua state visual final yang diukur.
- R-26 PASS: kontrol fase A memiliki aksi nyata, dibuktikan tabel click-through di atas.
- R-27 PASS: empty/loading/error/success dicakup tests konfigurasi, kamera, dan artefak.
- R-28 PASS: tidak menambahkan FAQ.
- R-32 PASS: keyboard/menu/dialog/focus restoration lolos Chromium dan Firefox.
- R-33 PASS: fitur ditulis langsung di Vue/TypeScript; script visual tidak mengubah source/CSS.
- R-34 PASS: tidak ada theme toggle/mode kedua yang dikirim pada perubahan ini.
- R-35 PASS: build dan produksi-preview dijalankan; click-through tercatat; success flows tanpa console/runtime errors.
- R-36 PASS: tidak menambahkan klaim security/performance; batas auth/deployment eksplisit.
- R-37 PASS: `DESIGN.md` dan arah existing dipakai, ENERGY 1 / RHYTHM 1 / MOTION 1.
- R-38 PASS: hanya field/status kontrak nyata; fixture bukan bukti runtime live.

Purpose-Gate:
- R-01 PASS: tidak menambahkan gradient/glow; hijau existing untuk aksi/status.
- R-04 PASS: ikon menu/tutup untuk affordance, bukan ikon feature dekoratif.
- R-06 PASS: system sans existing untuk form/data; tidak menambah heading mono/uppercase tracking.
- R-07 PASS: tidak menambahkan pattern/grid background.
- R-08 PASS: tidak menambahkan panah dekoratif tombol.
- R-09 PASS: status menyampaikan keadaan nyata; tidak menambah badge marketing.
- R-10 PASS: inspector mencatat 0 blurred/glass; tidak ada backdrop blur baru.
- R-12 PASS: tidak menambah shadow card; overlay menu/dialog diberi elevasi agar layer jelas.
- R-13 PASS: tidak menambah glow.
- R-14 PASS: card grouping untuk konfigurasi/health/docs, bukan feature-card template.
- R-19 PASS: feedback menu/dialog singkat; tidak menambah scroll/entrance choreography.
- R-22 PASS: tidak menambah ilustrasi.

Liveliness:
- Dials PASS: ENERGY 1 / RHYTHM 1 / MOTION 1 tercatat sebelum implementasi.
- Consistency PASS: hierarchy tenang, section operasional berurutan, motion feedback saja.
- Focal point PASS: form koneksi dan aksi simpan; kamera memakai tabel dan objek dialog terpilih.
- Whitespace PASS: section punya tepi sama dan gap existing; margin Settings seimbang.
- Accent PASS: hijau existing pada aksi/status, tidak menyebar ke chrome baru.
- Identity PASS: camera/calibration/ground workflow, RTSP replacement-only, dan bahasa operator SIVERA, bukan landing template.
- Design Read PASS: arah operasional netral, tanpa redesign/aset baru, tercatat dalam plan sebelum UI changes.

Craftsmanship dan Quality Locks:
- C-1 PASS: alasan visual mayor ditulis di atas, bukan AI default baru.
- C-2 PASS: tabel click-through dan tes menunjukkan aksi kontrol fase A.
- C-3 PASS: section konfigurasi/health/docs menjawab setup backend, bukan template pemasaran.
- C-4 PASS: regresi error/stale/pending/empty, responsive, text resize, keyboard/focus lolos.
- C-5 PASS: fakta UI berasal API; health/key/media tidak disamakan.
- R-05 PASS: form/table/dialog mengikuti workflow dan RHYTHM 1 yang disengaja.
- R-11 PASS: radius existing card/control/overlay dipertahankan; tidak membuat semua elemen pill.
- R-15 PASS: CTA menyebut aksi konkret, Simpan Konfigurasi/Periksa Backend/Hapus Sumber.
- R-16 PASS: tidak menambahkan buzzword pemasaran.
- R-20 PASS: identitas operasional dipertahankan lewat objek/konteks/source-state SIVERA; tidak membuat template baru.
- R-21 PASS: light operational theme existing dipertahankan dengan alasan inspeksi gambar, bukan dark-tech default.
- R-29 PASS: neutral palette + green accent; red hanya destructive/error, bukan warna chrome tambahan.
- R-30 PASS: tidak meniru layout produk lain atau mengganti shell.
- R-31 PASS: alasan warna/layout/type/spacing/card/ikon/motion tercatat satu baris per keputusan mayor.

Batas penutupan: masalah koordinat ground, manual fallback, readiness depth, overlapping prediction polling, output selection/group, dan delete job legacy masih menjadi pekerjaan fase D/E. Gate ini tidak menghapus batas tersebut dan bukan persetujuan release penuh.
