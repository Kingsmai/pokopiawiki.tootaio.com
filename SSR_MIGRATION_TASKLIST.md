# SSR Migration Task List

This temporary task list tracks the work required to move the frontend from the current Nuxt SPA migration state to a complete SSR-capable Nuxt deployment.

Keep this file aligned with implementation progress while the SSR migration is in flight. When SSR migration is complete and validated, delete this file and remove the related temporary instruction from `AGENTS.md`.

## Target State

- [x] Nuxt runs with `ssr: true` for production.
- [ ] Public browsing routes render meaningful HTML on the server, including localized metadata and public business data where practical.
- [ ] Authenticated, management, edit, and modal workflows remain functionally equivalent to the current SPA behavior.
- [ ] No password hashes, session token hashes, verification/reset token hashes, role internals, permission internals, audit payloads, debug fields, or implementation notes are exposed through SSR payloads, API responses, generated HTML, metadata, logs, or UI.
- [ ] `DESIGN.md`, Docker configuration, environment variable documentation, and runtime behavior agree.

## Phase 1: Baseline Audit

- [x] Read `DESIGN.md`, `DesignGuidelines.html` when UI behavior is touched, `AGENTS.md`, and this task list before making SSR migration changes.
- [x] Inventory all browser-only access in `frontend/src`, `frontend/app.vue`, `frontend/plugins`, `frontend/middleware`, and `frontend/pages`: `window`, `document`, `localStorage`, `sessionStorage`, DOM measurement, event listeners, timers, clipboard, `confirm`, `matchMedia`, and direct head mutation.
- [x] Classify each browser-only usage as client-only component behavior, SSR-safe fallback behavior, or logic that must be moved into Nuxt composables/plugins.
- [x] Inventory route-level data loading across public list/detail pages, authenticated pages, management pages, and route-backed modal pages.
- [x] Identify public routes that should SSR first: Home, Pokemon/Event Pokemon lists, Habitat/Event Habitat lists, Items/Event Items lists, Ancient Artifacts, Recipes, Daily CheckList, Dish, Life list/detail, Project Updates, legal pages, and public Profile.
- [x] Identify routes that should remain client-only or mostly client-rendered initially: Login, Register, Forgot/Reset Password, Verify Email, Admin, `/profile`, notification UI, upload/edit forms, and route-backed edit/create modals.

### Phase 1 Audit Notes

- Browser-only access is concentrated in client interactions: modal focus/body locking, dropdown positioning, sidebar/mobile drawer behavior, search debounce, infinite-scroll sentinels, upload/download helpers, clipboard copy, local checklist state, route-backed form defaults, WebSocket notifications, moderation update events, and destructive-action `window.confirm` calls. These should stay in mounted/client-only lifecycle paths during SSR enablement.
- SSR-safe fallback candidates already guard storage or DOM access in `frontend/src/i18n.ts`, `frontend/src/services/api.ts`, and several views with `typeof window`, `typeof document`, `typeof localStorage`, `typeof sessionStorage`, or `typeof IntersectionObserver`.
- Logic that must move to SSR-aware Nuxt APIs in later phases: direct SEO mutation in `frontend/src/seo.ts` / `frontend/plugins/02-seo.client.ts`, global Vue I18n singleton request state, auth middleware's storage-only token model, and Nuxt config analytics script injection.
- Current route data loading is client-mounted in views rather than route-level `useAsyncData` / `useFetch`. Public list/detail candidates load through `api.*Page`, `api.*Detail`, `api.dish`, `api.dailyChecklistPage`, `api.lifePosts`, `api.lifePost`, `api.projectUpdates`, and public profile/activity endpoints. Auth, admin, edit/create modal, notification, upload, comment/reaction, and profile account flows depend on client auth state or browser APIs and should not be first-wave SSR data routes.
- First SSR data groups should be low-risk public reads: Home/project update preview, legal/static pages, Pokemon/Event Pokemon lists and details, Habitat/Event Habitat lists and details, Items/Event Items/Ancient Artifacts lists and details, Recipes list/details, Daily CheckList, Dish, Life public feed/detail, Project Updates, and public Profile.

## Phase 2: Runtime Config And API Layer

