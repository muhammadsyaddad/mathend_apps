# Conventions

Last updated: 2026-04-07
Owner: repo maintainers

## Change Strategy

- Keep diffs scoped to the requested behavior.
- Preserve existing behavior unless requested otherwise.
- Prefer minimal edits in existing files over broad refactors.

## Scope Defaults

- Default implementation scope: `apps/mathend`.
- Edit `apps/desktop` or `apps/web` only when explicitly requested.
- Shared changes belong in `packages/ui` only when reuse is clear.

## TypeScript and React

- Keep strict, explicit types for public runtime boundaries.
- Follow existing local patterns before introducing new abstractions.
- Avoid introducing global utilities unless used in multiple locations.

## API Route and Runtime Rules

- Keep request parsing and validation close to route entrypoint.
- Keep provider/runtime resolution in `app/lib/**`.
- Return explicit error messages and status codes for invalid inputs.

## Secrets and Security

- Never commit `.env` values or tokens.
- Use `.env.example` for onboarding-safe placeholders only.
- Keep OAuth token handling in server routes and httpOnly cookies.

## Tests and Verification

- For behavior changes, add or update tests in `test/`.
- Run smallest valid checks for touched scope (see `docs/runbook.md`).
- Use `bun run verify` for shared or cross-workspace changes.

## Documentation Rule

Update docs in the same PR when any of the following changes:

- Commands or script names
- Folder ownership or architecture boundaries
- Environment variables
- Testing strategy or quality gates
