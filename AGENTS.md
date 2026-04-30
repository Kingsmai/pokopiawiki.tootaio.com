# AGENTS.md

## Core Principles

* Always read `DESIGN.md` before making any change.
* Follow the existing structure and conventions strictly.
* Make **minimal, targeted changes only**. Do not refactor unrelated code.
* Prefer clarity over cleverness. Avoid unnecessary abstraction.

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

---

## UI Design Guidelines

* Use `DesignGuidelines.html` as the reference for UI design, visual style, and component behavior.
* Prefer reusing existing components that already match the guidelines.
* If a needed component does not exist, create the smallest necessary component based on `DesignGuidelines.html`.
* Existing components may be upgraded to match `DesignGuidelines.html`, but only when directly related to the task.
* Do not introduce broad UI rewrites, new design systems, or extra abstraction layers unless explicitly required.

---

## Scope Control (Prevent Code Bloat)

* Only modify files directly related to the task.
* Do NOT:

  * Introduce new layers (services, utils, hooks, etc.) unless clearly required
  * Split files unnecessarily
  * Rewrite existing modules without explicit instruction
* Prefer editing existing files over creating new ones.
* Keep functions and components small and readable.

If a task grows beyond scope, STOP and ask.

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

* Only render **business data** and intended UI text
* Never display:

  * "Updated successfully because..."
  * "Changed X to Y"
  * "TODO", "NOTE", "DEBUG"
* Debug information must go to logs, not UI
* Separate internal data from API responses

Violations are considered critical errors.

---

## Data & API Design Rules

* Follow `DESIGN.md` as the **single source of truth**
* PostgreSQL:

  * use `snake_case`
  * define proper primary/foreign keys
  * avoid premature optimization
* APIs:

  * return only necessary fields
  * do not expose internal metadata

---

## Code Style & Structure

* Vue:

  * Components: `PascalCase`
  * Composables: `useXxx`
* General:

  * variables/functions: `camelCase`
* Keep files focused and under reasonable length
* Avoid duplication

---

## Testing & Validation

This project is developed from WSL, but runtime validation is done through Docker.

Agent workflow:

* Run:

  * lint
  * typecheck

* Do NOT run tests in WSL.
* Do NOT require local test execution before finishing a task.
* The user will run `docker compose up --build`.
* If Docker reports errors, the user will paste the error output and the agent will fix those errors in a follow-up pass.

When adding tests is clearly useful, keep them focused and minimal, but do not execute them locally unless explicitly requested.

---

## Definition of Done

A task is complete ONLY IF:

* Matches `DESIGN.md`
* Minimal diff (no unrelated changes)
* No UI leaks of internal info
* Code is readable and concise
* Passes lint/typecheck when practical
* Docker runtime issues are handled from user-provided `docker compose up --build` output

---

## Anti-Patterns (STRICTLY FORBIDDEN)

* Adding UI remarks like "I updated this"
* Over-engineering simple features
* Creating unused files or abstractions
* Mixing internal/debug data into UI
* Large, unfocused commits
* Silent behavior changes outside scope

---

## When Unsure

* Ask for clarification
* Do not guess requirements
* Do not invent features not in `DESIGN.md`

---

## Project Context

* Goal: Pokopia Wiki
* Stack:

  * Frontend: Vue
  * Backend: Node + PostgreSQL
  * Infra: Docker
