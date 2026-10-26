# SIVERA Dashboard — Design Specification

## 1. Purpose and boundaries

SIVERA Dashboard is the web client for SIVERA, a computer-vision system for waste segmentation, monocular depth estimation, ground-plane mapping, Bird's Eye View (BEV) visualization, and waste-volume estimation.

This repository (`iamdayy/sivera-dashboard`) owns the user interface only. The backend lives in `iamdayy/sivera` and is accessed over HTTP. Do not duplicate backend algorithms, database logic, or storage implementation in the frontend.

## 2. Existing technology

Use the stack already present in `package.json`:
- Vue 3, Composition API, and TypeScript
- Vite
- Vue Router
- Pinia for state genuinely shared across views
- Tailwind CSS v4 through `@tailwindcss/vite`
- Vitest and Vue Test Utils
- Playwright for end-to-end tests
- Bun as the expected package manager/runtime

**UI Component Library**: shadcn/vue (registry-based, copy-paste components). Install via `npx shadcn-vue@latest add <component>`. Use registry components as building blocks; customize via Tailwind config and component props. Do not introduce Vuetify, PrimeVue, or another component framework without a clear requirement and an explicit migration plan.

## 3. Product principles

1. **Truthful status:** distinguish ready, incomplete setup, processing, failed, and completed states.
2. **Explainable measurements:** display units, estimation method, and calibration context alongside results.
3. **Workflow-first:** guide users through camera setup, calibration, ground references, then prediction.
4. **No fabricated data:** never invent cameras, metrics, confidence scores, history, or API capabilities.
5. **Indonesian-first:** use clear Bahasa Indonesia for user-facing labels and errors; preserve technical identifiers and units.
6. **Resilient API handling:** present actionable errors and retry only when safe.
7. **Accessible and responsive:** keyboard operation, visible focus, readable contrast, semantic controls, and usable mobile layouts.

## 4. Information architecture

Recommended primary sections:

- **Ringkasan:** backend health, camera count, configuration readiness, and recent results only when supported by real API data.
- **Kamera:** list, register, inspect, and edit camera metadata.
- **Kalibrasi:** upload chessboard images, configure pattern and square size, inspect calibration quality, and activate a version.
- **Referensi Tanah:** define matching image/world points, select world units, inspect the generated ground model, and preview BEV when supported.
- **Analisis Sampah:** choose a camera, check prerequisites, upload an image, configure supported inference options, submit prediction, and inspect outputs.
- **Riwayat Analisis:** build a persistent history view only if the backend exposes a suitable endpoint. Do not simulate persistence.
- **Pengaturan:** backend origin, health probe, and separately verified camera-read access. Never expose a privileged production secret in the client bundle.

Prefer a useful empty state over a dashboard filled with placeholder cards.

## 5. Main workflows

### First-time setup

1. Check backend connectivity with `GET /health`.
2. Load or register a camera.
3. Upload valid chessboard images for calibration. The current backend code specifies at least 10 valid images, with 15–30 recommended.
4. Create ground-reference correspondences using at least four matching image/world points.
5. Confirm active calibration, active ground model/reference, and an available depth scale.
6. Run a prediction using an uploaded image.

When a step is blocked, explain why and provide a direct route to the relevant setup screen.

### Waste-volume analysis

1. Select a camera and image.
2. Check configuration prerequisites before submission.
3. Submit using exact multipart field names and enum values from the current OpenAPI schema.
4. Retain the HTTP 202 job ID and show queued/processing/done/failed from the persisted job endpoint; do not assume a fixed duration.
5. Render only output images, BEV previews, estimates, and report links actually returned by the API.
6. Label volume methods distinctly (for example, grid/voxel and convex hull) and show `m³` and `L` when available.
7. Convert technical errors into readable messages without exposing stack traces.

