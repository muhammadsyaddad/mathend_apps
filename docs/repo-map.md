# Repo Map

Last updated: 2026-04-11
Owner: repo maintainers

## Purpose

Use this file to quickly decide where changes belong.

Default target is `apps/mathend`.

## Top-Level Layout

```text
apps/
  mathend/   # main product app (Next.js)
  desktop/   # Tauri desktop app (Vite + React + Rust shell)
  web/       # marketing app (Next.js)
packages/
  ui/                # shared UI primitives
  eslint-config/     # shared ESLint config
  typescript-config/ # shared TypeScript config
test/         # vitest workspace and test suites
docs/         # AI-first operating docs
```

## Ownership by Task

- Mathend UI and UX
  - `apps/mathend/app/page.tsx`
  - `apps/mathend/app/components/**`
  - `apps/mathend/app/globals.css`
- Mathend API routes
  - `apps/mathend/app/api/**/route.ts`
- OAuth runtime and cookie helpers
  - `apps/mathend/app/lib/oauth-provider-runtime.ts`
  - `apps/mathend/app/lib/oauth-security.ts`
  - `apps/mathend/app/lib/oauth-cookie-utils.ts`
  - `apps/mathend/app/lib/oauth-types.ts`
- Agent chat runtime
  - `apps/mathend/app/lib/agent-provider-chat-runtime.ts`
  - `apps/mathend/app/lib/agent-chat-live.ts`
  - `apps/mathend/app/lib/agent-chat.ts`
- Gumroad license runtime and routes
  - `apps/mathend/app/lib/gumroad-license.ts`
  - `apps/mathend/app/lib/license-session.ts`
  - `apps/mathend/app/lib/license-types.ts`
  - `apps/mathend/app/api/license/**/route.ts`
  - `apps/mathend/app/components/license-gate.tsx`
- Desktop UI and behavior
  - `apps/desktop/src/**`
- Desktop local-first persistence
  - `apps/desktop/src/lib/note-db.ts`
  - `apps/desktop/src-tauri/**`
- Desktop license runtime and UI gate
  - `apps/desktop/src/components/license-gate.tsx`
  - `apps/desktop/src/lib/license-runtime.ts`
  - `apps/desktop/src/lib/license-types.ts`
  - `apps/desktop/src-tauri/src/license.rs`
- Marketing website
  - `apps/web/app/**`
- Shared UI primitives
  - `packages/ui/src/**`
- Tests
  - `test/mathend/**`
  - `test/docs/**`

## Do Not Edit by Default

- `node_modules/**`
- `apps/*/.next/**`
- `apps/desktop/dist/**`
- Generated lock artifacts unless dependency changes are intended

## Routing Rules

- If request does not mention app scope, edit only `apps/mathend`.
- Touch `apps/desktop` or `apps/web` only when explicitly requested or when a shared package change requires it.
- If changing shared package behavior, add or update tests in `test/`.
