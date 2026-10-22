# Plan integrasi dashboard: MediaMTX, capture kalibrasi, dan prediksi RTSP

Tanggal: 22 Oktober 2026. Status: **plan, belum diimplementasikan**.
Handoff saat ini hanya memperbarui `openapi.json` dan menambahkan plan ini.
Source dashboard, `DESIGN.md`, `AGENTS.md`, dan `.agents/plan.md` historis tetap dipertahankan.

## 1. Acuan dan batas pekerjaan

- Backend: `../sivera/api/main.py`, routes, schemas, services, tests, dan `../sivera/DESIGN.md`.
- Implementasi backend fase 1–2: `704c7d3`; fase 3–4: `b775270`.
- `openapi.json` dashboard identik dengan snapshot default backend. Live `/openapi.json` menjadi acuan deployment; default dapat berubah sesuai konfigurasi.
- Ekspor ulang dari root backend: `python api/scripts/export_openapi.py ../sivera-dashboard/openapi.json`. Exporter tidak membaca environment/`.env` deployment atau menghubungi layanan.
- Stack tetap Vue 3, TypeScript, Pinia, Axios, shadcn/vue, Vitest, Playwright, dan Bun sesuai `package.json`.
- Scope implementasi berikutnya: HTTP/types, stream/WHEP, capture/compute, snapshot, prediksi tiga sumber, polling/history, dan download terautentikasi. Bukan redesign landing page atau migrasi framework.
- Jangan memindahkan database, CV, undistortion, depth-scale calibration, ground mapping, atau volume calculation ke frontend. MediaMTX tetap `bluenviron/mediamtx:1.20.0-ffmpeg`, dikonfigurasi oleh backend/operator.

Dokumentasi dashboard lama tentang prefix tanpa `/api/v1`, RTSP belum tersedia, prediksi sinkron, dan scale dibuat saat prediksi sudah tidak berlaku. Saat implementasi dimulai, perbarui bagian kontrak `AGENTS.md`, `DESIGN.md`, README, dan fixture tests tanpa menghapus catatan historis.

## 2. Gap source yang perlu ditutup

| Source saat audit | Gap | Pekerjaan |
|---|---|---|
| `src/services/api.ts` dan seluruh domain services | Origin default `http://localhost:8000`, tetapi request masih `/cameras/...` | Gunakan `/api/v1/cameras/...` tepat sekali; `/health` dan `/files` tetap di luar prefix |
| `src/services/api.ts` | Error `{detail: {code, ...}}` tidak dinormalisasi; URL artifact tidak menjamin auth | Pertahankan code/field/session_id, fetch blob dengan header, validasi origin dan redirect |
| `src/types/index.ts` | Camera belum punya `rtsp_configured/stream_enabled`; intrinsics, capture, stream, snapshot, dan opsi job belum lengkap | Types sesuai OpenAPI, UUID string, nullable dan state terpisah |
| `src/lib/camera-form.ts`, `Cameras.vue` | RTSP readback diasumsikan tersedia | Input sumber replacement-only; field kosong saat edit tetap omitted, hapus sumber perlu aksi eksplisit |
| `src/services/predictions.ts` | Membuang `return_outputs=[]`; belum punya `max_frame_age_sec`; prerequisit hanya dua boolean | Bedakan omitted/list/empty; readiness parsial dan error per sumber |
| `src/views/Dashboard/Predictions.vue` | RTSP disabled; pilihan output berupa group yang tidak valid; output/image link biasa | Tiga sumber, pilihan tipe nyata, authenticated previews/downloads |
| `src/composables/useJobPolling.ts` | `any`, interval bisa overlap, error hanya ke console, lifecycle belum per koneksi | Poll typed tanpa overlap, abort/stale-response guard, error terlihat, cleanup |
| `src/services/calibrations.ts`, `Calibrations.vue` | Hanya upload/aktivasi; preview URL biasa | Capture workflow dan compute polling terpisah; fetch preview terautentikasi |
| `src/services/groundReferences.ts`, `GroundReferences.vue` | Model aktif dianggap bukti kesiapan | Bandingkan calibration/reference/model IDs; jangan menganggap depth scale tersedia |
| `e2e/fixtures/api.ts`, domain unit/e2e tests | Mock dapat menyembunyikan kontrak lama | Perbarui prefix, response/status, multipart, blob, dan state transitions |

