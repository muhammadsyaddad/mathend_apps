# Runbook

Last updated: 2026-04-11
Owner: repo maintainers

## Prerequisites

- Bun `1.3.11`
- Node `>=18`

Install dependencies from repo root:

```bash
bun install
```

## Local Development

Run default app (`mathend`):

```bash
bun run dev
```

Run desktop web-only dev mode:

```bash
bun run dev:desktop
```

Run desktop Tauri shell:

```bash
bun run tauri:dev
```

Run marketing app:

```bash
bun run --filter web dev
```

## Build Commands

Build all workspaces:

```bash
bun run build
```

Build desktop Tauri bundle:

```bash
bun run tauri:build
```

## Verification Commands

Global checks:

```bash
bun run lint
bun run check-types
bun run test
bun run verify
```

App-scoped checks:

```bash
bun run --filter mathend lint
bun run --filter mathend check-types

bun run --filter desktop lint
bun run --filter desktop check-types

bun run --filter web lint
bun run --filter web check-types
```

## Testing Commands

Run from root:

```bash
bun run test
bun run test:watch
bun run test:coverage
```

## CI Baseline

Current CI workflow (`.github/workflows/test.yml`) runs:

1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bun run check-types`
4. `bun run test`
5. `bun run test:coverage`

## Troubleshooting

- Port conflict (3000/3001/1420): stop previous process or run targeted workspace command.
- Missing OAuth env: copy `apps/mathend/.env.example` to `apps/mathend/.env.local` and fill values.
- Missing Gumroad license env: ensure `GUMROAD_PRODUCT_ID` and `LICENSE_COOKIE_SECRET` are set in `apps/mathend/.env.local`.
- Missing desktop Gumroad env: copy `apps/desktop/.env.example` to `apps/desktop/.env` and set `VITE_GUMROAD_PRODUCT_ID`.
- Type errors after dependency updates: run `bun install` then `bun run check-types`.
