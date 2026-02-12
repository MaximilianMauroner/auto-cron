# Gotchas

Hard-won lessons from debugging sessions. Agents should check this file when stuck and add new entries when a fix was non-obvious.

## Convex

- `@useautumn/convex` operations may call external APIs under the hood. Keep those calls in runtime contexts supported by Convex for network access.
- WorkOS AuthKit webhook is wired via `@convex-dev/workos-authkit` component (`convex/auth.ts`, `convex/http.ts`). The `WORKOS_WEBHOOK_SECRET` env var must be set in Convex (not `.env.local`) via `npx convex env set`.
- Google calendar sync can fail with `Google refresh token not configured` if OAuth callback token persistence races or misses. Backfill `google_refresh_token` from HTTP-only cookie into `calendar/mutations:upsertGoogleTokens` during `/calendar` server render to self-heal existing sessions.
- Autumn web SDK can log `Fetch failed: /api/autumn/...` during SSR when `backendUrl` is relative. Use an absolute backend URL in `apps/web/app/AutumnProvider.tsx` and optionally set `NEXT_PUBLIC_AUTUMN_BACKEND_URL`.
- Env values are validated with `@t3-oss/env-nextjs` for web (`apps/web/env`) and `@t3-oss/env-core` for root checks (`scripts/validate-env.ts`), while Convex runtime env is read directly from `process.env` in `convex/env.ts`. Missing required vars fail fast during `bun run build` via `bun run env:check`.
- Convex auth failures now throw a structured `ConvexError` with `code: "UNAUTHORIZED"` from `requireAuth` in `convex/auth.ts`. Client-side error handling should key off `error.data.code` rather than string-matching message text.
- Use auth wrappers (`withQueryAuth`, `withMutationAuth`, `withActionAuth`) from `convex/auth.ts` when adding new public functions to avoid accidentally shipping a handler without auth enforcement.
- Task/habit create billing uses lock + reservation orchestration in `convex/billing.ts`; when touching create actions, preserve `requestId` idempotency and rollback semantics to avoid double-consume or orphan inserts.
- Convex billing tests rely on `AUTUMN_BILLING_MODE` (`allow_all`, `deny_tasks`, `deny_habits`, `track_fail`) to avoid external Autumn calls. Keep this behavior in sync with `convex/billing.ts` when adding new billable features.
- Working-hours legacy fields (`workingHoursStart/End/workingDays`) were replaced by `hoursSets`. Run `api.hours.actions.bootstrapHoursSetsForUser` to guarantee system sets (`Work`, `Anytime (24/7)`), exactly one default, and task/habit `hoursSetId` backfills before relying on hours-aware scheduling.
- Scheduling mode values are normalized for compatibility (`backfacing -> packed`, `parallel -> balanced`) via `hours.mutations.internalMigrateSchedulingModelForUser`; keep this mapping in sync if enums evolve.
- Scheduler hard infeasible runs (`reasonCode=INFEASIBLE_HARD`) intentionally do not mutate task/habit-generated calendar blocks. Preserve this no-partial-apply behavior when refactoring run/apply flows.
- Convex tests can fail on queued scheduler jobs if scheduled functions are not mocked. `convex/scheduling/enqueue.ts` skips `runAfter` in test runtime (`NODE_ENV=test` or `VITEST=true`); keep this guard when adjusting scheduling triggers.

## Monorepo

- Root commands run through Turbo. If a workspace-specific script is missing at root, run it in the relevant package/app directly.

## Documentation process

- When a non-obvious issue is fixed, add a concise entry here with file references and the reason the issue was tricky.