## 3. Kontrak HTTP dasar

Simpan **origin backend**, misalnya `http://localhost:8000`, bukan origin dengan `/api/v1`. Gunakan satu helper path kamera yang menghasilkan `/api/v1/cameras/{camera_id}`. Jangan sekaligus menambah prefix pada base URL dan services. URL konfigurasi lama dengan prefix perlu validasi/migrasi yang terlihat, bukan menambah prefix kedua.

- Publik: `GET /`, `/health`, `/docs`, `/redoc`, `/openapi.json`.
- Seluruh operasi kamera dan `/files` memakai `X-API-Key`. Header hilang: 422; invalid/inactive: 401; scope atau akses kamera ditolak: 403.
- `/health` dapat memberi HTTP 200 dengan `{status: "degraded", database: "disconnected"}`. Healthy hanya membuktikan probe PostgreSQL, bukan key, broker, worker, MediaMTX, atau kamera.
- Error `detail`: string, object dengan `code`, atau validation list. Simpan machine code dan metadata aman (`field`, `session_id`) terpisah dari pesan Bahasa Indonesia. Network/CORS, auth, input, dan domain conflict tidak boleh semua dianggap "setup belum ada".
- Identitas kamera, calibration, ground/model, job, session, image, snapshot adalah UUID string. Capture response memakai `session_id`; submit prediksi memakai `job_id`; GET job memakai `id`.
- Browser `FormData` menentukan multipart boundary. Jangan hardcode `Content-Type: multipart/form-data`.
- `VITE_*` bukan secret storage. Jangan embed privileged key, RTSP URL/password, MediaMTX credentials, atau TURN secret permanen. Pemilihan BFF/secret handling produksi adalah keputusan deployment terpisah.
- Ganti origin/key/kamera: hentikan request/polling, tutup peer, bersihkan preview, dan abaikan response dari konteks lama. Menutup request HTTP tidak membatalkan job backend.

### Matriks endpoint

Semua path domain berikut relatif terhadap `/api/v1/cameras/{camera_id}`.

| Operasi | Scope | Request / response |
|---|---|---|
| `GET /stream` | `camera:read` | 200 `StreamResponse` |
| `PATCH /stream` | `camera:write` | JSON `{enabled: boolean}`, 200 desired state; lanjut GET untuk runtime |
| `OPTIONS /stream/whep` | `camera:read` | 204 capability headers; berbeda dari preflight CORS |
| `POST /stream/whep` | `camera:read` | `application/sdp`, 201 SDP answer + backend `Location`, `ETag`, opsional `Link` |
| `PATCH /stream/whep/{session_id}` | `camera:read`, key pemilik | `application/trickle-ice-sdpfrag`, `If-Match`; 204 atau 200 restart fragment |
| `DELETE /stream/whep/{session_id}` | `camera:read`, key pemilik | 204; session hilang/expired/key pemilik berbeda dapat 404 |
| `POST /calibration-captures` | `calibration:write` | JSON `CaptureCreate`, 202 `CaptureResponse` |
| `GET /calibration-captures/{session_id}` | `calibration:read` | 200 progress capture dan compute |
| `POST /calibration-captures/{session_id}/stop` | `calibration:write` | 200; dapat `stopping`, belum tentu sudah stopped |
| `POST /calibration-captures/{session_id}/compute` | `calibration:write` | 202; poll GET session yang sama |
| `GET /calibration-captures/{session_id}/images` | `calibration:read` | `offset=0`, `limit=20` (1..100), `{items,total}` |
| `GET /calibration-captures/{session_id}/images/{image_id}` dan `/preview` | `calibration:read` | JPEG original atau corners overlay |
| `POST /snapshots` | `camera:write` | Synchronous 201 `SnapshotResponse` |
| `GET /snapshots/latest` | `camera:read` | `max_frame_age_sec=30` (1..300), 200 metadata; tidak capture |
| `GET /snapshots/{snapshot_id}/image` | `camera:read` | JPEG; explicit ID tetap dapat diunduh saat sudah tua |
| `POST /predict` | `predict:write` | Multipart, 202 `PredictionJobSubmitResponse` |
| `GET /predict` | `predict:read` | `page=1`, `page_size=20` (1..100), opsional `status`; paginated jobs |
| `GET /predict/{job_id}` | `predict:read` | 200 persisted job/result/error |
| `GET /predict/{job_id}/outputs` | `predict:read` | `{outputs: [...]}` |
| `GET /predict/{job_id}/outputs/{output_type}` | `predict:read` | Binary image/JSON/NPZ dengan Content-Type aktual |
| `GET /predict/{job_id}/instances` dan `/volumes` | `predict:read` | Array, bukan wrapper `items` |

