# Mathend Web (Marketing + Strict Download Gate)

`apps/web` is the public marketing website and the canonical license-first
download portal for Mathend Desktop.

## Scope

- Marketing landing page (`app/page.tsx`)
- Download center (`app/download/page.tsx`)
- License session API (`app/api/license/**`)
- Strict installer gate API (`app/api/download/**`)

## Local Run

From monorepo root:

```bash
bun run --filter web dev
```

Web app runs on `http://localhost:3001`.

## Environment Setup

1. Create local env file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

2. Fill required values:

```bash
LEMONSQUEEZY_PRODUCT_ID=
LICENSE_COOKIE_SECRET=
WEB_DOWNLOAD_WINDOWS_URL=
WEB_DOWNLOAD_MACOS_URL=
WEB_DOWNLOAD_LINUX_URL=
```

Optional values:

```bash
LEMONSQUEEZY_API_BASE=https://api.lemonsqueezy.com
LEMONSQUEEZY_CHECKOUT_URL=https://lemonsqueezy.com
LICENSE_REVERIFY_DAYS=7
WEB_DOWNLOAD_TOKEN_SECRET=
WEB_DOWNLOAD_TOKEN_TTL_SECONDS=300
WEB_DOWNLOAD_WINDOWS_FILENAME=
WEB_DOWNLOAD_MACOS_FILENAME=
WEB_DOWNLOAD_LINUX_FILENAME=
WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN=
```

## Strict Download Flow

1. Buyer opens `/download`
2. Buyer activates Lemon Squeezy license (`POST /api/license/activate`)
3. Frontend asks catalog (`GET /api/download/catalog`)
4. API returns short-lived, signed links per platform
5. Buyer downloads via `GET /api/download/file?platform=...&token=...`
6. Route re-validates token + license session, then streams installer

Desktop app still has in-app activation gate after installation.

## Verify

```bash
bun run --filter web lint
bun run --filter web check-types
```
