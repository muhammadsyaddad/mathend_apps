# Mathend Monorepo

Mathend is a Bun + Turborepo workspace with three apps:

- `apps/mathend`: main product (math note workspace, OAuth provider connect, agent panel)
- `apps/desktop`: Tauri desktop app with local-first persistence
- `apps/web`: marketing site

This repository is AI-first documented. Start with `AGENTS.md`, then follow the docs in `docs/`.

## Quick Start

Prerequisites:

- Bun `1.3.11` (see `package.json`)
- Node `>=18`

Install dependencies:

```bash
bun install
```

Run main app (default):

```bash
bun run dev
```

Run desktop web UI only:

```bash
bun run dev:desktop
```

Run Tauri desktop shell:

```bash
bun run tauri:dev
```

Run marketing web app:

```bash
bun run --filter web dev
```

## Common Commands

```bash
# Lint all workspaces
bun run lint

# Typecheck all workspaces
bun run check-types

# Run tests (from /test workspace)
bun run test

# Local quality gate
bun run verify
```

Scope checks:

```bash
bun run --filter mathend lint
bun run --filter mathend check-types

bun run --filter desktop lint
bun run --filter desktop check-types

bun run --filter web lint
bun run --filter web check-types
```

## Documentation Index

- `AGENTS.md`: AI operating contract and task routing
- `docs/repo-map.md`: folder ownership and where to edit
- `docs/architecture.md`: high-level app and data flow
- `docs/runbook.md`: exact local commands
- `docs/testing.md`: test strategy and gates
- `docs/env.md`: environment variable reference
- `docs/conventions.md`: coding and change conventions

## Product Context

`AGENT.md` contains current product brief context for the document library redesign. Treat it as product intent context, not as the operational AI contract.

## Security

- Do not commit secrets or local-only values.
- Use `apps/mathend/.env.example` as the only template for env onboarding.
- Keep `.env` files local.