**Backend contract:** `upload`, `rtsp_frame`, and `latest_rtsp` create persisted queued jobs with HTTP 202. History and status are read from prediction GET endpoints. RTSP sources omit file/timestamp. `GET /api/v1/cameras/{camera_id}/ground-models/{ground_model_id}/depth-scales/active` returns the active scale. The 26 October source/OpenAPI alignment adds weights/preprocessing identity validation to this endpoint and corrects the stale general description. There is no worker-health readiness endpoint. Mock signaling remains insufficient evidence of playback or inference.

Historical limitation: the previous handler rejected RTSP and ran upload prediction synchronously despite HTTP 202. This remains a record of the old implementation, not a description of the MediaMTX backend.

## 6. Backend integration contract

- Configure the backend origin with `VITE_API_BASE_URL`; document a local example in `.env.example`.
- Inspect the running backend's `/openapi.json` and source before relying on routes, payloads, or response shapes.
- The verified MediaMTX contract mounts camera operations at `/api/v1/cameras/{camera_id}/...`. Store the origin without the prefix and use the central `cameraPath()` helper exactly once. `/health`, `/docs`, and `/files` are outside the prefix. Previous unprefixed examples describe the old contract.
- Authentication currently uses the `X-API-Key` header. Prefer the live contract and implementation over potentially stale README examples.
- Centralize HTTP behavior in the existing `src/services/`; define endpoint-specific request and response types.
- Do not manually set a multipart `Content-Type` boundary when using browser `FormData`.
- Treat IDs as opaque UUID strings.
- Normalize network, HTTP, validation, and authorization errors in one place.
- Render artifact URLs only when returned by the API; never guess storage paths.
- Fetch binary artifacts with `X-API-Key`, trusted backend origin/endpoint validation, no cookies, and rejected redirects. Components own and revoke object URLs on replacement, disposal, and connection changes.
- RTSP inputs are masked and replacement-only. An empty edit preserves the source; explicit confirmed removal sends `rtsp_url: null`. Response URLs are redacted by the backend.
- Separate backend health from key verification and media status. A healthy database probe does not verify workers, MediaMTX, camera access, or other operation scopes.

### Frontend secret handling

Variables prefixed with `VITE_` are exposed in the browser bundle. Never put a privileged, long-lived production API key in a `VITE_*` variable. For production, prefer same-origin deployment, a backend-for-frontend (BFF), or another server-side secret-handling design. A key entered by a user remains accessible to that user's browser.

## 7. Suggested source organization

Adapt this structure to the repository's existing conventions; do not create empty directories without a purpose.

```text
src/
  api/                 # HTTP client and typed endpoint functions
  components/          # reusable UI components
  features/
    cameras/
    calibration/
    ground-reference/
    prediction/
  layouts/
  pages/
  router/
  stores/              # shared Pinia state only
  types/
  styles/
```

Keep domain logic out of presentation components where practical. Every data view should define loading, error, empty, and success states.

## 8. Visual direction

- Calm technical operations dashboard with neutral surfaces and restrained green accents.
- Prioritize source images and analysis outputs over decoration.
- Use consistent spacing, typography, borders, and semantic status styles.
- Use tables for camera/version lists; metric cards must show real values.
- Label previews clearly: original, segmented/annotated, depth visualization, and BEV.
- Keep measurement units and method names visible.
- Include skeleton/loading states, useful empty states, recoverable errors, and confirmation for destructive actions.

## 9. Measurement integrity

- Do not label relative depth as meters unless metric scaling is verified and guaranteed by the backend.
- BEV is a top-down projection/visualization, not a complete 3D reconstruction.
- Preserve backend method identifiers and source values; do not silently reinterpret units.
- Render null, unavailable, or failed measurements as unavailable—not zero.
- Keep source image, camera ID, job ID, and calibration context attached to results whenever provided.

## 10. Definition of done

- Type-check and production build pass.
- Important loading/error/empty states have tests.
- Primary user journeys have Playwright coverage where practical.
- Keyboard operation and responsive layouts are checked.
- Integration is verified against the current OpenAPI schema and a running backend when available.
- No secrets, fabricated API data, dead controls, or unverified endpoint assumptions.

## 11. UX audit findings and required behavior

### Readiness correction (25 October 2026)