Kalibrasi existing: `/calibrations`, `/active`, `/{calibration_id}`, `/{calibration_id}/activate`, `/{calibration_id}/undistort-preview`, memakai `calibration:read/write`. Ground refs/models memakai `ground_ref:read/write`; jangan menambahkan endpoint depth scale, session list, prediction cancellation/deletion, atau snapshot history yang tidak ada.

## 4. Fase A: client, types, auth, dan blob

Target files: `src/services/api.ts`, domain services, `src/types/index.ts`, `src/lib/camera-form.ts`, serta tests.

- [ ] Tetapkan prefix sekali, URL origin validation, dan health/artifact path terpisah. Uji trailing slash dan konfigurasi tersimpan.
- [ ] Tambah Camera fields `rtsp_configured`, `stream_enabled`; `rtsp_url` response selalu null/deprecated. Preserve sumber unchanged pada PATCH; `rtsp_url:null` hanya untuk penghapusan yang dikonfirmasi.
- [ ] Type `StreamResponse`: `enabled`, `status=disabled|idle|online|offline|unknown`, `synced`, nullable `whep_url`, `tracks`, `checked_at`.
- [ ] Type calibration baru: nullable `k_original`, `k_undist`, `resolution_w/h`, `alpha`, `per_view_errors`; `k_matrix` tetap undistorted K, bukan original.
- [ ] Tambah capture/image/snapshot/job types lengkap, nullable metadata dan error; unknown wire state ditampilkan sebagai tidak dikenal, bukan diubah menjadi done.
- [ ] Normalize error object/list/string termasuk response blob yang ternyata JSON error. Jangan menampilkan detail internal atau membuang `code`.
- [ ] Buat helper authenticated blob/download; fetch hanya ke origin backend yang dikonfigurasi dan endpoint yang diizinkan. Jangan follow redirect lalu membocorkan key ke origin lain. Gunakan dedicated capture/snapshot/job-output URL bila tersedia.
- [ ] `URL.createObjectURL` hanya sesudah response sukses. Revoke pada replacement/unmount/change origin/key. Download melalui blob, bukan link jaringan tanpa header. Jangan render JSON dengan `v-html`.
- [ ] Jangan menebak filesystem path dari `source_path`/`file_path`/`calib_images`. Mereka storage keys. URL preview dari API perlu aturan trusted origin; signed external URLs membutuhkan desain terpisah tanpa mengirim application key.

Acceptance: semua domain calls berprefix benar, header tidak masuk query/source/log, error terstruktur tetap utuh, failed fetch tidak membuat preview palsu, object URLs tidak bocor.

## 5. Fase B: stream kamera dan lifecycle WHEP

Usulan files: `src/services/streams.ts`, `src/composables/useWhepPlayer.ts`, komponen player di `src/components/`, integrasi `Cameras.vue` dan ekspor `src/services/index.ts`.

- [ ] Bedakan desired `enabled`, config `synced`, runtime `status`, dan status peer/video browser. `idle` pada source on-demand bukan bukti offline; HTTP 201/`online` bukan bukti video sudah decoded.
- [ ] Enable/disable melalui PATCH lalu refresh GET. `whep_url` hanya dipakai setelah trusted-origin validation dan readiness signaling yang sesuai. Handle `stream_sync_pending`, `stream_disabled`, konfigurasi tidak lengkap.
- [ ] Buat `RTCPeerConnection` receive-only video; attach `ontrack` ke video `autoplay muted playsinline`. Browser codec/ICE dapat gagal walau signaling sukses.
- [ ] Pilih lifecycle WHEP yang mendukung ICE server `Link` (bila diperlukan, OPTIONS dulu), offer SDP, `setLocalDescription`, POST sekali, `setRemoteDescription`, serta candidate fragment yang valid. Jangan sekadar POST offer dan mengabaikan trickle candidates.
- [ ] Simpan backend `Location`, `ETag`, dan key pemilik dalam konteks player di memori. PATCH candidate/restart ke Location yang sama dengan content type benar dan If-Match sesuai protocol. Jangan membentuk session URL MediaMTX sendiri.
- [ ] Serialize PATCH, queue candidate sebelum session Location tersedia, dan perbarui ETag bila server mengembalikannya. Support 200 restart fragment/204, atau tampilkan reconnect eksplisit jika restart belum didukung.
- [ ] POST offer tidak di-retry otomatis. Tombol reconnect membuat peer/session baru setelah cleanup session lama; timeout POST dapat meninggalkan session yang akan dibersihkan server lewat TTL.
- [ ] Close: best-effort authenticated DELETE, tutup peer, lepas track/listener/video `srcObject`, abort request dan timers. Lakukan saat modal/route ditutup, kamera berubah, disable, atau origin/key berubah. Key cleanup harus key yang membuat session, bukan key baru dari localStorage.
- [ ] Bila key revoked/network putus/unload mencegah DELETE, jangan klaim cleanup sukses. Backend punya bounded TTL/reconciler; `sendBeacon` bukan pengganti auth header.

