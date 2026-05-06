# SSR Migration Remaining Tasks

This temporary file tracks only the work still required before the Nuxt SSR migration can be considered complete.

Delete this file only after all items below are complete and `AGENTS.md` no longer needs the temporary SSR migration workflow.

## Remaining Work

- [ ] Run production Docker validation with `docker compose up --build`.
- [ ] Fix any Docker runtime errors from the production SSR container, frontend gateway, backend API, or SSR server-to-backend API connection.
- [ ] Verify anonymous SSR HTML for public routes contains meaningful public business content and route/detail metadata:
  - `/`
  - `/pokemon`
  - `/event-pokemon`
  - `/habitats`
  - `/event-habitats`
  - `/items`
  - `/event-items`
  - `/ancient-artifacts`
  - `/recipes`
  - `/checklist`
  - `/dish`
  - `/life`
  - `/life/:id`
  - `/profile/:id`
  - `/project-updates`
- [ ] Verify generated HTML, Nuxt payloads, API responses used by SSR, metadata, and logs do not expose password hashes, session token hashes, verification/reset token hashes, private current-user data on public pages, role internals, permission internals, internal audit payloads, debug fields, stack traces, or implementation notes.
- [ ] Verify localized SSR reads and metadata follow the `DESIGN.md` fallback order: requested locale, default-language translation, then base field.
- [ ] Verify auth and permission route behavior with SSR enabled:
  - anonymous users redirect from protected routes to login
  - unverified users cannot access verified-only write flows
  - users missing permissions cannot access permissioned routes
  - current-user reads expose only fields allowed by `DESIGN.md`
- [ ] Verify hydrated logged-in flows still work:
  - login
  - logout
  - Remember me
  - `/profile`
  - notifications
  - route-backed create/edit modals
  - uploads
  - Life comments/reactions
  - entity discussion comments
  - admin access
- [ ] Verify browser-only UI behavior runs only on the client and remains stable after hydration:
  - modal focus and body locking
  - dropdown positioning
  - scroll/resize listeners
  - infinite-scroll sentinels
  - clipboard actions
  - `window.confirm` actions
  - notification WebSocket
  - upload file APIs
- [ ] Verify route-backed modal pages preserve underlying page context and avoid unwanted scroll jumps.
- [ ] Verify `robots.txt`, `sitemap.xml`, canonical URLs, `noindex` routes, Open Graph, Twitter card, and public detail metadata in the production runtime.
- [x] Remove legacy SPA-only compatibility paths once SSR behavior is stable.
- [x] Remove obsolete `VITE_*` fallback support after deployment has fully moved to documented `NUXT_*` variables.
- [x] Update `DESIGN.md` if final behavior differs from the current documented SSR deployment, auth, SEO, or environment-variable model.
- [ ] Update `AGENTS.md` to remove the temporary SSR migration workflow and the requirement to read this task list.
- [ ] Delete `SSR_MIGRATION_TASKLIST.md`.
