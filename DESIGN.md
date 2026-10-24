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
4. Show a loading state without assuming a fixed duration or genuinely asynchronous processing.
5. Render only output images, BEV previews, estimates, and report links actually returned by the API.
6. Label volume methods distinctly (for example, grid/voxel and convex hull) and show `m³` and `L` when available.
7. Convert technical errors into readable messages without exposing stack traces.

**Current backend contract (22 October 2026):** `upload`, `rtsp_frame`, and `latest_rtsp` create persisted queued jobs with HTTP 202. History and status are read from prediction GET endpoints. RTSP sources omit file/timestamp. Frontend stream/capture/snapshot/prediction workflows are being integrated in stages; code or mock signaling is not evidence of live playback or inference. The public API cannot verify depth-scale readiness.

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

### Confirmed implementation issue

`src/services/readiness.ts` checks `activeGroundModelId` while it is still `null`; it never assigns that ID after initialization. This can report a missing ground model even when one exists. Fix the data flow and cover it with regression tests before visual redesign. Do not assume every prediction route is broken: inspect all call paths and make their prerequisite behavior consistent.

### UX objective

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

- Make one physically validated method the primary headline value. Present alternative methods in a clearly labeled comparison/details section, not as interchangeable answers.
- Always show units (`m³`, `L`, `m²`, `m`) when values exist; never silently turn null/missing/NaN into zero.
- Label experimental, unvalidated estimates explicitly. A successful inference or a scale-fit acceptance is not proof of real-world accuracy.
- Provide a visual review path: original image, waste mask/segmentation, depth visualization with legend, and BEV/footprint if the backend actually returns them.
- Identify the actual volume method. The grid method sums per-cell representative height times cell area; its behavior depends on cell size, sparse-cell threshold, holes, and boundary-cell policy. Explain these settings when relevant and do not imply it is parameter-independent.
- The current convex-hull method is a 2D hull footprint multiplied by a representative height, not a full 3D convex-hull volume. Do not label it “true 3D convex hull volume.”
- Attach method and configuration context to results when the API provides it; do not invent confidence scores, uncertainty bounds, or calibration metadata that the backend does not return.

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