Acceptance browser nyata: video frame decoded, candidate/media reachable, codec didukung, kamera putus/reconnect terjelaskan, tidak ada peer/session bocor setelah navigasi. Media bergerak langsung MediaMTX -> browser, bukan melalui Python/Axios.

## 6. Fase C: capture kalibrasi, progress, dan compute

Usulan files: `src/services/calibrationCaptures.ts`, composable polling capture typed, integrasi `Calibrations.vue`; reuse UI dan upload service existing.

`CaptureCreate` JSON:

| Field | Default snapshot | Batas |
|---|---|---|
| `chessboard_cols`, `chessboard_rows` | 9, 6 inner corners | Integer 3..30 |
| `square_m` | 0.025 m | >0, <=1 |
| `interval_sec` | 2 s | 1..60, wait setelah attempt |
| `target_images` | 20 accepted frames | Integer 1..100 |
| `max_duration_sec` | 300 s | Integer 1..900, termasuk waktu antrean |
| `auto_calibrate` | false | Boolean; compute otomatis tidak mengaktifkan hasil |

- [ ] Mulai hanya dengan stream enabled; capture tidak butuh kalibrasi existing atau playback browser aktif. Target di bawah minimum compute (default 10) valid untuk capture, tetapi harus diberi peringatan bahwa compute akan kurang gambar.
- [ ] 202 = session tersimpan, bukan gambar sudah tersedia. Outbox capture/compute dapat pulih dari broker outage; jangan memulai session baru setiap kali progress masih queued.
- [ ] State capture: `queued -> running -> stopping`, terminal `completed|stopped|expired|failed`. Poll database response, bukan Celery API atau progress persen berbasis timer.
- [ ] State compute terpisah: `none|queued|running|done|failed`, dengan `compute_error_code`, timestamps, dan `result_calibration_id`. Tetap poll sampai kedua pekerjaan yang relevan selesai; terminal capture tidak berarti compute selesai.
- [ ] Tampilkan attempted, captured, accepted, rejected, failed_attempts, rejection_counts, dimensi, deadline, dan last_capture_at. Jangan memaksa attempted = captured + failed_attempts; interrupted attempts mungkin belum dikategorikan.
- [ ] `selection_version=1`: target accepted; `0`: legacy target stored, images dinilai saat compute. Maximum 300 gambar tersimpan termasuk rejected; `completed` berarti target capture tercapai saja.
- [ ] Pagination gambar memakai offset/limit, dedup ID/sequence. Preview/download fetch blob berheader; `chessboard_not_found`, `blur`, `similar_pose`, nullable sharpness/corners dan `unassessed` tetap dapat diperiksa.
- [ ] Arahkan operator memindahkan papan untuk variasi pose sambil menjaga fokus/zoom/posisi kamera. Corners dalam pixel original, square dalam meter. Quality thresholds bukan sertifikasi akurasi metrik.
- [ ] Stop menunggu state terminal, bukan langsung mengganti status lokal. Repeated stop pada terminal tidak membuang gambar.
- [ ] Konflik 409 `capture_already_active`: gunakan `detail.session_id` jika tersedia untuk resume; jika tidak, minta ID sesi yang pernah disimpan, bukan menebak/list endpoint.
- [ ] Simpan hanya origin/camera/session UUID untuk resume reload, lalu verifikasi GET dengan key sekarang. Tidak ada session-list endpoint; storage lokal bukan bukti server session masih ada.
- [ ] Compute manual hanya setelah capture terminal dan minimum usable views. queued/running/done tidak membuat hasil ganda; failed bisa diulang eksplisit. Auto compute berlaku pada completed/stopped/expired, bukan capture failed.
- [ ] Setelah compute done, fetch `result_calibration_id`, inspeksi RMS/per-view errors (px), coverage (%), dimensi, K asli/undistorted dan `is_active=false`, lalu aktivasi eksplisit memakai endpoint existing.
- [ ] Aktivasi me-refresh calibration dan readiness ground/depth; job lama tetap memakai pinned IDs. Jangan menganggap ground model/scale lama kompatibel setelah aktivasi.
- [ ] Pertahankan upload multipart `files` (repeated file field), `chessboard_cols`, `chessboard_rows`, `square_m`, `alpha`, `notes`: synchronous 201 dan auto-active. Jangan mengirim alpha/notes ke CaptureCreate yang `extra=forbid`.

