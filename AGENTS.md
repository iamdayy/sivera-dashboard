# AGENTS.md — SIVERA Dashboard

## Mission

Build and maintain the SIVERA web dashboard in this repository (`iamdayy/sivera-dashboard`). Read `DESIGN.md` before substantial UI or workflow changes.

## Repository boundaries

- This repository is frontend-only.
- The backend is maintained separately in `iamdayy/sivera`.
- Do not implement database, computer-vision, calibration, depth, ground-model, or volume algorithms here.
- Integrate with the backend over HTTP using its current OpenAPI contract.
- Do not claim a feature works just because it appears in a mockup or documentation.

## Existing stack and commands

Use the versions and scripts in `package.json`: Vue 3, TypeScript, Vite, Vue Router, Pinia, Tailwind CSS v4, Vitest, Vue Test Utils, and Playwright. Bun is expected.

**UI Components**: shadcn/vue (installed via `npx shadcn-vue@latest add <component>`). Use the registry components as building blocks; customize via Tailwind config and component props. Do not add Vuetify, PrimeVue, or another UI framework without explicit justification.

Useful commands:
- `bun install`
- `bun dev`
- `bun run type-check`
- `bun run build`
- `bun run test:unit`
- `bun run test:e2e`
- `bun run format`

Check `package.json` if a command fails or scripts change. Do not add Vuetify or another UI framework without explicit justification.

## API contract rules

1. Inspect the running backend's `/openapi.json`, relevant route declarations, schemas, and tests before adding or changing requests.
2. Configure the API origin with `VITE_API_BASE_URL`; commit only a safe `.env.example`, never real credentials.
3. Current backend authentication uses `X-API-Key`; do not blindly copy an old `Authorization: Bearer` example.
4. Current routes appear directly under paths such as `/cameras` and `/cameras/{camera_id}/...`; do not assume `/api/v1`.
5. Use exact multipart field names, response models, enum values, and status codes from the current contract.
6. Treat IDs as UUID strings.
7. Prediction requires active calibration, an active ground model/reference, and a depth scale. Show missing prerequisites clearly.
8. RTSP prediction is not implemented in the current handler. Do not present it as functional until verified.
9. Prediction currently runs synchronously despite returning HTTP 202. Do not assume background processing, polling, or persistent history unless verified.
10. Render artifact URLs only when returned by the API.

## Security

- Never commit API keys, tokens, credentials, production secrets, or camera RTSP credentials.
- `VITE_*` variables are embedded in browser builds and are not secret storage.
- Do not put a privileged long-lived API key in frontend source or public environment variables.
- Prefer server-side secret handling for production; handle user-entered keys deliberately and never log them.
- Do not log image contents, credentials, or sensitive camera metadata.
- Treat API text and uploaded filenames as untrusted input.

## Implementation conventions

- Prefer Composition API and `<script setup lang="ts">`.
- Use explicit TypeScript types for API responses and UI state.
- Keep HTTP calls in `src/api/` or the repository's existing equivalent, not scattered through templates.
- Group feature code by domain where that fits existing conventions.
- Use Pinia only for state shared across routes/components.
- Avoid `any`; use `unknown` and narrow it when types are uncertain.
- Provide loading, error, empty, and success states for relevant components.
- Never silently convert missing numeric values to zero.
- Use clear Bahasa Indonesia for the UI unless a technical identifier should remain unchanged.
- Every button, link, and control must perform a real action. Remove or clearly disable unfinished controls.
- Follow existing formatting and naming conventions; avoid unrelated rewrites.

## Testing and verification

- Add/update tests for request formatting, state transitions, error handling, and important components.
- Use Playwright for high-value end-to-end workflows where practical.
- Run type-check, relevant unit tests, and a production build before finishing.
- If a check cannot run, state why; never claim it passed without running it.
- Use the real backend contract when available. Do not weaken useful assertions just to make tests pass.

## Working process

1. Inspect existing files and conventions before editing.
2. Identify the feature and required API operations.
3. Verify request/response schemas and prerequisites.
4. Implement the smallest cohesive change.
5. Add tests and update documentation when behavior changes.
6. Report changed files, commands run, and known limitations.
