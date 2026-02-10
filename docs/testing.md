# Testing Guide

Testing policy and practical guidance for `auto-cron`.

## Current status

A comprehensive automated test suite is not fully established yet. Until then, use strict type/lint gates and targeted manual verification.

## Required pre-merge checks

```bash
bun run typecheck
bun run lint
bun run format
```

## Recommended test strategy (target)

| Layer | Suggested tooling | Status |
|------|-------------------|--------|
| Web unit/component | Vitest + React Testing Library | Planned |
| Convex backend | `convex-test` + Vitest | Planned |
| End-to-end web | Playwright | Planned |

## Prioritization

Start tests in this order:

1. Scheduling logic (high regression risk)
2. Auth and permissions boundaries
3. Billing/feature-gating flows
4. Calendar sync edge cases

## Manual verification checklist

- Sign-in/sign-out flow works end-to-end.
- Task and habit operations update UI and backend consistently.
- Calendar events reflect scheduling results without overlap regressions.
- Billing-gated actions are correctly blocked/unblocked by plan.
