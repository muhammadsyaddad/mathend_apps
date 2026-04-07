# Mathend Desktop (Tauri)

Desktop app for Mathend with local-first storage.

## Scope

- Same core notes UI as `apps/mathend`
- Local persistence using SQLite in Tauri app data
- Typst preview and export kept in-app
- OAuth/agent backend flows are intentionally excluded in this phase

## Run

From monorepo root:

```bash
bun run --filter desktop tauri:dev
```

You can also run web-only desktop UI with:

```bash
bun run --filter desktop dev
```
