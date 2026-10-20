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

Do not introduce Vuetify or another component framework without a clear requirement and an explicit migration plan.

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
- **Pengaturan:** API base URL and connection status. Never expose a privileged production secret in the client bundle.

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

**Current limitation:** the prediction route accepts source types including RTSP variants, but the current handler raises `NotImplementedError` for RTSP and processes uploaded images synchronously despite returning HTTP 202. Implement upload-first UI; do not claim RTSP or background-job polling works until verified.

## 6. Backend integration contract

- Configure the backend origin with `VITE_API_BASE_URL`; document a local example in `.env.example`.
- Inspect the running backend's `/openapi.json` and source before relying on routes, payloads, or response shapes.
- Routes are currently mounted directly, such as `/cameras`, `/cameras/{camera_id}/calibrations`, `/cameras/{camera_id}/ground-references`, and `/cameras/{camera_id}/predict`. Do not assume an `/api/v1` prefix.
- Authentication currently uses the `X-API-Key` header. Prefer the live contract and implementation over potentially stale README examples.
- Centralize HTTP behavior in `src/api/`; define endpoint-specific request and response types.
- Do not manually set a multipart `Content-Type` boundary when using browser `FormData`.
- Treat IDs as opaque UUID strings.
- Normalize network, HTTP, validation, and authorization errors in one place.
- Render artifact URLs only when returned by the API; never guess storage paths.

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
