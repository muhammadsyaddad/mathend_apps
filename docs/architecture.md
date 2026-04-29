# Architecture

Last updated: 2026-04-08
Owner: repo maintainers

## Stack Overview

- Monorepo: Turborepo
- Package manager: Bun (`bun@1.3.11`)
- Frontend: React 19
- Main app: Next.js 16 (`apps/mathend`)
- Marketing app: Next.js 16 (`apps/web`)
- Desktop app: Vite + React + Tauri (`apps/desktop`)
- Testing: Vitest (`test` workspace)

## Workspace Roles

- `apps/mathend`
  - Primary product workspace.
  - Document workspace UI, local note interactions, Typst preview/export.
  - Server routes for OAuth and agent chat in `app/api/**`.
  - Runtime integrations live in `app/lib/**`.
- `apps/desktop`
  - Desktop delivery of similar core editing flow.
  - Local-first persistence via SQLite through Tauri plugin.
  - Rust shell code in `src-tauri/`.
- `apps/web`
  - Marketing and landing content only.
- `packages/ui`
  - Shared primitive components used by apps.
- `test`
  - Repository-level tests for `apps` and `packages` behavior.

## Core Runtime Flows

### 1) OAuth Connect Flow (`apps/mathend`)

- Entry: `POST /api/oauth/connect`
- Provider config: `app/lib/oauth-provider-runtime.ts`
- State and device-code cookies: `app/lib/oauth-cookie-utils.ts`
- Callback exchange: `GET /api/oauth/callback/[providerId]`
- Device poll exchange: `POST /api/oauth/device/poll`
- Connected/token state is stored in cookies (`OAUTH_CONNECTIONS_COOKIE`, `OAUTH_TOKENS_COOKIE`)

### 2) Agent Chat Flow (`apps/mathend`)

- Entry: `POST /api/agent/chat`
- Validates provider connection from OAuth cookies.
- Resolves runtime config from `app/lib/agent-provider-chat-runtime.ts`.
- Uses live provider call (`agent-chat-live.ts`) when token is available.
- Supports optional NDJSON streaming events (`plan`, `delta`, `done`, `error`) when client sends `stream: true`.
- Falls back to mock response generation (`agent-chat.ts`) on failure/no token.
- Can return structured `workspaceActions` to modify active note content.

### 3) Math Editing and Export Flow (`apps/mathend` / `apps/desktop`)

- Main editor surface in `app/page.tsx` (and desktop `src/App.tsx`).
- Slash commands and natural intent parsing map to Typst-first math snippets.
- Syntax map includes advanced domains (vector calculus, ODE/PDE, probability-statistics, complex analysis, transforms, optimization, logic-set).
- Agent workspace writes are normalized to cleaner Typst-oriented syntax before persistence.
- Typst runtime (`@myriaddreamin/typst-all-in-one.ts`) renders preview and exports PDF/PNG.
- Mathend currently persists note/session state in browser storage.
- Desktop persists note/session state through local SQLite (`src/lib/note-db.ts`).

### 4) Lemon Squeezy License Flow (`apps/mathend`)

- Entry: `POST /api/license/activate`
- Status check: `GET /api/license/status`
- Session clear: `POST /api/license/deactivate`
- Runtime config: `app/lib/lemonsqueezy-license.ts`
- Signed cookie helpers: `app/lib/license-session.ts`
- Session payload type: `app/lib/license-types.ts`
- UI gate before workspace: `app/components/license-gate.tsx`

## Shared and Boundaries

- Shared UI should stay in `packages/ui` when reused across apps.
- App-specific logic stays in each app workspace.
- Cross-app changes require root-level lint/typecheck/test verification.
