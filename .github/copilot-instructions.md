# Promptfoo Copilot Instructions

## Big Picture
- Monorepo: core library in `src/`, web UI in `src/app/` (React 19/Vite/MUI), backend in `src/server/` (Express + Socket.io), CLI in `src/commands/`, providers in `src/providers/`, redteam in `src/redteam/`, docs in `site/`, migrations in `drizzle/`.
- Backend serves API for UI; UI must call backend via `callApi()` to handle dev/prod base URLs.
- Providers implement `ApiProvider` and return normalized `ProviderResponse`; evaluator cleans up providers via `providerRegistry.shutdownAll()`.
- Redteam: plugins generate tests, strategies transform attacks, graders evaluate success.

## Workflows & Commands (root)
- Dev: `npm run dev` (app+server), `npm run dev:app` (5173), `npm run dev:server` (3000).
- Build/Test: `npm run build`, `npm test`, `npm run tsc`, `npx vitest path/to/test`.
- Lint/format: `npm run l` / `npm run f` for changed files.
- Local evals: `npm run local -- eval -c path/to/config.yaml --no-cache` (always use `--` before flags).

## Conventions & Patterns
- CLI: use `logger` (never `console`), record telemetry, set `process.exitCode = 1` on errors. See `src/commands/eval.ts`.
- Server responses: `{ success: true, data }` or `{ success: false, error }` with proper status codes; validate requests with Zod.
- Frontend: **never** use `fetch()`; always `callApi()` from `@app/utils/api`.
- Providers: if returning cached responses, set `cached: true`; config priority is options > env > defaults.
- Tests: Vitest everywhere; frontend tests use explicit imports, backend tests can use globals.

## Data & Migrations
- DB schema lives in `src/database/schema.ts`; `drizzle/` contains generated SQL only.
- Workflow: modify schema → `npm run db:generate` → review SQL → `npm run db:migrate`.
- Never delete `~/.promptfoo/promptfoo.db` or `~/.cache/promptfoo`.

## Redteam Standards
- Graders must use the standardized tags defined in `.claude/skills/redteam-plugin-development/skill.md`.
- Reference patterns: `src/redteam/plugins/pii.ts`, `src/redteam/plugins/harmful/graders.ts`.