- [x] Replace client-only API base URL setup with an SSR-safe runtime config helper that works in server and client contexts.
- [x] Define separate public/browser API origin and internal server API origin if Docker networking requires different URLs for server-side fetches and browser fetches.
- [x] Ensure every server-side API read sends the correct `X-Locale` and never sends browser-only bearer tokens unless a secure SSR auth mechanism is implemented.
- [x] Add a small SSR-safe fetch wrapper or adapt `frontend/src/services/api.ts` so public reads can be called from server-side setup without depending on `window`, storage, or DOM APIs.
- [x] Keep frontend API response types consistent with `frontend/src/services/api.ts`.
- [ ] Ensure API errors used for SSR public routes degrade to intended empty/error states without leaking stack traces or internal fields into rendered HTML.
  - [x] Pokemon and Event Pokemon list SSR reads degrade to null initial data and existing skeleton/empty UI without rendering raw backend errors.

## Phase 3: Authentication And Session Model

- [x] Decide and document the SSR-compatible auth model in `DESIGN.md` before implementation.
- [x] Migrate auth from `localStorage` / `sessionStorage` bearer-token-only behavior to an HTTP-only cookie/session model, or explicitly document a hybrid model if Remember me must preserve current storage behavior.
- [x] Update backend login/logout/session endpoints to support the chosen cookie/session model without exposing session token hashes or internal session metadata.
- [x] Preserve Remember me semantics: 1 day for non-remembered sessions, 30 days for remembered sessions.
- [x] Preserve email verification as the base requirement for protected writes.
- [ ] Ensure current-user SSR reads expose only the allowed current-user fields defined in `DESIGN.md`.
- [ ] Update route middleware so server-side redirects for authenticated and permissioned routes match current client-side behavior.
  - [x] Server-side route middleware forwards the incoming HTTP-only session cookie to `api.me()` for authenticated, verified, and permissioned route checks.
- [ ] Ensure public SSR pages never render private current-user data into HTML meant for anonymous users.
  - [x] Pokemon and Event Pokemon list SSR reads do not call `api.me()` or forward cookies; create actions remain client-hydrated after mount.
- [x] Add a clear logout flow that clears both server cookies and any legacy client storage during the transition.

### Phase 3 Auth Notes

- The migration now uses a hybrid session model: backend login sets an HTTP-only `pokopia_session` cookie and still returns the legacy bearer token so existing SPA storage behavior keeps working during the transition.
- Protected backend reads and writes accept the HTTP-only cookie first and remain compatible with `Authorization: Bearer` tokens.
- Frontend API requests use `credentials: 'include'` so browser requests can carry the cookie without exposing it to JavaScript.
- Login still stores the legacy token according to Remember me semantics; logout deletes the server session, clears the cookie, and clears legacy frontend storage.
- Server-side auth middleware forwards the incoming SSR request cookie only for `api.me()` checks, allowing HTTP-only session cookies to participate in SSR route redirects without adding private auth headers to public page data requests.

## Phase 4: Nuxt SSR Enablement

- [x] Change Nuxt config from `ssr: false` to `ssr: true` only after browser-only usage and auth strategy are ready.
- [ ] Split plugins by runtime where needed: `.client.ts` for DOM/event/storage logic, `.server.ts` for SSR-only initialization, and universal plugins only for code safe in both contexts.
- [x] Ensure Vue I18n is installed safely for SSR and does not share mutable per-request state across users.
- [x] Move direct `document.head` SEO mutation to Nuxt `useHead` / `useSeoMeta` or another SSR-aware head strategy.
- [x] Ensure route metadata remains the source for default SEO, required auth, required permission, editor modal behavior, and noindex rules.
- [ ] Confirm route-backed modal pages still preserve underlying page context and avoid unwanted scroll jumps.
- [ ] Keep UI business text localized through Vue I18n/system wordings; do not add implementation notes or debug text to the UI.

### Phase 4 SEO Notes

- `frontend/src/seo.ts` now resolves SEO state without mutating `document.head` or `document.title`.
- `frontend/plugins/02-seo.ts` is a universal Nuxt plugin that binds route metadata and client-side detail overrides to `useHead`.
- The Nuxt config analytics script is declarative and no longer injects a script with `document.head.appendChild`.

