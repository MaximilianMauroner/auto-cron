# AGENTS.md

Project-specific agent instructions for `/Users/maximilianmauroner/Documents/GitHub/auto-cron`.

## Auto Cron

Smart scheduling monorepo for tasks, habits, and calendar planning.

## Quick reference

- Package manager: `bun` (workspace root uses `bun@1.2.4`)
- Monorepo: `apps/web` (Next.js 15), `apps/mobile` (placeholder), `convex/` (backend)
- Shared packages: `packages/types`, `packages/config`
- Build system: `turbo`
- Lint/format: `biome`

## Skills

Use skills when they clearly match the task. Prefer the minimum set needed.

### Most relevant skills for this repo

- `convex`: Convex patterns and function architecture
- `convex-best-practices`: production Convex query/mutation/action guidance
- `frontend-design`: UI/component work, pages, and styling
- `building-native-ui` and `vercel-react-native-skills`: mobile/Expo tasks
- `vercel-react-best-practices`: React/Next.js component and performance work
- `web-design-guidelines`: UI/UX and accessibility review requests
- `security-best-practices`: only when explicitly asked for security review/guidance
- `yeet`: only when explicitly asked to stage+commit+push+open PR with GitHub CLI

### Skill usage rules

- If user names a skill or task clearly matches a skill, use it.
- Open the skill `SKILL.md` and read only what is needed.
- Reuse scripts/templates shipped with a skill when available.
- If a skill is missing or blocked, state it briefly and continue with best fallback.

## Core architecture constraints

- Keep domain logic in Convex and shared types, not in page-level UI.
- Keep provider-specific integrations isolated:
  - Billing/provider code should stay in dedicated integration files (currently `convex/autumn.ts`, `autumn.config.ts`, and API route adapters).
  - Future external providers (auth, calendar sync, scheduling integrations) should be swappable via adapter-style boundaries instead of being hardcoded across mutations/queries.
- Prefer schema-first changes:
  - Update `convex/schema.ts`
  - Reflect affected shared types in `packages/types`
  - Then update queries/mutations/UI.

## Versioning policy

- Until the project version is greater than `1.0.0`, breaking changes are acceptable by default.
- Agents should not block plans on backward compatibility during this phase unless explicitly requested.
- Once version exceeds `1.0.0`, default to backward-compatible changes and explicit migration planning.


## Roadmap-aware priorities (from `docs/todo.md`)

Completed foundations:
- Monorepo setup, Convex base, shared packages, Biome, Tailwind v4
- Autumn plans/features configured

Still pending and should shape implementation choices:
- WorkOS auth setup and Convex auth wrapper completion
- Feature gating enforcement with Autumn `check()` in Convex functions
- Task/habit CRUD and scheduling engine implementation
- Calendar UI interactions and Google Calendar sync
- Tests and workflow hardening for production readiness

## Commands

Primary commands available now:

```bash
bun install
bun run dev
bun run build
bun run lint
bun run format
bun run typecheck
```

Notes:

- `build` is a turbo root task.
- `dev` starts both web dev and Convex dev from the root script.
- Convex test scripts are available at root: `bun run test:convex` and `bun run test:convex:run`.

## Task completion gates

For code changes, run and pass:

```bash
bun run typecheck
bun run lint
bun run format
```

Additional gate:

- Run tests when test suites/scripts are added for the touched area.

## Coding conventions

- TypeScript-first across apps/packages.
- Use Biome defaults (tab indentation, 100 char line width, organized imports).
- Keep styling consistent with `docs/ui-styling.md` (Swiss modern system).
- Prefer small, composable changes over large rewrites.

## Git and PR process

- Preferred flow: Graphite (`gt`) for stacked work when applicable.
- Branch naming: `codex/<topic>`.
- Do not add co-authors automatically.
- If committing, include structured message sections:
  - Summary
  - Why
  - What needs to be tested
  - Future improvements
  - Confidence: X/5

## Documentation policy

Keep these docs updated whenever related behavior changes:

- `README.md`
- `docs/setup.md`
- `docs/architecture.md`
- `docs/environment.md`
- `docs/gotchas.md`
- `docs/issues.md`
- `docs/improvements.md`
- `docs/todo.md`
- `docs/testing.md`
- `docs/git-workflow.md`
- `docs/conventions.md`
- `docs/external-references.md`
- `docs/ui-styling.md`

## Known gotchas

- See `docs/gotchas.md`.
- If a non-obvious issue is discovered/fixed, add a short entry there.


# Coding Guidelines

- Use TypeScript across all apps and packages.
- Follow Biome formatting and linting rules.
- Keep UI styling consistent with the Swiss modern system outlined in `docs/ui-styling.md`
- Try to create reusable components and utilities when possible, especially in the shared `packages/` directory.
- For Convex functions, keep the nesting to a minimum and prefer flat structures for readability.
- Soft limit files to about 1000 lines for maintainability. If a file grows too large, consider splitting it into smaller modules.(and while you are search for opportunities to create reusable components and utilities)
- When working on the frontend, prioritize accessibility and responsive design.
- For API routes and backend code, ensure proper error handling and input validation.