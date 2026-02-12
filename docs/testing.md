# Testing Guide

Testing policy and practical guidance for `auto-cron`.

## Current status

A comprehensive automated test suite is not fully established yet. Until then, use strict type/lint gates, focused Convex tests, and targeted manual verification.

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

## Manual verification checklist

- Sign-in/sign-out flow works end-to-end.
- Task and habit operations update UI and backend consistently.
- Calendar events reflect scheduling results without overlap regressions.
- Billing-gated actions are correctly blocked/unblocked by plan.

## Manual auth + middleware checklist

- Unauthenticated navigation to protected routes (`/calendar`, `/tasks`, `/habits`, `/pricing`, `/settings`) redirects to `/sign-in`.
- Authenticated navigation to protected routes does not loop or bounce.
- `/callback` auth flow completes and returns to `/calendar`.
- Sign-out invalidates access to protected routes until re-authenticated.
- Sidebar calendar panel does not flicker to an empty state while auth is still initializing.
