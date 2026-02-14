# auto-cron - smart scheduling for tasks, habits, and calendar planning

This repository powers an app for planning tasks and habits, auto-scheduling them into calendar blocks, and syncing with external providers like Google Calendar.

## Contributor docs

- `AGENTS.md` - primary agent guidelines (used by AI coding assistants)
- `CLAUDE.md` - symlink to `AGENTS.md` (used by Claude Code)

## Project documentation

| File | Purpose | When to update |
|------|---------|----------------|
| `README.md` | Project overview, links to docs | After structural changes |
| `docs/setup.md` | Local dev quickstart and deployment checklist | When setup steps change |
| `docs/architecture.md` | Features, monorepo structure, data flow, stack | When architecture changes |
| `docs/environment.md` | All environment variables (source of truth) | When env vars change |
| `docs/gotchas.md` | Hard-won debugging lessons for agents | When non-obvious problems are solved |
| `docs/issues.md` | Known bugs (low/medium/high/critical) | When discovering or resolving bugs |
| `docs/improvements.md` | Potential improvements backlog | When spotting out-of-scope improvements |
| `docs/todo.md` | Feature requirements, platform status, roadmap | When features are implemented or priorities change |
| `docs/testing.md` | Testing policy and practical command guidance | When test setup/policies change |
| `docs/git-workflow.md` | Branching, commit style, and Graphite workflow | When team workflow changes |
| `docs/conventions.md` | Project coding conventions and patterns | When coding standards evolve |
| `docs/external-references.md` | Canonical external docs for core dependencies | When stack/dependencies change |
| `docs/ui-styling.md` | UI design language and styling rules | When design language changes |
| `CLAUDE.md` | AI agent guidelines | When development rules change |

## Getting started

See [docs/setup.md](docs/setup.md) for local development quickstart and deployment checklist.

## Commands

- `bun install` - install dependencies
- `bun run dev` - run web dev and Convex dev together
- `bun run dev:web` - run web dev only
- `bun run dev:convex` - run Convex dev only
- `bun run build` - build all workspaces
- `bun run lint` - run Biome checks
- `bun run format` - run Biome with auto-fix
- `bun run typecheck` - run workspace type checks

## Scheduler snapshot

- Scheduler runs on 15-minute slots with a clamped horizon of 4-12 weeks (default 8).
- Task scheduling modes are `fastest`, `balanced`, and `packed` (global default + per-task override).
- Habits use canonical `recurrenceRule` (`RRULE:...`) plus `recoveryPolicy` (`skip` or `recover`).
- Scheduling runs are tracked in `schedulingRuns` with diagnostics (`feasibleOnTime`, late tasks, shortfalls, reason code, objective score).
- Hard infeasible runs do not partially apply changes; existing scheduler-generated calendar blocks remain unchanged.
- Google Calendar sync supports push notifications via `events.watch` (`/google/calendar/webhook`) with deduped background sync runs (`googleSyncRuns`) plus low-frequency cron fallback.
