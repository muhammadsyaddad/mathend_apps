# Glossary

Last updated: 2026-04-07
Owner: repo maintainers

## Product Terms

- Mathend
  - Main note workspace app in `apps/mathend`.
- Document Library
  - Main notes list and access flow in the primary workspace UI.
- Agent Panel
  - Chat interface connected to configured providers.
- Paper Preview
  - Typst-rendered live preview panel for output formatting.

## Integration Terms

- OAuth Provider
  - External identity and token provider used for agent connection.
- Device Code Flow
  - OAuth flow used by GitHub Copilot path via verification code polling.
- Authorization Code Flow
  - OAuth flow used by providers requiring redirect callback and code exchange.
- Provider Runtime Config
  - Runtime env-derived config in `app/lib/oauth-provider-runtime.ts` and `app/lib/agent-provider-chat-runtime.ts`.

## Editor Terms

- Slash Command Palette
  - In-editor command picker opened by `/` or keyboard trigger.
- Typst-first Syntax Map
  - Canonical math command/snippet registry used by palette and natural intent parser.
- Natural Intent Parser
  - Query-to-math snippet resolver for natural language input.
- Workspace Actions
  - Structured assistant output (`write`, `append`, `replace`) returned by chat route.
- Workspace Format Command
  - Agent panel command `/format` to normalize active file syntax into Typst-first style.

## Desktop Terms

- Local-first Persistence
  - Desktop note and app-state storage handled locally through SQLite in Tauri.
