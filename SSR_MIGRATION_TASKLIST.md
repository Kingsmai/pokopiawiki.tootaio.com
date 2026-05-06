# SSR Migration Task List

This temporary task list tracks the work required to move the frontend from the current Nuxt SPA migration state to a complete SSR-capable Nuxt deployment.

Keep this file aligned with implementation progress while the SSR migration is in flight. When SSR migration is complete and validated, delete this file and remove the related temporary instruction from `AGENTS.md`.

## Target State

- [ ] Nuxt runs with `ssr: true` for production.
- [ ] Public browsing routes render meaningful HTML on the server, including localized metadata and public business data where practical.
- [ ] Authenticated, management, edit, and modal workflows remain functionally equivalent to the current SPA behavior.
- [ ] No password hashes, session token hashes, verification/reset token hashes, role internals, permission internals, audit payloads, debug fields, or implementation notes are exposed through SSR payloads, API responses, generated HTML, metadata, logs, or UI.
- [ ] `DESIGN.md`, Docker configuration, environment variable documentation, and runtime behavior agree.

## Phase 1: Baseline Audit

- [ ] Read `DESIGN.md`, `DesignGuidelines.html` when UI behavior is touched, `AGENTS.md`, and this task list before making SSR migration changes.
- [ ] Inventory all browser-only access in `frontend/src`, `frontend/app.vue`, `frontend/plugins`, `frontend/middleware`, and `frontend/pages`: `window`, `document`, `localStorage`, `sessionStorage`, DOM measurement, event listeners, timers, clipboard, `confirm`, `matchMedia`, and direct head mutation.
- [ ] Classify each browser-only usage as client-only component behavior, SSR-safe fallback behavior, or logic that must be moved into Nuxt composables/plugins.
- [ ] Inventory route-level data loading across public list/detail pages, authenticated pages, management pages, and route-backed modal pages.
- [ ] Identify public routes that should SSR first: Home, Pokemon/Event Pokemon lists, Habitat/Event Habitat lists, Items/Event Items lists, Ancient Artifacts, Recipes, Daily CheckList, Dish, Life list/detail, Project Updates, legal pages, and public Profile.
- [ ] Identify routes that should remain client-only or mostly client-rendered initially: Login, Register, Forgot/Reset Password, Verify Email, Admin, `/profile`, notification UI, upload/edit forms, and route-backed edit/create modals.

## Phase 2: Runtime Config And API Layer

- [ ] Replace client-only API base URL setup with an SSR-safe runtime config helper that works in server and client contexts.
- [ ] Define separate public/browser API origin and internal server API origin if Docker networking requires different URLs for server-side fetches and browser fetches.
- [ ] Ensure every server-side API read sends the correct `X-Locale` and never sends browser-only bearer tokens unless a secure SSR auth mechanism is implemented.
- [ ] Add a small SSR-safe fetch wrapper or adapt `frontend/src/services/api.ts` so public reads can be called from server-side setup without depending on `window`, storage, or DOM APIs.
- [ ] Keep frontend API response types consistent with `frontend/src/services/api.ts`.
- [ ] Ensure API errors used for SSR public routes degrade to intended empty/error states without leaking stack traces or internal fields into rendered HTML.

## Phase 3: Authentication And Session Model

- [ ] Decide and document the SSR-compatible auth model in `DESIGN.md` before implementation.
- [ ] Migrate auth from `localStorage` / `sessionStorage` bearer-token-only behavior to an HTTP-only cookie/session model, or explicitly document a hybrid model if Remember me must preserve current storage behavior.
- [ ] Update backend login/logout/session endpoints to support the chosen cookie/session model without exposing session token hashes or internal session metadata.
- [ ] Preserve Remember me semantics: 1 day for non-remembered sessions, 30 days for remembered sessions.
- [ ] Preserve email verification as the base requirement for protected writes.
- [ ] Ensure current-user SSR reads expose only the allowed current-user fields defined in `DESIGN.md`.
- [ ] Update route middleware so server-side redirects for authenticated and permissioned routes match current client-side behavior.
- [ ] Ensure public SSR pages never render private current-user data into HTML meant for anonymous users.
- [ ] Add a clear logout flow that clears both server cookies and any legacy client storage during the transition.

## Phase 4: Nuxt SSR Enablement

