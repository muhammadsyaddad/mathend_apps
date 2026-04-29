# Mathend Desktop (Tauri)

Desktop app for Mathend with local-first storage.

## Scope

- Same core notes UI as `apps/mathend`
- Local persistence using SQLite in Tauri app data
- Typst preview and export kept in-app
- OAuth/agent backend flows are intentionally excluded in this phase

## Desktop License Activation

Desktop app now requires Lemon Squeezy activation before opening the workspace.

1. Copy env template and fill values:

```bash
cp apps/desktop/.env.example apps/desktop/.env
```

2. Set at least:

```bash
VITE_LEMONSQUEEZY_PRODUCT_ID=
```

Optional:

```bash
VITE_LEMONSQUEEZY_API_BASE=https://api.lemonsqueezy.com
VITE_LEMONSQUEEZY_CHECKOUT_URL=https://lemonsqueezy.com
VITE_LICENSE_REVERIFY_DAYS=7
```

3. Start desktop app:

```bash
bun run --filter desktop tauri:dev
```

When activation succeeds, desktop session is stored locally in SQLite (`license_state` table).

## Run

From monorepo root:

```bash
bun run --filter desktop tauri:dev
```

You can also run web-only desktop UI with:

```bash
bun run --filter desktop dev
```