Acceptance: rejected tetap terlihat, capture selesai tidak ditandai "kalibrasi berhasil", gagal compute tidak mengganti active calibration, stop/reload/409 resume aman, hasil compute baru aktif hanya setelah aksi operator.

## 7. Fase D: snapshot, koordinat ground, dan readiness parsial

Usulan files: `src/services/snapshots.ts`, types, integrasi Kamera/Referensi Tanah/Predictions seperlunya.

- [ ] Snapshot POST menghasilkan metadata `id`, `camera_id`, `width`, `height`, `captured_at`, `image_url`, `size_bytes`. Ia synchronous dan dapat timeout; jangan otomatis retry karena dapat menghasilkan snapshot kedua.
- [ ] Latest GET tidak mengambil frame baru. Handle `snapshot_not_found`, `snapshot_stale`, `snapshot_source_changed`, `snapshot_requires_enabled_stream`. Aksi "ambil snapshot" terpisah dari "lihat snapshot terakhir".
- [ ] Usia default 30 s, range 1..300; timestamp reception UTC, bukan sensor time. Explicit-ID image bisa lama; freshness metadata tidak menjamin masih fresh saat prediction worker berjalan.
- [ ] Capture calibration images bukan snapshot registry. Jangan memakai frame capture sebagai `latest_rtsp` secara implisit.
- [ ] Snapshot/WHEP/corner preview adalah original raw coordinates. Ground-reference `image_points` harus **undistorted**. Jangan menggambar point selector pada raw video/snapshot lalu mengirimnya sebagai undistorted.
- [ ] Endpoint `/{calibration_id}/undistort-preview` hanya menampilkan gambar kalibrasi pertama, bukan arbitrary scene/snapshot. Gunakan hanya bila adegan dan titik memang sesuai; jangan mengklaim ada API scene-undistortion yang belum tersedia. Jika point selection pada snapshot diperlukan, ajukan endpoint backend terfokus sebagai dependency, bukan algoritma frontend.
- [ ] Readiness precheck membaca active calibration, active ground reference/model dan membandingkan `calibration_id`, `ground_ref_id`, `camera_id`. Catch 404 sebagai setup missing; 401/403/network/5xx tetap error pemeriksaan.
- [ ] Depth scale status **belum dapat diperiksa melalui API publik**. Jangan membuat boolean "siap" hanya karena dua GET sukses. Tampilkan setup yang diketahui, compatibility mismatch, serta kebutuhan scale operator; submission backend tetap otoritatif.
- [ ] `prediction_requires_calibration`, `prediction_requires_ground_model`, `prediction_requires_depth_scale`, `calibration_intrinsics_missing`: tindakan setup/operator yang jelas. Legacy ground-model `/active` bukan readiness API lengkap.
- [ ] RTSP memerlukan original K dan dimensi kalibrasi; legacy null K memerlukan recalibration. Upload legacy tetap sudah-undistorted pada dimensi kamera; upload explicit K memakai raw image dengan dimensi kalibrasi, di-undistort tepat sekali oleh backend.

Acceptance: tidak ada klaim depth scale dibuat oleh prediction, tidak ada konversi koordinat diam-diam, tidak ada raw snapshot yang dianggap ready untuk ground-point selection.

## 8. Fase E: submit, polling, history, dan output prediksi