### Phase 4 I18n Notes

- `frontend/src/i18n.ts` now exports a Vue I18n factory instead of a module-level singleton.
- `frontend/plugins/01-i18n.ts` creates and installs one I18n instance per Nuxt app/request; only the browser instance is registered for legacy helpers that need localStorage and locale-change events.
- SEO route metadata translation uses the current Nuxt app's I18n translator instead of importing a shared global I18n instance.

### Phase 4 SSR Config Notes

- `frontend/nuxt.config.ts` now uses `ssr: true`.
- `pnpm --filter @pokopia/frontend build` completed with Nuxt SSR enabled and generated Nuxt server output at `.output/server/index.mjs`.
- Production container now targets the Nuxt server entry point; Docker runtime validation remains tracked in Phase 8.

## Phase 5: Server-Side Data And SEO

- [ ] Implement SSR data loading for stable public routes in small groups, starting with low-risk public pages.
  - [x] Pokemon and Event Pokemon list routes SSR-load shared options and the first public list page.
  - [x] Habitat and Event Habitat list routes SSR-load the first public list page.
  - [x] Items, Event Items, Ancient Artifacts, and Recipes list routes SSR-load shared options and the first public list page.
  - [x] Daily CheckList and Dish routes SSR-load their public business data.
  - [x] Home and Project Updates SSR-load the public project update preview/feed.
- [ ] For each SSR-enabled public route, render title, description, canonical URL, robots value, Open Graph, Twitter card, and structured data from public business data and system wording only.
  - [x] Route-level SEO output now owns dynamic title, description, canonical, robots, Open Graph, Twitter card, and valid inline JSON-LD without duplicate static Nuxt head metadata.
- [ ] For detail pages, use entity names, public images, localized public fields, and canonical detail URLs after public API data loads server-side.
- [ ] Preserve `noindex` on auth, admin, new, edit, and in-development routes.
  - [x] SEO resolver defaults authenticated, verified, and permissioned routes to `noindex`, while existing route metadata continues to mark auth, edit/create modal, and in-development pages as `noindex`.
- [ ] Keep `robots.txt` and `sitemap.xml` generated from the same stable public route set documented in `DESIGN.md`.
  - [x] Sitemap includes Home, public index sections, Project Updates, and legal pages; robots keeps auth, admin, edit/create, and in-development routes disallowed.
- [ ] Avoid serializing private auth state, raw permissions, internal audit payloads, or unneeded API payload fields into Nuxt payloads.
- [ ] Confirm localized reads follow the fallback order in `DESIGN.md`: requested locale, default-language translation, base field.

### Phase 5 Public Data Notes

- Pokemon and Event Pokemon list routes now SSR-load the shared options payload and first public list page through `useAsyncData`; filter changes, infinite loading, and route-backed create modals continue to use the existing client behavior.
- Pokemon list SSR API failures are contained to null initial data so rendered HTML falls back to the existing skeleton/empty behavior without exposing backend stack traces, raw errors, or internal fields.
- Public Pokemon list SSR data does not request `api.me()` or forward cookies; create actions remain client-hydrated from the current user after mount.
- Habitat/Event Habitat, Items/Event Items, Ancient Artifacts, Recipes, Daily CheckList, Dish, Home, and Project Updates now use contained `useAsyncData` public reads for SSR initial content. Client-side auth reads, editor-only options, filters, infinite loading, ordering, and route-backed modals remain hydrated after mount.
- The static fallback SEO tags in Nuxt config were reduced to non-route-specific defaults so route-level SSR SEO is the single source for canonical, robots, social metadata, and JSON-LD.

## Phase 6: Browser-Only UI Isolation

- [ ] Move DOM event listeners, resize/scroll handlers, focus traps, modal body locking, clipboard behavior, and `window.confirm` calls into client-only lifecycle paths.
- [ ] Ensure components with DOM measurement render stable SSR placeholders or no-op behavior until mounted.
- [ ] Keep loading states as Skeleton loaders where existing page patterns support them.
- [ ] Validate that notification WebSocket setup only runs on the client and never during SSR.
- [ ] Validate upload widgets and file APIs only run on the client.
- [ ] Ensure route transitions and scroll behavior remain consistent with the current route-backed modal rules.

