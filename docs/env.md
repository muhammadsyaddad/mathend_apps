# Environment Variables

Last updated: 2026-04-11
Owner: repo maintainers

## Policy

- Never commit secrets.
- Use `apps/mathend/.env.example` as the baseline template.
- Keep local values in `apps/mathend/.env.local`.
- Treat `.env` as local-only.

## Setup

From repo root:

```bash
cp apps/mathend/.env.example apps/mathend/.env.local
```

Then fill values in `apps/mathend/.env.local`.

## Variables (`apps/mathend`)

### Gumroad Licensing

- `GUMROAD_PRODUCT_ID` (required for license verification)
- `GUMROAD_API_BASE` (optional, default: `https://api.gumroad.com`)
- `GUMROAD_CHECKOUT_URL` (optional, default: `https://muhamsyad.gumroad.com/l/mathend`)
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

### Gumroad Licensing (Desktop)

- `VITE_GUMROAD_PRODUCT_ID` (required for desktop license verification)
- `VITE_GUMROAD_API_BASE` (optional, default: `https://api.gumroad.com`)
- `VITE_GUMROAD_CHECKOUT_URL` (optional, default: `https://muhamsyad.gumroad.com/l/mathend`)
- `VITE_LICENSE_REVERIFY_DAYS` (optional, default: `7`)

## OAuth Callback URLs (local)

- `http://localhost:3000/api/oauth/callback/github-copilot`
- `http://localhost:3000/api/oauth/callback/claude-code`

Register these callback URLs in the relevant OAuth providers for local development.