Target files: `src/services/predictions.ts`, `src/composables/useJobPolling.ts`, `src/views/Dashboard/Predictions.vue`, types dan output-preview helper.

- [ ] `upload`: wajib `file`; timestamp caller opsional. `rtsp_frame`/`latest_rtsp`: **tanpa file/timestamp**, termasuk timestamp yang tersisa ketika source selection berubah.
- [ ] `rtsp_frame` capture saat worker execute. `latest_rtsp` memilih ulang persisted snapshot fresh saat execute, tanpa fallback capture; bukan frame pada saat tombol ditekan.
- [ ] Multipart fields: `source_type`, `file`, `timestamp`, `seg_model`, `seg_conf` (0..1), `seg_classes`, `volume_cell_m` (>0..1 m), `volume_min_pts_per_cell` (1..10000), `max_frame_age_sec` (1..300), `return_outputs`.
- [ ] `seg_classes` dan `return_outputs` adalah **JSON-array strings**, bukan repeated fields/JSON body. Gunakan `!== undefined` untuk preserve empty array; `seg_conf=0` tetap dikirim.
- [ ] `seg_model` hanya nama file, bukan path; tidak ada API model catalog. Jangan menawarkan nama weights seolah sudah tersedia di deployment.
- [ ] Output selection: omitted = semua output terdaftar; `[]` = tidak ada download output; list = subset. Internal artifacts mungkin tetap dibuat dan summary/instances/volumes tetap dihitung.
- [ ] Tipe valid: `mask`, `overlay`, `instances_json`, `depth_raw_vis`, `depth_scaled_vis`, `depth_masked`, `height_map`, `lifted_points_npz`, `volume_heatmap`, `volume_result_npz`, `bev_image`, `bev_mask_proyeksi`, `bev_overlay`. Group label UI boleh memetakan ke subset ini, tetapi **jangan kirim** `segmentation`, `depth`, `bev`, `volume`, `instances`.
- [ ] 202 menyimpan `job_id`, kemudian poll `pending|processing|done|failed`. `estimated_duration_sec=30` adalah advisory tetap, bukan measured progress/countdown/SLA. Submit error tidak boleh membuat job "processing" lokal palsu.
- [ ] No automatic POST retry: broker/submission failure atau network timeout bisa meninggalkan failed/pending job. Refresh persisted history sebelum operator memutuskan submit ulang; prediction tidak mempunyai outbox auto-resume/cancellation API.
- [ ] Poll request tidak overlap. Abort dan stale-context guard; transient failure menunjukkan "status belum dapat diperbarui", bukan mengubah job menjadi failed. Stop pada done/failed; pause/backoff saat hidden/offline dan resume dengan GET. Hindari log payload/credential.
- [ ] History GET per kamera mengisi halaman dengan backend pagination/status filter dan resume job pending/processing setelah reload. Jangan mengambil job dari kamera/key/origin lama.
- [ ] Done: fetch registered outputs, instances, volumes; render hanya yang benar-benar tersedia. `return_outputs=[]` adalah hasil sah, bukan otomatis job failed. Requested output bisa tetap tidak tersedia bila pipeline tidak menghasilkan artifact.
- [ ] Image/JSON/NPZ download lewat endpoint output terautentikasi; Content-Type aktual menentukan renderer. Jangan memakai `file_path` sebagai direct URL. Jangan menyebut live/latest preview sebagai frame job tertentu tanpa identitas artifact yang membuktikannya.
- [ ] Preserve pinned `calibration_id`, `ground_model_id`, `depth_scale_id`, source_type/source_ts dan timestamps. Display null/unavailable sebagai tidak tersedia, bukan 0. Volume m³/L, footprint m², height m; `convex_hull` = area footprint hull 2D × median height, bukan hull volume 3D. BEV bukan rekonstruksi 3D penuh.

Acceptance: ketiga source tersubmit sesuai kontrak, empty selection tetap empty, freshness/source failure terlihat, job history/polling persisted, missing measurements tetap missing.

## 9. Pengujian implementasi frontend (belum dijalankan)

### Unit/component

