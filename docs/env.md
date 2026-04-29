# Environment Variables

Last updated: 2026-04-15
Owner: repo maintainers

## Policy

- Never commit secrets.
- Use `apps/mathend/.env.example` as the baseline template.
- Keep local values in `apps/mathend/.env.local`.
- Treat `.env` as local-only.

Templates:

- `apps/mathend/.env.example`
- `apps/web/.env.example`
- `apps/desktop/.env.example`

## Setup

From repo root:

```bash
cp apps/mathend/.env.example apps/mathend/.env.local
```

Then fill values in `apps/mathend/.env.local`.

## Variables (`apps/mathend`)

### Lemon Squeezy Licensing

- `LEMONSQUEEZY_PRODUCT_ID` (required for license verification)
- `LEMONSQUEEZY_API_BASE` (optional, default: `https://api.lemonsqueezy.com`)
- `LEMONSQUEEZY_CHECKOUT_URL` (optional, default: `https://lemonsqueezy.com`)
- `LICENSE_COOKIE_SECRET` (required, server-only signing key for license session cookie)
- `LICENSE_REVERIFY_DAYS` (optional, default: `7`)

### GitHub Copilot OAuth

- `MATHEND_GITHUB_COPILOT_CLIENT_ID` (required)
- `MATHEND_GITHUB_COPILOT_CLIENT_SECRET` (optional for device-code flow, still supported)
- `MATHEND_GITHUB_COPILOT_AUTH_URL` (optional, default provided)
- `MATHEND_GITHUB_COPILOT_TOKEN_URL` (optional, default provided)
- `MATHEND_GITHUB_COPILOT_DEVICE_CODE_URL` (optional, default provided)
- `MATHEND_GITHUB_COPILOT_SCOPE` (optional, default: `read:user`)
- `MATHEND_GITHUB_COPILOT_PROFILE_URL` (optional, default provided)

### Claude Code OAuth

- `MATHEND_CLAUDE_CODE_CLIENT_ID` (required)
- `MATHEND_CLAUDE_CODE_CLIENT_SECRET` (required)
- `MATHEND_CLAUDE_CODE_AUTH_URL` (required)
- `MATHEND_CLAUDE_CODE_TOKEN_URL` (required)
- `MATHEND_CLAUDE_CODE_SCOPE` (optional)
- `MATHEND_CLAUDE_CODE_PROFILE_URL` (optional)

### Agent Chat Endpoints

- `MATHEND_GITHUB_COPILOT_CHAT_ENDPOINT` (optional, default: `https://api.githubcopilot.com/chat/completions`)
- `MATHEND_GITHUB_COPILOT_CHAT_MODEL` (optional, default: `gpt-4o-mini`)
- `MATHEND_CLAUDE_CODE_CHAT_ENDPOINT` (optional)
- `MATHEND_CLAUDE_CODE_CHAT_MODEL` (optional)

### GitHub Models Direct Token Mode (optional fallback)

- `MATHEND_GITHUB_MODELS_PAT` (optional)
- `MATHEND_GITHUB_MODELS_ORG` (optional)
- `MATHEND_GITHUB_MODELS_ALLOW_BROWSER_MODEL_OVERRIDE` (optional)

Default flow now uses OAuth + server-side Copilot token exchange for GitHub Copilot chat, so end users do not need PAT.

## Variables (`apps/desktop`)

### Lemon Squeezy Licensing (Desktop)

- `VITE_LEMONSQUEEZY_PRODUCT_ID` (required for desktop license verification)
- `VITE_LEMONSQUEEZY_API_BASE` (optional, default: `https://api.lemonsqueezy.com`)
- `VITE_LEMONSQUEEZY_CHECKOUT_URL` (optional, default: `https://lemonsqueezy.com`)
- `VITE_LICENSE_REVERIFY_DAYS` (optional, default: `7`)

## Variables (`apps/web`)

### Lemon Squeezy Licensing (Web download gate)

- `LEMONSQUEEZY_PRODUCT_ID` (required)
- `LEMONSQUEEZY_API_BASE` (optional, default: `https://api.lemonsqueezy.com`)
- `LEMONSQUEEZY_CHECKOUT_URL` (optional, default: `https://lemonsqueezy.com`)
- `LICENSE_COOKIE_SECRET` (required, signing key for web license session cookie)
- `LICENSE_REVERIFY_DAYS` (optional, default: `7`)

### Strict Desktop Download Gate (Web)

- `WEB_DOWNLOAD_WINDOWS_URL` (auto-managed by desktop release workflow; points to private GitHub release asset API URL)
- `WEB_DOWNLOAD_MACOS_URL` (auto-managed by desktop release workflow; points to private GitHub release asset API URL)
- `WEB_DOWNLOAD_LINUX_URL` (auto-managed by desktop release workflow; points to private GitHub release asset API URL)
- `WEB_DOWNLOAD_WINDOWS_FILENAME` (recommended; auto-managed per release)
- `WEB_DOWNLOAD_MACOS_FILENAME` (recommended; auto-managed per release)
- `WEB_DOWNLOAD_LINUX_FILENAME` (recommended; auto-managed per release)
- `WEB_DOWNLOAD_TOKEN_SECRET` (optional; fallback to `LICENSE_COOKIE_SECRET`)
- `WEB_DOWNLOAD_TOKEN_TTL_SECONDS` (optional, default: `300`, clamped `30..3600`)
- `WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN` (required for private upstream; read-only GitHub token used by web proxy route)

## Auto-Managed vs Static (`apps/web`)

Static env (set once, manually managed):

- `LEMONSQUEEZY_PRODUCT_ID`
- `LEMONSQUEEZY_API_BASE`
- `LEMONSQUEEZY_CHECKOUT_URL`
- `LICENSE_COOKIE_SECRET`
- `LICENSE_REVERIFY_DAYS`
- `WEB_DOWNLOAD_TOKEN_SECRET`
- `WEB_DOWNLOAD_TOKEN_TTL_SECONDS`
- `WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN`

Auto-managed env (updated every desktop release by `.github/workflows/desktop-release.yml`):

- `WEB_DOWNLOAD_WINDOWS_URL`
- `WEB_DOWNLOAD_MACOS_URL`
- `WEB_DOWNLOAD_LINUX_URL`
- `WEB_DOWNLOAD_WINDOWS_FILENAME`
- `WEB_DOWNLOAD_MACOS_FILENAME`
- `WEB_DOWNLOAD_LINUX_FILENAME`

Notes:

- Auto-managed values target Vercel `production` environment.
- URL values use GitHub API asset endpoint format: `https://api.github.com/repos/<owner>/<private-repo>/releases/assets/<asset_id>`.
- Web proxy route must send `Authorization: Bearer <WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN>` and GitHub asset download headers to stream binaries reliably.
- Use separate tokens: `BINARIES_REPO_TOKEN_WRITE` for GitHub Actions publish, `WEB_DOWNLOAD_UPSTREAM_BEARER_TOKEN` as read-only token in Vercel.

## OAuth Callback URLs (local)

- `http://localhost:3000/api/oauth/callback/github-copilot`
- `http://localhost:3000/api/oauth/callback/claude-code`

Register these callback URLs in the relevant OAuth providers for local development.