The previous `src/services/readiness.ts` checked a ground-model ID before fetching it and never populated that ID. The resolver now reads the active resources before deriving readiness, retains their returned IDs, and checks calibration/reference/model compatibility through `measurementContext.ts`. `checkPredictionPrerequisites` is an alias of the same readiness function, not a second set of rules. Missing configuration is distinct from API/network failures. Intrinsics requirements follow the selected prediction source; legacy uploads need an already-undistorted image. Analysis clears stale readiness and rechecks it before submission. Live `/health` and `/openapi.json` were read successfully on 25 October 2026 and reconciled with backend routes/tests. Resource requests with a configured API key/camera remain unverified live. Regression tests use mock responses and do not establish workers, model files/versions, physical accuracy, or hardware behavior.

Readiness means compatible configuration for the chosen source. In the 25 October contract, `DepthScaleResponse` exposed only a model name and creation ignored the uploaded preview source. The 26 October alignment below resolves those code defects; it does not establish worker availability or physical measurement accuracy.

### Depth source and identity alignment (26 October 2026)

- `DepthScaleCreate` supports optional `test_image`, `depth_model`, and clipping. The form passes the uploaded source key with its undistorted pixel measurements and waits for preview decoding. Without a source key, the backend uses the first registered calibration image. Blank model/clipping fields use backend defaults. Model names are limited to 100 characters; each clipping bound is independently optional and must be positive, finite, ordered, and contain the measured Z values.
- `DepthScaleResponse.model_identity` carries weights SHA256, dependency/preprocessing versions, camera-axis convention, and inference size. Legacy identity may be null. Active GET validates it; readiness maps 409 missing identity/model mismatch/invalid saved fit to creation of a new scale. Model unavailable remains a 503 service failure. A successful check does not certify accuracy.
- Opening `/dashboard/depth-scales?camera=<UUID>` now fetches the active context on initialization. Browser regression covers upload, authenticated preview, three points, source-bound creation, and completion at 390/768/1280 px with mocked API responses. Connection loss or persistence uncertainty blocks resubmission in the form and offers reconciliation through the stored scale list.
- Backend revisions 006/007 add identity/provenance and preview registration. Legacy scales need measured refitting and unregistered previews need regeneration. Physical files can outlive their metadata. Coordinate deployment with `../sivera`; the reproducible contract lives at `../sivera/openapi.json`.

Rencana dan hasil verifikasi: `.agents/plan/2026-10-26-depth-contract-alignment.md`.

### Persisted job handling (26 October 2026)

- Accepted IDs survive refresh in `tracking=<job_id>`; `job=<job_id>` opens detail. Each job has independent, non-overlapping status reads with bounded transient backoff. Permission/nontransient errors pause automatic polling and offer manual retry without changing the last backend status to failed.
- Camera/connection changes fence stale responses. Fresh history/detail can replace cached partial results. Closing a loading dialog prevents a late response from reopening it.
- `done` only gets a success notification when a recognized method supplies finite, nonnegative `volume_m3` and `volume_liter`. Missing volume is a partial result with detail reload. Worker failures show actionable messages. Status notifications defer to inline state while a prediction dialog is open.
- Ambiguous POST failures never trigger automatic resubmission; the form explains that a job may exist and offers history inspection. Browser aborts do not cancel backend jobs. Phone history prioritizes ID, status, and detail; remaining metadata is in detail.
- Verification and the scoped visual gate are recorded in `.agents/plan/2026-10-26-p1-delivery.md`. The current live backend probe was refused; frontend mock tests do not establish live inference.

### UX objective

The overview starts with the selected camera and its next setup action, derived from the shared readiness resolver. Ready configuration opens Analysis with that camera; loading and access failures have their own states. Camera selection survives refresh through the query string. Camera/prerequisite details are expandable. Metrics and history load independently of readiness; unavailable totals remain unavailable and partial totals state their coverage. Stream configuration is labeled separately from runtime status and frame freshness, which are inspected in Cameras. Verification: `.agents/plan/2026-10-26-operator-delivery.md`.

