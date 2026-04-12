# Testing Guide

Last updated: 2026-04-07
Owner: repo maintainers

## Test Workspace

- Test workspace root: `test/`
- Runner: Vitest
- Environment: `jsdom`
- Setup file: `test/setup.ts`
- Config: `test/vitest.config.ts`

## Current Test Scope

- `test/mathend/**`
  - mathend UI and runtime behavior checks
  - oauth and agent runtime unit tests
- `test/docs/**`
  - shared UI trust checks (currently `packages/ui` button behavior)

## Standard Commands

Run from repo root:

```bash
bun run test
bun run test:watch
bun run test:coverage
```

## Coverage Baseline

Coverage thresholds are enforced in `test/vitest.config.ts`:

- statements: 60
- branches: 40
- functions: 55
- lines: 60

## When Tests Are Required

- Bug fix: add at least one test that reproduces and protects the fix.
- Shared runtime/API behavior change: add/update unit tests.
- UI behavior change that users can observe: add/update behavior-level tests.

## Test Authoring Rules

- Keep tests under `test/` with mirrored structure when possible.
- File naming: `*.test.ts` or `*.test.tsx`.
- Prefer user-visible assertions for UI, and deterministic assertions for runtime logic.
- Keep fixtures minimal and local to test file unless reused.

## Recommended Gate by Change Scope

- Docs-only changes: no mandatory runtime tests.
- `apps/mathend` changes: run mathend lint + typecheck, then run affected tests.
- Shared package or cross-app behavior changes: run `bun run verify`.
