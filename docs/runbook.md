# Runbook

Last updated: 2026-04-15
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

Open strict download gate page:

```bash
http://localhost:3001/download
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

## Desktop Release Pipeline (Private Binaries)

Release workflow: `.github/workflows/desktop-release.yml`

Trigger options:

- Push tag `desktop-v*` (production release path)
- Manual `workflow_dispatch` with `version` input (useful for `-rc` dry run)

Required GitHub repository secrets (repo: `muhammadsyaddad/mathend_apps`):

- `BINARIES_REPO` (example: `muhammadsyaddad/mathend-desktop-binaries`)
- `BINARIES_REPO_TOKEN_WRITE` (fine-grained PAT with release/assets write on private binaries repo)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_DEPLOY_HOOK_URL` (optional but recommended)

Release flow handled by workflow:

1. Build Tauri installer on Windows, macOS, Linux
2. Rename artifacts to canonical names:
   - `mathend-desktop-<version>-windows-x64.msi`
   - `mathend-desktop-<version>-macos-universal.dmg`
   - `mathend-desktop-<version>-linux-x64.AppImage`
3. Publish artifacts to private release in `BINARIES_REPO`
4. Resolve private GitHub asset API URLs (`/releases/assets/<asset_id>`)
5. Upsert Vercel production env:
   - `WEB_DOWNLOAD_WINDOWS_URL`
   - `WEB_DOWNLOAD_MACOS_URL`
   - `WEB_DOWNLOAD_LINUX_URL`
   - `WEB_DOWNLOAD_WINDOWS_FILENAME`
   - `WEB_DOWNLOAD_MACOS_FILENAME`
   - `WEB_DOWNLOAD_LINUX_FILENAME`
6. Trigger Vercel deploy hook (if configured)

### Production release SOP

1. Bump desktop versions in:
   - `apps/desktop/package.json`
   - `apps/desktop/src-tauri/tauri.conf.json`
2. Create and push release tag:

```bash
git tag desktop-vX.Y.Z
git push origin desktop-vX.Y.Z
```

3. Wait for `.github/workflows/desktop-release.yml` to pass
4. Verify private binaries release has 3 platform artifacts
5. Verify Vercel env values are updated
6. Test web gate download flow on `/download`

### Dry run SOP (recommended)

Run workflow manually (`workflow_dispatch`) with version like `0.1.0-rc1`.

### Rollback SOP

1. Set Vercel `WEB_DOWNLOAD_*_URL` back to previous known-good release asset URLs
2. Optionally set `WEB_DOWNLOAD_*_FILENAME` back to previous values
3. Trigger redeploy (hook or dashboard)
4. Mark broken private binary release as draft or delete broken assets

## Troubleshooting

- Port conflict (3000/3001/1420): stop previous process or run targeted workspace command.
- Missing OAuth env: copy `apps/mathend/.env.example` to `apps/mathend/.env.local` and fill values.
- Missing Gumroad license env: ensure `GUMROAD_PRODUCT_ID` and `LICENSE_COOKIE_SECRET` are set in `apps/mathend/.env.local`.
- Missing desktop Gumroad env: copy `apps/desktop/.env.example` to `apps/desktop/.env` and set `VITE_GUMROAD_PRODUCT_ID`.
- Missing web strict-download env: copy `apps/web/.env.example` to `apps/web/.env.local` and set `GUMROAD_PRODUCT_ID`, `LICENSE_COOKIE_SECRET`, and `WEB_DOWNLOAD_<PLATFORM>_URL` values.
- Desktop release upload fails: verify `BINARIES_REPO` and `BINARIES_REPO_TOKEN_WRITE` permissions to private binaries repo releases/assets.
- Vercel env sync fails: verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets and project access.
- Type errors after dependency updates: run `bun install` then `bun run check-types`.
