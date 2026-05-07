# AGENTS.md

## Core Principles

* Always read `DESIGN.md` before making any change.
* Follow the existing structure and conventions strictly.
* Make **minimal, targeted changes only**. Do not refactor unrelated code.
* Prefer clarity over cleverness. Avoid unnecessary abstraction.
* Keep `DESIGN.md` aligned with implemented product behavior when changing data models, APIs, routes, permissions, or user-facing workflows.

---

## Mandatory Workflow (MUST FOLLOW)

For any non-trivial task:

1. **Read `DESIGN.md`**
2. For UI, component, layout, or styling tasks, **also read `DesignGuidelines.html`**
3. **Produce a short plan (no code)**
4. Wait for approval
5. Implement in small steps
6. Run lightweight validation when practical (lint/typecheck). Do not run tests in WSL.

Do NOT skip planning.

For documentation-only tasks, still follow the planning workflow, but do not run unrelated builds or tests unless the document change depends on generated output.

---

## Project Context

* Goal: Pokopia Wiki, a community-editable game wiki.
* Repository: pnpm workspace monorepo.
* Runtime baseline: Node.js >= 22.
* Frontend:

  * Nuxt SSR enabled (`ssr: true`)
  * Vue
  * Vue Router
  * Vue I18n
  * Iconify
  * TypeScript

* Backend:

  * Node.js
  * Fastify
  * PostgreSQL
  * `pg`
  * TypeScript

* Infra:

  * Docker
  * docker compose

---

## Existing Product Shape

* Public users can browse Wiki content.
* Registered users must verify email before editing.
* Verified users can edit Wiki content and management data; there is no separate role system currently.
* Main public sections:

  * Pokemon
  * Habitats
  * Items
  * Recipes
  * Daily CheckList

* Management covers:

  * System config
  * Languages
  * Daily CheckList tasks
  * Sorting for Pokemon, items, recipes, and habitats

* Main entity create/edit flows use route-backed modal dialogs.
* Internationalization is part of the product model, not just UI copy.
* Detailed edit history and editor attribution are part of entity detail behavior.

---

## UI Design Guidelines

* Use `DesignGuidelines.html` as the reference for UI design, visual style, and component behavior.
* Prefer reusing existing components that already match the guidelines.
* Existing shared UI patterns include:

  * `AppShell`
  * `PageHeader`
  * `Modal`
  * `FilterPanel`
  * `EntityCard`
  * `DetailSection`
  * `EditMeta`
  * `EditHistoryPanel`
  * `Skeleton`
  * `Tabs`
  * `SwitchGroup`
  * `TagsSelect`
  * `TranslationFields`
  * `ReorderableList`

* If a needed component does not exist, create the smallest necessary component based on `DesignGuidelines.html`.
* Existing components may be upgraded to match `DesignGuidelines.html`, but only when directly related to the task.
* Do not introduce broad UI rewrites, new design systems, or extra abstraction layers unless explicitly required.
* Use Skeleton loaders for data loading states instead of user-facing loading remarks when the existing page pattern supports it.
* Use icon-based navigation and actions consistently with the existing Iconify setup.

---

## Scope Control (Prevent Code Bloat)

* Only modify files directly related to the task.
* Do NOT:

  * Introduce new layers (services, utils, hooks, etc.) unless clearly required
  * Split files unnecessarily
  * Rewrite existing modules without explicit instruction
  * Change unrelated route, API, or schema behavior while working on UI-only tasks

* Prefer editing existing files over creating new ones.
* Keep functions and components small and readable.

If a task grows beyond scope, STOP and ask.

---

## Git Diff Hygiene

* Do not inspect, summarize, or report diffs for `data/**/*.csv` by default.
* In WSL, CSV files under `data` may appear changed even when their content has not meaningfully changed.
* Ignore `data/**/*.csv` entries in `git status` / `git diff` unless the task explicitly involves CSV data, import/seed data, or the user asks to check them.
* Only mention CSV files in final change summaries if you intentionally changed them or verified they are relevant to the current task.

---

## UI Safety Rules (CRITICAL)

User-facing UI must NEVER contain:

* prompts
* remarks
* planning notes
* debug messages
* explanations of what was changed
* internal field names like `debug`, `meta`, `internal`

### Strict Rules

* Only render **business data** and intended UI text.
* Never display:

  * "Updated successfully because..."
  * "Changed X to Y"
  * "TODO", "NOTE", "DEBUG"

* Debug information must go to logs, not UI.
* Separate internal data from API responses.
* Do not expose raw database column names in user-facing labels unless `DESIGN.md` explicitly defines that label.

Violations are considered critical errors.

---

## Data, API, and i18n Rules

* Follow `DESIGN.md` as the **single source of truth**.
* PostgreSQL:

  * use `snake_case`
  * define proper primary/foreign keys
  * preserve existing audit columns on editable entities
  * preserve `sort_order` behavior for sortable lists
  * avoid premature optimization

* APIs:

  * return only necessary fields
  * do not expose password hashes, verification token hashes, session token hashes, or internal metadata
  * expose editor attribution with only `id` and `displayName`
  * keep API response shapes consistent with `frontend/src/services/api.ts`

* i18n:

  * use `languages` and `entity_translations` for entity translations
  * use `X-Locale` for localized API reads
  * keep base `name` / `title` fields as the default-language source
  * do not let localized editing overwrite the base field unintentionally
  * include translations only where the current API shape already supports them

* Editing and audit:

  * create/update/delete operations on Wiki content should record editor information
  * detail pages should continue to support edit metadata and edit history
  * delete or update behavior must not leak internal audit payloads to normal UI

---

## Code Style & Structure

* Vue:

  * Components: `PascalCase`
  * Composables: `useXxx`

* General:

  * variables/functions: `camelCase`
  * TypeScript types/interfaces: match existing local style

* Keep files focused and under reasonable length.
* Avoid duplication.
* Prefer existing helper APIs and local patterns over introducing new abstractions.

---

## Testing & Validation

This project is developed from WSL, but runtime validation is done through Docker.

Agent workflow:

* Run when practical:

  * `pnpm lint`
  * `pnpm typecheck`

* Do NOT run tests in WSL.
* Do NOT require local test execution before finishing a task.
* The user will run `docker compose up --build`.
* If Docker reports errors, the user will paste the error output and the agent will fix those errors in a follow-up pass.

When adding tests is clearly useful, keep them focused and minimal, but do not execute them locally unless explicitly requested.

---

## Definition of Done

A task is complete ONLY IF:

* Matches `DESIGN.md`.
* Updates `DESIGN.md` when the implemented behavior changes product, API, schema, permission, route, or i18n expectations.
* Minimal diff, with no unrelated changes.
* No UI leaks of internal info.
* Code is readable and concise.
* Passes lint/typecheck when practical.
* Docker runtime issues are handled from user-provided `docker compose up --build` output.

---

## Anti-Patterns (STRICTLY FORBIDDEN)

* Adding UI remarks like "I updated this"
* Over-engineering simple features
* Creating unused files or abstractions
* Mixing internal/debug data into UI
* Exposing token/hash/internal audit data through public API responses
* Large, unfocused commits
* Silent behavior changes outside scope

---

## When Unsure

* Ask for clarification.
* Do not guess requirements.
* Do not invent features not in `DESIGN.md`.
* If current code and `DESIGN.md` disagree, call out the mismatch before changing behavior.
