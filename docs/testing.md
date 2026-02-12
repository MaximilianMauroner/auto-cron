# Testing Guide

Testing policy and practical guidance for `auto-cron`.

## Current status

A comprehensive automated test suite is not fully established yet. Until then, use strict type/lint
gates, focused Convex tests, and targeted manual verification.

## Required pre-merge checks

```bash
bun run typecheck
bun run lint
bun run format
bun run test:convex:run
```

## Recommended test strategy (target)

| Layer | Suggested tooling | Status |
|------|-------------------|--------|
| Web unit/component | Vitest + React Testing Library | Planned |
| Convex backend | `convex-test` + Vitest | In progress |
| End-to-end web | Playwright | Planned |

## Prioritization

Start tests in this order:

1. Scheduling logic (high regression risk)
2. Auth and permissions boundaries
3. Billing/feature-gating flows
4. Calendar sync edge cases

## Convex auth tests

- Run watch mode:

```bash
bun run test:convex
```

- Run once (CI/pre-merge):

```bash
bun run test:convex:run
```

- Current coverage includes:
  - `requireAuth` unauthorized/authorized behavior
  - unauthenticated access rejection for public calendar query/mutation
  - user scoping verification for `listEvents`
  - regression check that removed public sync mutation is not callable
  - task/habit create authorization checks
  - billing limit rejections (`FEATURE_LIMIT_REACHED`) for tasks/habits
  - idempotent create behavior via `requestId` and committed reservations
  - compensation rollback when billing track fails
  - verification that task/habit update/delete/toggle are not billing-gated
  - verification that calendar scheduling endpoints remain ungated
  - hours-set bootstrap guarantees (`Work` + `Anytime (24/7)`)
  - default planner data bootstrap idempotency (starter tasks/habits)
  - hours window validation (overlap/range/granularity)
  - default fallback reassignment when deleting non-default hours sets
  - task scheduling mode default + per-task override behavior (`fastest|balanced|packed`)
  - scheduler solver invariants in `convex/scheduling/solver.test.ts`:
    - task coverage and chunk placement
    - account downtime buffer between adjacent scheduled blocks
    - pass-A on-time infeasibility with pass-B late schedule
    - hard infeasible no-apply behavior
    - recover-vs-skip ordering under contention
    - RRULE parsing support
    - cross-midnight slot/window handling
  - Google push sync coverage in:
    - `convex/providers/calendar/google.test.ts` (`events.watch`, `channels.stop`)
    - `convex/calendar_watch.test.ts` (webhook validation, queue dedupe, sync-handshake behavior)

## Scheduler regression checklist

Run this checklist when touching `convex/scheduling/*`, trigger wiring, or diagnostics UI:

1. `scheduling.actions.runNow` creates exactly one run row and transitions `pending -> running -> completed|failed`.
2. `scheduling.queries.getLatestRun` returns diagnostics used by Calendar panel.
3. Hard infeasible runs keep existing scheduler-generated events unchanged.
4. Legacy mode values (`backfacing`, `parallel`) normalize to canonical enums.
5. Habit records missing `recurrenceRule`/`recoveryPolicy` are backfilled idempotently.
6. Trigger debounce prevents duplicate pending/running runs inside the debounce window.
7. Completed scheduler runs with Google connected trigger post-run block sync (create/update/delete) only after solve/apply.
8. Post-run sync preserves `calendarEvents.sourceId` for task/habit blocks while updating `googleEventId`.

## Manual verification checklist

- Sign-in/sign-out flow works end-to-end.
- Task and habit operations update UI and backend consistently.
- Calendar events reflect scheduling results without overlap regressions.
- Calendar diagnostics panel reflects latest run status, late-task count, and shortfall count.
- Hard infeasibility banner appears when `latestRun.feasibleOnTime === false`.
- Billing-gated actions are correctly blocked/unblocked by plan.
- Task and habit create flows open paywall when limit is reached.
- Google webhook endpoint (`/google/calendar/webhook`) returns `204` for valid + invalid notifications and
  only enqueues sync runs for validated channels.
- Expiring watch channels are renewed by cron and stale channels are deactivated.

## Manual auth + middleware checklist

- Unauthenticated navigation to protected routes (`/calendar`, `/tasks`, `/habits`, `/settings`) redirects to `/sign-in`.
- Authenticated navigation to protected routes does not loop or bounce.
- `/callback` auth flow completes and returns to `/calendar`.
- Sign-out invalidates access to protected routes until re-authenticated.
- Sidebar calendar panel does not flicker to an empty state while auth is still initializing.
