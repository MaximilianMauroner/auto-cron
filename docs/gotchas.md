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
- Working-hours legacy fields (`workingHoursStart/End/workingDays`) were replaced by `hoursSets`. `user.created` now runs `internal.hours.mutations.internalBootstrapDefaultPlannerDataForUser`, which also seeds starter tasks/habits; for existing users, run `api.hours.actions.bootstrapDefaultPlannerDataForUser` (or `api.hours.actions.bootstrapHoursSetsForUser` for hours-only) to guarantee system sets (`Work`, `Anytime (24/7)`), exactly one default, and task/habit `hoursSetId` backfills before relying on hours-aware scheduling.
- Scheduling mode values are strict canonical enums (`fastest`, `balanced`, `packed`) across schema and APIs.
- Global scheduling step size is constrained to `15 | 30 | 60` minutes (`hours/shared.ts`) and must be preserved in every `userSettings` `replace(...)` path (not just `patch`) to avoid resetting user-selected snap behavior during Google token/sync updates.
- Scheduler hard infeasible runs (`reasonCode=INFEASIBLE_HARD`) intentionally do not mutate task/habit-generated calendar blocks. Preserve this no-partial-apply behavior when refactoring run/apply flows.
- Google sync upserts (`calendar/mutations:performUpsertSyncedEventsForUser`) must not treat non-`source:"google"` rows as merge candidates, even when `googleEventId` is present. Scheduler-managed task/habit blocks can carry `googleEventId` for outbound sync and would otherwise be rewritten as Google source rows.
- Convex tests can fail on queued scheduler jobs if scheduled functions are not mocked. We disable background dispatch in tests via `CONVEX_DISABLE_BACKGROUND_DISPATCH=true`, which makes enqueue mutations create run rows without calling `ctx.scheduler.runAfter`; keep this behavior when adjusting scheduling triggers.
- Google push sync channels require both `GOOGLE_CALENDAR_WEBHOOK_URL` and `GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET`; without both, watch-channel provisioning is skipped and only fallback cron queueing runs.
- `GOOGLE_CALENDAR_WEBHOOK_URL` must be a public HTTPS endpoint reachable by Google. Localhost/private URLs will pass local tests but never receive production `events.watch` notifications.
- Webhook-triggered Google sync enqueueing is intentionally debounced against any recently running/completed sync run (not just `triggeredBy: "webhook"`) to avoid feedback loops after local push writes. Keep `upsertGoogleTokens` and event upserts idempotent to prevent avoidable query invalidations and duplicate run fan-out.
- Google provider calls intentionally request partial response fields and set gzip headers in [convex/providers/calendar/google.ts](convex/providers/calendar/google.ts) to reduce Calendar API payloads. If sync mappings change, update field projections together with mapper expectations to avoid missing data.
- Scheduler push sync now isolates per-event Google write failures in [convex/calendar/actions.ts](convex/calendar/actions.ts) instead of aborting the full run, and provider errors include truncated Google response payloads from [convex/providers/calendar/google.ts](convex/providers/calendar/google.ts). This prevents one bad event payload/range from failing the entire scheduling sync and gives actionable 400 diagnostics.
- The right aside now uses a route-state provider (`apps/web/components/aside-panel/aside-content-context.tsx`). New task/habit detail/edit entry points should call `useAsideContent().openTask/openHabit` instead of opening local edit sheets to avoid split UX and stale navigation-back behavior.
- Paginated occurrence queries use start-time cursors (`calendar/queries:listTaskOccurrencesPage`, `calendar/queries:listHabitOccurrencesPage`). Keep cursor semantics strict (`>` for upcoming, `<` for past after first page) to avoid duplicate rows when loading more.

## Monorepo

- Root commands run through Turbo. If a workspace-specific script is missing at root, run it in the relevant package/app directly.

## Documentation process

- When a non-obvious issue is fixed, add a concise entry here with file references and the reason the issue was tricky.
