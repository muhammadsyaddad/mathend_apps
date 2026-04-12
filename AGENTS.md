# AGENTS Guide

Last updated: 2026-04-07
Owner: repo maintainers

This file is the AI-first operating contract for this repository.

## 1) Mission and Priorities

Use this priority order when tradeoffs happen:

1. Correctness and safety
2. Preserve existing behavior unless change is requested
3. Small, targeted diffs
4. Developer experience and polish

Default product focus is `apps/mathend`.

- If a task does not explicitly mention `desktop` or `web`, assume `mathend`.
- Only touch `apps/desktop` or `apps/web` when explicitly requested, or when a shared-package change requires it.

## 2) Source of Truth

When docs conflict, use this order:

1. User request in current session
2. `AGENTS.md` (this file)
3. `docs/*.md`
4. Package scripts and config (`package.json`, `turbo.json`, app package files)
5. Legacy notes (`AGENT.md`, `notes.md`, `to-do-today.md`)

Product brief context is currently stored in `AGENT.md`.

## 3) Repo Routing

Use these docs first:

- `docs/repo-map.md` for where to edit
- `docs/architecture.md` for flow-level understanding
- `docs/runbook.md` for exact commands
- `docs/testing.md` for test expectations
- `docs/env.md` for environment variables
- `docs/conventions.md` for coding and change conventions

## 4) Edit Boundaries

Do:

- Keep changes scoped to requested behavior.
- Prefer existing patterns in the touched area.
- Update docs when commands, paths, or workflows change.

Do not:

- Commit secrets (`.env`, API keys, tokens).
- Refactor unrelated modules in the same PR.
- Rename files or move folders unless required by the task.

## 5) Task-to-File Mapping

- Mathend UI/UX: `apps/mathend/app/page.tsx`, `apps/mathend/app/components/**`, `apps/mathend/app/globals.css`
- Mathend API routes: `apps/mathend/app/api/**/route.ts`
- OAuth runtime/config: `apps/mathend/app/lib/oauth-*.ts`
- Agent chat runtime/config: `apps/mathend/app/lib/agent-*.ts`
- Desktop app UI: `apps/desktop/src/**`
- Desktop local-first persistence: `apps/desktop/src/lib/note-db.ts`, `apps/desktop/src-tauri/**`
- Marketing web app: `apps/web/app/**`
- Shared UI primitives: `packages/ui/src/**`
- Tests: `test/**`

## 6) Verification Matrix

Run the smallest valid checks for the touched scope:

- Docs-only changes: no mandatory runtime checks
- `apps/mathend` changes:
  - `bun run --filter mathend lint`
  - `bun run --filter mathend check-types`
- `apps/desktop` changes:
  - `bun run --filter desktop lint`
  - `bun run --filter desktop check-types`
- `apps/web` changes:
  - `bun run --filter web lint`
  - `bun run --filter web check-types`
- Shared package or cross-app behavior changes:
  - `bun run lint`
  - `bun run check-types`
  - `bun run test`

Before merge, preferred full gate:

- `bun run verify`

## 7) Definition of Done

A task is done when all are true:

- Requested behavior is implemented and scoped.
- Relevant checks for touched scope pass locally (or blockers are clearly reported).
- No secrets or local-only values are added.
- Related docs are updated if behavior/commands changed.
- File references in final report are precise.

## 8) Docs Maintenance Rule

Whenever any of these change, update docs in the same PR:

- Script names or command flags
- Folder ownership or architecture boundaries
- Environment variables
- Test strategy or coverage gates

If unsure, update `docs/runbook.md` and `docs/repo-map.md` first.