A new operator should be able to answer at any point:
- What step am I on?
- Is the camera/source actually available?
- What is preventing measurement, if anything?
- What will happen after I submit?
- Is the result complete, and what does its volume number mean?
- What should I do if the process fails?

### Primary workflow

1. **Connection and source:** distinguish backend/API availability, camera configuration, stream runtime/synchronization, and availability of a usable frame.
2. **Calibration:** show active version, image dimensions/intrinsics readiness, and whether recalibration is required.
3. **Ground reference/model:** explain required image/world correspondences and clearly show which calibration the active model belongs to.
4. **Depth scale:** show whether a scale exists for the selected ground model and whether it is accepted/active. Do not infer this from a different endpoint. Verify the currently deployed OpenAPI contract before implementing the adapter.
5. **Preflight:** summarize all required checks in one place; identify the failed prerequisite, give a direct link to fix it, and re-run checks after the user returns.
6. **Measurement:** show submission/queued/processing states from persisted job status. Do not invent percentage progress or turn a fixed advisory duration into a countdown/SLA.
7. **Result:** show the primary volume estimate, method, units, source image/time, camera, job, and configuration/version context when returned by the API. Keep diagnostic outputs available without forcing every user to interpret them.

### Status semantics

Use text and icons in addition to color. Keep these concepts separate:
- **Backend health:** API's health response only.
- **Access:** API-key validity and operation scope.
- **Camera/stream:** desired configuration, runtime status, synchronization, and frame freshness are different.
- **Measurement readiness:** compatible calibration, ground reference/model, depth scale, and other backend-declared prerequisites.
- **Job state:** pending/processing/done/failed from the persisted prediction job.
- **Result validity:** whether required output values exist and whether physical accuracy has been validated. A successful job does not certify metric accuracy.

### Empty, blocked, and error states

Every workflow page must include a useful empty state and an explicit recovery path. Example: “Model ground belum tersedia untuk kalibrasi aktif” followed by an action to open Referensi Tanah. If the model belongs to a different calibration, explain the mismatch rather than describing it as simply missing. If a service is unreachable, distinguish connectivity from missing configuration. Preserve user inputs when safe.

### Result presentation and measurement integrity

- The current contract does not identify a physically validated primary method. Show Grid/Voxel and Convex Hull 2D as separate estimates before diagnostics; never sum them or choose a primary method based on their magnitude. A validated primary can be introduced only when supported by evidence and the backend contract.
- Always show units (`m³`, `L`, `m²`, `m`) when values exist; never silently turn null/missing/NaN into zero.
- Label experimental, unvalidated estimates explicitly. A successful inference or a scale-fit acceptance is not proof of real-world accuracy.
- Provide a visual review path: original image, waste mask/segmentation, depth visualization with legend, and BEV/footprint if the backend actually returns them.
- Identify the actual volume method. The grid method sums per-cell representative height times cell area; its behavior depends on cell size, sparse-cell threshold, holes, and boundary-cell policy. Explain these settings when relevant and do not imply it is parameter-independent.
- The current convex-hull method is a 2D hull footprint multiplied by a representative height, not a full 3D convex-hull volume. Do not label it “true 3D convex hull volume.”
- Attach method and configuration context to results when the API provides it; do not invent confidence scores, uncertainty bounds, or calibration metadata that the backend does not return.

Implemented result review (26 October 2026):

- Grid uses the median positive height of eligible cells times cell area, excludes empty/sparse cells, and uses full boundary-cell area. Convex Hull 2D uses footprint area times median height. `n_cells` counts cells with finite height data, including zero-height cells; label it `Sel dengan data tinggi`.
- Show `volume_m3` and `volume_liter` independently from saved API values. Missing, nonfinite, negative, or nonnumeric measurements render as `-`; zero remains zero. Positive values smaller than the displayed precision use `< 0,001` m³ or `< 1` L instead of rounding to zero.
- Disclosures expose saved footprint/height/point diagnostics and the job's calibration, ground-model, and depth-scale IDs. These are historical IDs from the job, not currently active camera resources. The segmentation confidence threshold is not volume accuracy.
- Source time is labeled in UTC. For RTSP it means worker reception time, not sensor capture time. `source_path` is private storage-key text, never an inferred image URL. Registered output artifacts keep their authenticated review path.
- A failed volume read retains the job identity/status and offers a GET detail reload; 403 names the `predict:read` permission and recovery action. Completed status alone does not imply that detail values were successfully loaded.
- Dialog disclosures participate in Tab/Shift+Tab focus trapping and support Enter/Space. Source/status metadata scrolls with the detail body so the fixed title leaves reading space at 200% root text size.