## Phase 7: Docker And Deployment

- [x] Update frontend Docker image from static `.output/public` serving to Nuxt server output when SSR is enabled.
- [ ] Run the production container with the Nuxt server entry point rather than the current static server.
- [x] Update `frontend_gateway` proxy behavior if SSR server health, fallback, or cache behavior changes.
- [x] Document required environment variables, including public browser API URL, internal server API URL, site URL, and any cookie/session settings.
- [x] Keep the upgrade maintenance page independent from Nuxt, backend API, and database.
- [x] Preserve public frontend port `20015` unless `DESIGN.md` and compose configuration are intentionally updated together.

### Phase 7 Deployment Notes

- `frontend/package.json` now uses `nuxt build` so the production build emits Nitro server output.
- `frontend/Dockerfile` now runs `node .output/server/index.mjs` with `HOST=0.0.0.0` and `PORT=20015`; the obsolete lightweight static server file was removed.
- `frontend_gateway` continues to proxy `frontend:20015` and keep the backend health-gated maintenance fallback independent from Nuxt.
- `DESIGN.md` now documents the Nuxt server output deployment model and the existing browser API, server API, site URL, origin, and proxy environment variables.
- A local smoke check of `node frontend/.output/server/index.mjs` on port `20115` returned SSR HTML for `/` and `200` for `/robots.txt`; Docker compose runtime validation is still pending.

## Phase 8: Validation

- [x] Run `pnpm --filter @pokopia/frontend typecheck`.
- [x] Run `pnpm --filter @pokopia/frontend lint`.
- [x] Run `pnpm --filter @pokopia/frontend build`.
- [ ] Do not run tests in WSL unless explicitly requested.
- [ ] Ask the user to run `docker compose up --build` for runtime validation, then fix any pasted Docker output in follow-up passes.
- [ ] Verify anonymous SSR HTML for public routes includes meaningful public content and metadata.
- [ ] Verify authenticated routes redirect correctly when unauthenticated, unverified, or missing permissions.
- [ ] Verify logged-in flows still work after hydration: login, logout, Remember me, Profile, notifications, create/edit modals, uploads, comments, reactions, and admin access.
- [ ] Verify generated HTML and Nuxt payloads do not contain forbidden internal data.
- [ ] Verify `robots.txt`, `sitemap.xml`, canonical URLs, noindex routes, and public detail metadata.

### Phase 8 Validation Notes

- 2026-05-06: After SSR auth cookie forwarding and Pokemon/Event Pokemon first-page SSR data, `pnpm --filter @pokopia/frontend typecheck`, `pnpm --filter @pokopia/frontend lint`, and `pnpm --filter @pokopia/frontend build` passed. The current `lint` script runs `nuxt typecheck`.
- 2026-05-06: After SEO foundation updates, `pnpm --filter @pokopia/frontend typecheck`, `pnpm --filter @pokopia/frontend lint`, and `pnpm --filter @pokopia/frontend build` passed. Local built-server smoke on port `20116` verified `/pokemon` route-level canonical/meta/JSON-LD, `sitemap.xml`, and `robots.txt`.
- 2026-05-06: After the first public list SSR data expansion, `pnpm --filter @pokopia/frontend typecheck`, `pnpm --filter @pokopia/frontend lint`, and `pnpm --filter @pokopia/frontend build` passed. The build completed with existing Nuxt/Nitro warnings only.

## Phase 9: Cleanup

- [ ] Remove legacy SPA-only compatibility paths once SSR behavior is stable and no longer needed.
- [x] Remove obsolete static server usage if the production frontend container runs the Nuxt server.
- [ ] Remove obsolete `VITE_*` fallback support only after deployment configuration has fully moved to `NUXT_PUBLIC_*` or documented replacement variables.
- [ ] Update `DESIGN.md` from "Nuxt SPA mode" to the final SSR deployment model.
- [ ] Update `AGENTS.md` frontend stack and workflow notes to the final SSR state.
- [ ] Delete `SSR_MIGRATION_TASKLIST.md`.
- [ ] Remove the temporary `AGENTS.md` instruction that requires reading and maintaining this task list.
