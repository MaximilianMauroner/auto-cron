# Architecture

## Features

- Task and habit planning with explicit priorities and durations
- Reusable per-user hours sets (`Work`, `Anytime (24/7)`, and custom sets)
- Task scheduling mode intent (`fastest`, `balanced`, `packed`) with global default + per-task override
- Habit recurrence canonical source (`recurrenceRule` / RRULE) with `recoveryPolicy` (`skip` or `recover`)
- Tasks and habits dashboard UIs with create/edit/delete/toggle flows
- Constraint-based auto-scheduling into available calendar slots (15-minute discretization)
- Scheduling run tracking for observability and debugging
- Calendar event model with multi-source support (`manual`, `google`, `task`, `habit`)
- Billing integration via Autumn with create-only metering for `tasks` and `habits`
- Scheduling remains unlimited across all plans (no scheduling metering)
- WorkOS-based authentication and user identity flow

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
- `hoursSets`
- `calendarEvents`
- `googleCalendarWatchChannels`
- `googleSyncRuns`
- `schedulingRuns`
- `billingReservations`
- `billingLocks`

## Data Flow (target state)

1. User signs in via WorkOS.
2. User creates/updates tasks and habits.
3. Scheduling pipeline computes available slots from:
   - selected hours sets for tasks/habits
   - existing calendar events
   - deadlines, priorities, mode shaping (`fastest|balanced|packed`), and account downtime buffer
4. Scheduler executes a two-pass solve:
   - pass A checks on-time feasibility (`completion <= due`) for all schedulable tasks
   - pass B optimizes with soft lateness + habit/drop/preference/stability objectives
5. Scheduler writes derived `calendarEvents` and logs diagnostics in `schedulingRuns`.
6. Google Calendar sync keeps external calendar state aligned.
7. Google push notifications (`events.watch`) hit Convex HTTP webhook; webhook enqueues deduped
   `googleSyncRuns` and the sync runner performs incremental token-based imports.

## Constraint scheduler pipeline

The Convex scheduling module lives in `convex/scheduling/*` and runs as an internal action.

1. Normalize horizon and slots (`SLOT_MINUTES=15`, horizon clamp `4..12` weeks).
2. Build allowed-slot masks from selected hours set windows (cross-midnight windows split by day).
3. Block fixed busy intervals from `calendarEvents` (`busyStatus !== "free"` and non-cancelled).
4. Enforce account-level downtime buffer (`userSettings.schedulingDowntimeMinutes`) between
   scheduled blocks.
5. Expand habit recurrences from RRULE and build occurrence candidates.
6. Build task chunk plans from required duration and chunk bounds.
7. Run pass A (strict due-date feasibility) and pass B (full objective).
8. On hard infeasible (`INFEASIBLE_HARD`), mark run failed and keep existing scheduler-generated blocks unchanged.
9. On success, reconcile scheduler-generated task/habit blocks in horizon (patch existing first to preserve remote IDs, then insert/delete deltas) and patch task `scheduledStart/scheduledEnd`.
10. After local apply completes, run a post-run Google sync pass for scheduler blocks:
   - pull current Google events in horizon for comparison
   - delete stale scheduler-owned Google events
   - create/update only changed blocks to reduce write calls

## Google push sync pipeline

1. OAuth connect stores refresh token and enqueues initial Google sync run.
2. Backend creates Google watch channels per writable calendar and stores channel metadata in
   `googleCalendarWatchChannels`.
3. Google calls `POST /google/calendar/webhook` when calendar resources change.
4. Webhook validates channel id/resource id/secret-derived token hash and records channel heartbeat.
5. Valid notifications enqueue deduped `googleSyncRuns` (`pending` queue per user).
6. Internal sync worker consumes queue, runs incremental sync via `syncToken`, and persists updates
   through `upsertSyncedEventsForUser`.
7. Calendar update mutations continue to enqueue scheduling runs so planner state stays aligned.
8. Low-frequency cron fallback enqueues sync runs, and renewal cron refreshes expiring watch channels.

## Scheduling run diagnostics

`schedulingRuns` stores run lifecycle and diagnostics:

- lifecycle: `status`, `triggeredBy`, `startedAt`, `completedAt`, `error`
- horizon and objective: `horizonStart`, `horizonEnd`, `objectiveScore`, `feasibleOnTime`
- task diagnostics: `lateTasks[]`
- habit diagnostics: `habitShortfalls[]`, `dropSummary[]`
- machine-readable reason: `reasonCode`

Lookup indexes are optimized for per-user status/timeline queries:

- `by_userId_status_startedAt`
- `by_userId_startedAt`

## Scheduling data normalization

Scheduling migrations are idempotent and focus on canonical values:

- task mode is canonical (`fastest | balanced | packed`)
- habits: derive `recurrenceRule` from legacy frequency fields when missing
- habits: default `recoveryPolicy` to `skip` when missing
- habits: default missing priority to `medium`

## Billing Architecture (Tasks/Habits)

- Only `createTask` and `createHabit` are billable.
- The create actions orchestrate a reservation workflow in `convex/billing.ts`:
  1. Acquire per-user/per-feature lock (`billingLocks`).
  2. Run Autumn `check(featureId)` for availability.
  3. Insert entity via internal mutation + persist reservation (`billingReservations`).
  4. Track usage once with idempotency key.
  5. Commit reservation; if track fails, compensate by deleting inserted entity and mark rollback state.
- Update/delete/reorder/toggle paths are intentionally ungated (auth + ownership checks only).

## Architecture principle

Provider-specific logic should stay isolated behind adapter boundaries.

- Auth provider concerns belong in auth integration layers (`convex/auth.config.ts`, web auth wrappers).
- Billing provider concerns belong in Autumn-specific modules (`convex/autumn.ts`, `autumn.config.ts`, web API adapter).
- Business logic should not depend directly on provider SDK details.