- [ ] Change Nuxt config from `ssr: false` to `ssr: true` only after browser-only usage and auth strategy are ready.
- [ ] Split plugins by runtime where needed: `.client.ts` for DOM/event/storage logic, `.server.ts` for SSR-only initialization, and universal plugins only for code safe in both contexts.
- [ ] Ensure Vue I18n is installed safely for SSR and does not share mutable per-request state across users.
- [ ] Move direct `document.head` SEO mutation to Nuxt `useHead` / `useSeoMeta` or another SSR-aware head strategy.
- [ ] Ensure route metadata remains the source for default SEO, required auth, required permission, editor modal behavior, and noindex rules.
- [ ] Confirm route-backed modal pages still preserve underlying page context and avoid unwanted scroll jumps.
- [ ] Keep UI business text localized through Vue I18n/system wordings; do not add implementation notes or debug text to the UI.

## Phase 5: Server-Side Data And SEO

- [ ] Implement SSR data loading for stable public routes in small groups, starting with low-risk public pages.
- [ ] For each SSR-enabled public route, render title, description, canonical URL, robots value, Open Graph, Twitter card, and structured data from public business data and system wording only.
- [ ] For detail pages, use entity names, public images, localized public fields, and canonical detail URLs after public API data loads server-side.
- [ ] Preserve `noindex` on auth, admin, new, edit, and in-development routes.
- [ ] Keep `robots.txt` and `sitemap.xml` generated from the same stable public route set documented in `DESIGN.md`.
- [ ] Avoid serializing private auth state, raw permissions, internal audit payloads, or unneeded API payload fields into Nuxt payloads.
- [ ] Confirm localized reads follow the fallback order in `DESIGN.md`: requested locale, default-language translation, base field.

## Phase 6: Browser-Only UI Isolation

- [ ] Move DOM event listeners, resize/scroll handlers, focus traps, modal body locking, clipboard behavior, and `window.confirm` calls into client-only lifecycle paths.
- [ ] Ensure components with DOM measurement render stable SSR placeholders or no-op behavior until mounted.
- [ ] Keep loading states as Skeleton loaders where existing page patterns support them.
- [ ] Validate that notification WebSocket setup only runs on the client and never during SSR.
- [ ] Validate upload widgets and file APIs only run on the client.
- [ ] Ensure route transitions and scroll behavior remain consistent with the current route-backed modal rules.

## Phase 7: Docker And Deployment

- [ ] Update frontend Docker image from static `.output/public` serving to Nuxt server output when SSR is enabled.
- [ ] Run the production container with the Nuxt server entry point rather than the current static server.
- [ ] Update `frontend_gateway` proxy behavior if SSR server health, fallback, or cache behavior changes.
- [ ] Document required environment variables, including public browser API URL, internal server API URL, site URL, and any cookie/session settings.
- [ ] Keep the upgrade maintenance page independent from Nuxt, backend API, and database.
- [ ] Preserve public frontend port `20015` unless `DESIGN.md` and compose configuration are intentionally updated together.

## Phase 8: Validation

- [ ] Run `pnpm --filter @pokopia/frontend typecheck`.
- [ ] Run `pnpm --filter @pokopia/frontend lint`.
- [ ] Run `pnpm --filter @pokopia/frontend build`.
- [ ] Do not run tests in WSL unless explicitly requested.
- [ ] Ask the user to run `docker compose up --build` for runtime validation, then fix any pasted Docker output in follow-up passes.
- [ ] Verify anonymous SSR HTML for public routes includes meaningful public content and metadata.
- [ ] Verify authenticated routes redirect correctly when unauthenticated, unverified, or missing permissions.
- [ ] Verify logged-in flows still work after hydration: login, logout, Remember me, Profile, notifications, create/edit modals, uploads, comments, reactions, and admin access.
- [ ] Verify generated HTML and Nuxt payloads do not contain forbidden internal data.
- [ ] Verify `robots.txt`, `sitemap.xml`, canonical URLs, noindex routes, and public detail metadata.

## Phase 9: Cleanup

- [ ] Remove legacy SPA-only compatibility paths once SSR behavior is stable and no longer needed.
- [ ] Remove obsolete static server usage if the production frontend container runs the Nuxt server.
- [ ] Remove obsolete `VITE_*` fallback support only after deployment configuration has fully moved to `NUXT_PUBLIC_*` or documented replacement variables.
- [ ] Update `DESIGN.md` from "Nuxt SPA mode" to the final SSR deployment model.
- [ ] Update `AGENTS.md` frontend stack and workflow notes to the final SSR state.
- [ ] Delete `SSR_MIGRATION_TASKLIST.md`.
- [ ] Remove the temporary `AGENTS.md` instruction that requires reading and maintaining this task list.
