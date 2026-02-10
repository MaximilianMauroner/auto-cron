# Architecture

## Features

- Task and habit planning with explicit priorities and durations
- Auto-scheduling into available calendar slots
- Scheduling run tracking for observability and debugging
- Calendar event model with multi-source support (`manual`, `google`, `task`, `habit`)
- Billing integration via Autumn and plan-based feature control (in progress)
- WorkOS-based authentication and user identity flow (in progress)

## Monorepo Structure

```text
auto-cron/
|- apps/
|  |- web/                     # Next.js 15 web app
|  |- mobile/                  # Planned Expo app
|  \- desktop/                 # Planned desktop app
|- convex/                     # Convex backend (schema, auth config, http router)
|- packages/
|  |- types/                   # Shared domain types
|  \- config/                  # Shared config packages
\- docs/                       # Project docs
```

## Stack

| Layer | Technology |
|------|------------|
| Web Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Convex |
| Auth | WorkOS AuthKit (scaffolded) |
| Billing | Autumn |
| Build & Monorepo | Turbo + Bun workspaces |
| Code Quality | Biome + TypeScript |

## Core Data Model

Defined in `convex/schema.ts`:

- `userSettings`
- `tasks`
- `habits`
- `calendarEvents`
- `schedulingRuns`

## Data Flow (target state)

1. User signs in via WorkOS.
2. User creates/updates tasks and habits.
3. Scheduling pipeline computes available slots from:
   - user working hours/settings
   - existing calendar events
   - deadlines and priority heuristics
4. Scheduler writes derived `calendarEvents` and logs run metadata in `schedulingRuns`.
5. Google Calendar sync keeps external calendar state aligned (planned).

## Architecture principle

Provider-specific logic should stay isolated behind adapter boundaries.

- Auth provider concerns belong in auth integration layers (`convex/auth.config.ts`, web auth wrappers).
- Billing provider concerns belong in Autumn-specific modules (`convex/autumn.ts`, `autumn.config.ts`, web API adapter).
- Business logic should not depend directly on provider SDK details.