Frontend verification and the scoped visual gate: `.agents/plan/2026-10-26-results-delivery.md`. The opt-in saved-result integration in `e2e/live-backend.spec.ts` needs `SIVERA_API_BASE_URL`, `SIVERA_API_KEY`, `SIVERA_CAMERA_ID`, and `SIVERA_RESULT_JOB_ID` for an existing completed job with saved volumes. It checks displayed values, historical IDs, and returned image decoding without submitting inference. Live result/model/hardware behavior remains unverified.

### Accessibility and responsive interaction

- Primary actions must be keyboard accessible and have visible focus.
- Do not use color as the only status indicator; use text/icons and accessible labels.
- Keep error messages near the blocked action and preserve a sensible heading hierarchy.
- At narrow widths, prioritize the primary action, job status, and headline measurement; allow diagnostic images/details to stack rather than overflow.
- Confirm destructive operations and distinguish a disabled action from a loading action.

### UX acceptance criteria

- A compatible configured camera is not incorrectly blocked by frontend-only readiness logic.
- Missing, mismatched, and unavailable prerequisites produce different, actionable explanations.
- A user can submit a prediction and understand persisted job status without guessing.
- Failed jobs offer a safe recovery path and do not appear as successful results.
- A result's units, method, source, and validation limitations are visible.
- Keyboard, mobile-width, loading, empty, and error states are tested.
- Mocked tests are labeled as such; end-to-end integration is verified against the current backend contract where the environment permits.


## User journey and user management

### Current scope

SIVERA is designed for one organization in the current phase. Do not introduce multi-organization screens or claim tenant isolation. Keep organization ownership as a future extension point; implement it only with a deliberate data/API migration and authorization plan.

### End-to-end journey

1. Sign in and restore the session, if end-user authentication exists in the deployed contract.
2. Open the dashboard and understand system health versus measurement readiness.
3. Complete missing setup: camera/source, calibration, ground model/reference, and compatible depth scale.
4. Start a measurement from a supported image/camera source.
5. Follow the persisted job through pending/processing/done/failed.
6. Review volume, unit, method, and available source/configuration context.
7. Open history and inspect a previous result or start another measurement, only where the API supports these actions.

Show a clear next action at each blocked step. Do not treat 202 Accepted as a completed prediction.

### Account management and permissions

Proposed role model (subject to backend capabilities):
- Administrator: manage users/access and authorized system configuration.
- Operator: run measurements and review permitted jobs/results.
- Viewer: read permitted results and history only.

These roles are a product proposal, not a statement that they exist in the current API. The current X-API-Key service authentication must not be presented as an end-user login/session system. Before designing account pages, confirm the backend supports user identity, session lifecycle, role/permission assignment, and user administration. If not, record authentication and authorization as a prerequisite rather than simulating them in the browser.

When supported, user management should include a searchable list, role and account status, supported invitation/creation flow, role changes, activate/deactivate confirmation, explicit handling for 401/403 and expired sessions, and protection against removing the last administrator where applicable. Enforce permissions in the backend; route guards are supplementary only.

### Future multi-organization readiness

Keep authorization checks and data access in centralized domain/service boundaries so an organization scope can be added later. Do not add speculative tenant tables or organization_id fields in this single-organization phase. Before multi-organization launch, define tenant ownership for cameras, calibrations, ground models, depth scales, jobs, artifacts, and users; add server-side tenant scoping, migration/backfill, cross-tenant access tests, and auditability.