- Prefix/origin/trailing slash; `/health` degraded; header auth dan error string/object/list/blob; untrusted URL/redirect tidak menerima key; object URL revoke.
- Camera edit tidak menghapus sumber unchanged; source removal eksplisit; RTSP URL tidak tampil/log/readback.
- WHEP fake peer: offer POST sekali, candidate buffering/serialization, Location/ETag/If-Match, 200/204 PATCH, ownership key cleanup, timeout/reconnect/unmount/late response.
- Capture defaults/ranges, 202/409 resume, independent statuses, accepted/rejected/legacy counters, offset pagination, stop, auto/manual compute, min images, inactive result/activation.
- Snapshot 201/latest missing/stale/source changed, explicit-ID old image, timestamp label dan source context.
- Prediction FormData untuk tiga sumber, zero confidence, omitted/[]/subset output, invalid group protection; readiness mismatch/unknown depth/error, poll no overlap/error/terminal/reload; nullable result/units.

### Playwright dan integrasi nyata

- Update `e2e/fixtures/api.ts` agar mengikuti kontrak, bukan membuat stale requests tampak berhasil. Mock tests memverifikasi frontend flow, bukan bukti video/inference nyata.
- Capture -> accepted/rejected preview -> stop/complete -> compute queued/running/done -> inspect -> activate, termasuk reload dan failed compute.
- Upload/rtsp_frame/latest_rtsp -> 202 -> poll -> history -> authenticated output/empty outputs, missing prerequisit, expired snapshot, queue failure.
- Dengan disposable backend terkonfigurasi: auth/scopes dan request/response sesuai live OpenAPI. Jangan memakai environment test yang menunjuk database/worker pengguna.
- Browser nyata pada jaringan deployment: decoded video/ICE/codec, reconnect setelah kamera/MediaMTX putus, cleanup saat close/route/key change, HTTPS/CORS/TURN bila diperlukan. HTTP SDP 201 saja tidak memenuhi acceptance playback.
- Uji keyboard, focus, dialog close, loading/error/empty, dan ukuran mobile mengikuti arah `DESIGN.md` existing. Tidak ada visual redesign dalam handoff ini.

Commands yang tersedia di `package.json`, jalankan pada implementasi frontend nanti:

```bash
bun run type-check
bun run test:unit --run
bun run build
bun run test:e2e
```

## 10. Dependency deployment dan batas keamanan

- Database harus revision `005_capture_quality_snapshots`, writable storage yang sama untuk API dan tiga worker, Redis, MediaMTX credentials/allowlist, stable non-default `SECRET_KEY`, CORS origin/HTTPS dan ICE reachable. Production harus override Compose API `DEBUG=true`.
- Database pengguna telah direset sebelumnya dengan izin terpisah; `waste-postgres` masih stopped karena host port 5432 dipakai PostgreSQL lain. `.env` yang diperiksa belum punya MediaMTX passwords. Ini blocker deployment, bukan izin reset/restart baru.
- Tidak ada depth-scale provisioning/readiness API. Provisioning dan verifikasi scale adalah dependency operator/backend; dashboard tidak bisa menutup gap ini sendirian.
- Legacy gaps backend: ground-reference/model belum memeriksa camera-bound key restrictions, database-key `expires_at` belum enforced, dan generic `/files` fallback belum scoped/registered untuk semua key shape. Jangan mengklaim tenant isolation atau expiry enforcement; perbaikan terfokus diperlukan sebelum multi-tenant release.
- Kamera asli, browser media/ICE/reconnect, actual segmentation/depth weights/GPU, TLS/TURN, dan deployment penuh belum diverifikasi. Retention/physical orphan cleanup adalah tanggung jawab operator.

## 11. Completion gate dan handoff

- [ ] Fase A selesai sebelum media/capture/prediction UI diaktifkan.
- [ ] Semua types, paths, multipart dan state mengikuti snapshot/live contract; dokumentasi lama diselaraskan.
- [ ] Semua tests frontend di atas, type-check, build, dan browser evidence tercatat; tidak melaporkan mock playback sebagai video nyata.
- [ ] Bekas peer, timers, requests, key context, dan blob URLs dibersihkan; tidak ada secret dalam bundle/log/URL.
- [ ] Depth readiness, coordinates, incomplete deployment dan security gaps tetap terlihat; tidak ada status/volume yang dikarang.

Plan ini dapat diterapkan bertahap A -> B/C -> D -> E; acceptance tiap fase menjadi syarat fase berikutnya. Handoff tidak menjalankan build/browser frontend karena belum mengubah implementasi dashboard.
