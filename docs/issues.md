# Issues

Known bugs and defects discovered during development and review. Resolve in priority order.

## Format

```markdown
### <short title>

- **Spotted during**: <task/commit/review context>
- **File**: <file:line>
- **Description**: <what is broken and impact>
- **Action**: <how to fix>
- **Priority**: low | medium | high | critical
```

## Critical

### Google refresh token stored in client-side cookies

- **Spotted during**: Security audit (Feb 2026)
- **File**: apps/web/app/callback/route.ts:65-71
- **Description**: Google refresh tokens are stored in HTTP-only cookies with `sameSite: "lax"`. Refresh tokens are long-lived secrets that grant ongoing access to user calendars. Cookies are sent with every request, enlarging the attack surface for cookie theft, CSRF, and exposure in logs/proxies.
- **Action**: Store refresh tokens only in the Convex backend (already done via `upsertGoogleTokens` mutation). Remove cookie-based storage and use an opaque server-side session identifier instead.
- **Priority**: critical

### Google access token stored in cookies

- **Spotted during**: Security audit (Feb 2026)
- **File**: apps/web/app/callback/route.ts:58-64
- **Description**: The OAuth access token is persisted in a cookie. Even though it is HTTP-only, it is sent with every request and may be logged by middleware or proxies. If `sameSite: "lax"` is insufficient, the token could be exposed via CSRF.
- **Action**: Keep OAuth tokens server-side only in encrypted Convex storage; use opaque session tokens in cookies instead.
- **Priority**: critical

### No error boundaries anywhere in the app

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/layout.tsx, apps/web/app/app/layout.tsx
- **Description**: No `error.tsx` or React `ErrorBoundary` components exist for any route. If any component throws during render, the entire application crashes with no fallback UI, giving users a blank screen.
- **Action**: Add `error.tsx` files at `app/`, `app/app/`, and key route segments (calendar, tasks, habits, settings). Each should render a user-friendly error message with a retry button.
- **Priority**: critical

### calendar-client.tsx is 3,857 lines

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/app/calendar/calendar-client.tsx
- **Description**: Single component file far exceeds the 1,000-line soft limit. It contains state management, drag-drop handling, recurrence editing, event dialogs, and calendar rendering all in one file. This is unmaintainable, hard to review, and impossible to lazy-load sub-features.
- **Action**: Split into separate modules: CalendarView, EventEditor, RecurrenceEditor, DragDropHandler, and modal dialogs. Move each to its own file under `components/calendar/`.
- **Priority**: critical

### ~~`updateActiveProduct` allows plan-bypass~~ (FIXED)

- **Spotted during**: PR review (Feb 2026)
- **File**: convex/hours/mutations.ts:752
- **Description**: Public mutation let any authenticated client set `activeProductId` to any valid tier without verifying the user's Autumn subscription. Since scheduling horizon limits are enforced using `activeProductId`, this was a plan-bypass vector.
- **Action**: ~~Convert to internalMutation and create a verified action that checks Autumn subscription before updating.~~
- **Resolution**: Converted to `internalUpdateActiveProduct` (internal mutation). Created `syncActiveProduct` action in `hours/actions.ts` that verifies the product against Autumn's customer API before calling the internal mutation. Frontend updated to use the action.
- **Priority**: critical

### ~~Full table scan in `clearPinnedTaskCalendarEvents`~~ (FIXED)

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/tasks/mutations.ts:144-174
- **Description**: Queries ALL calendar events for a user via `by_userId` index, then filters in JS for `source === "task"` and `pinned === true`. For users with thousands of events this is a memory and performance hazard that runs on every task status change to backlog. Also had a travel sourceId format mismatch: unpin logic matched `${taskId}:travel:` but solver produces `task:${taskId}:travel:`.
- **Action**: ~~Use the existing `by_userId_source_sourceId` index (filter by source "task") and fix travel sourceId prefix matching.~~
- **Resolution**: Now uses `by_userId_source_sourceId` index filtered by `source="task"`. Travel sourceId matching updated to handle both legacy and current formats.
- **Priority**: critical

### Full table scan in `findProtectedFingerprintMatches`

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/calendar/mutations.ts:233-260
- **Description**: Queries events by `by_userId_start` then filters extensively in application code for source, end, title, allDay, and calendar matching. Loads ALL events at a given timestamp before filtering.
- **Action**: Add a more selective index (e.g., `by_userId_start_source`) or narrow the query to reduce in-memory filtering.
- **Priority**: critical

## High

### Webhook token validation not done at HTTP layer

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/http.ts:9-24
- **Description**: The Google Calendar webhook endpoint accepts POST requests and passes raw headers directly to an internal action. Webhook token and signature validation only happens downstream in `convex/calendar/actions.ts`. An attacker who knows the endpoint format can send crafted webhook requests that will be processed before validation.
- **Action**: Validate `x-goog-channel-token` and `x-goog-resource-id` headers at the HTTP router level before scheduling the internal action.
- **Priority**: high

### Resource ID comparison uses standard equality (timing leak)

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/calendar/actions.ts:654
- **Description**: While `secureEqualString()` is used for channel token comparison, `args.resourceId !== channel.resourceId` uses standard `!==` operator, which could leak resource ID information through timing analysis.
- **Action**: Use `secureEqualString()` for the resource ID comparison as well.
- **Priority**: high

### N+1 query in `reorderTasks` mutation

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/tasks/mutations.ts:258-263
- **Description**: Sequential ownership verification in a loop calls `ctx.db.get()` for each item, then `clearPinnedTaskCalendarEvents` in another loop. For 100 tasks this is 100+ sequential database calls.
- **Action**: Batch-fetch all tasks using `Promise.all(items.map(i => ctx.db.get(i.id)))`, then validate ownership in application code.
- **Priority**: high

### Unbounded queries without pagination in bootstrap

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/hours/mutations.ts:1359-1431
- **Description**: `bootstrapHoursSetsForUser` collects all tasks and all habits for a user without pagination or limits. A user with thousands of entries could load excessive data in a single mutation.
- **Action**: Implement pagination with cursors or add `.take(limit)` guards. Even if not needed now, add safeguards for future growth.
- **Priority**: high

### Missing rate limiting on calendar sync operations

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/calendar/actions.ts:240-512
- **Description**: `ensureWatchChannelsForUser` and `ensureWatchChannelsForAllUsers` make multiple Google API calls without rate limiting or backoff logic. A user repeatedly triggering sync could exhaust Google API quotas or cause downstream failures.
- **Action**: Implement per-user rate limiting on calendar sync (e.g., max 1 full sync per 5 minutes per user). Add exponential backoff for Google API errors.
- **Priority**: high

### Habits page is 2,302 lines

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/app/habits/page.tsx
- **Description**: Significantly exceeds the 1,000-line soft limit. Contains nested component definitions and complex state management inline.
- **Action**: Extract internal components (HabitCard, HabitDialog, HabitForm) to separate files under `components/habits/`.
- **Priority**: high

### Tasks page is 1,597 lines

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/app/tasks/page.tsx
- **Description**: Exceeds 1,000-line soft limit. Contains TaskDialog, MetricTile, and TaskCard as nested function definitions.
- **Action**: Extract TaskCard, MetricTile, and TaskDialog to separate component files under `components/tasks/`.
- **Priority**: high

### No Suspense boundaries in the app

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/app/calendar/page.tsx:7-15
- **Description**: No `<Suspense>` boundaries exist anywhere in the app. Dynamic imports use basic loading text without skeleton layouts matching the actual UI. No structured fallback for loading states.
- **Action**: Add Suspense boundaries at route segments with skeleton components that mirror the real layout.
- **Priority**: high

### Missing accessibility on sidebar calendar list

- **Spotted during**: Frontend/a11y audit (Feb 2026)
- **File**: apps/web/components/app-sidebar.tsx:243-284
- **Description**: Calendar list items lack `aria-label` attributes. Toggle buttons have minimal accessibility context. Hidden calendar state is communicated only via opacity change, which is invisible to screen readers.
- **Action**: Add `aria-label` with visibility state (e.g., "Toggle My Calendar visibility, currently visible"). Add `aria-pressed` to toggle buttons. Use `aria-live` region for state change announcements.
- **Priority**: high

### Global cron `clampSchedulingHorizonsToPlans` scans all users

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/hours/mutations.ts:1726-1754
- **Description**: Cron job scans ALL users' settings using pagination. On a system with many users this could timeout or consume excessive resources.
- **Action**: Add a filter to only scan users who have exceeded limits, or implement incremental processing with a "needs clamping" flag.
- **Priority**: high

### Database bandwidth spike in `upsertSyncedEventsForUser`

- **Spotted during**: Convex Usage dashboard review (Feb 2026)
- **File**: convex/calendar/mutations.ts (`upsertSyncedEventsForUser`, `performUpsertSyncedEventsForUser`)
- **Description**: `calendar/mutations.upsertSyncedEventsForUser` is the top database bandwidth consumer. Current matching/upsert flow performs broad candidate reads and multiple patch/delete operations per sync batch.
- **Action**: Narrow candidate selection with more selective indexes and reduce per-event write amplification (skip unchanged writes, batch conflict-safe updates).
- **Priority**: high

### Action compute spike in `syncFromGoogleForUser`

- **Spotted during**: Convex Usage dashboard review (Feb 2026)
- **File**: convex/calendar/actions.ts (`syncFromGoogleForUser`)
- **Description**: `calendar/actions.syncFromGoogleForUser` is the highest action-compute path. It chains provider fetch, sync token handling, upsert batches, and normalize/dedupe work in one flow.
- **Action**: Add early no-op exits, chunk expensive phases, and gate full-range follow-up operations when no meaningful delta exists.
- **Priority**: high

### Action compute spike in `syncScheduledBlocksToGoogle`

- **Spotted during**: Convex Usage dashboard review (Feb 2026)
- **File**: convex/calendar/actions.ts (`syncScheduledBlocksToGoogle`)
- **Description**: `calendar/actions.syncScheduledBlocksToGoogle` is a top compute consumer because it performs per-calendar pull/diff/push cycles and local metadata updates.
- **Action**: Reduce fan-out by narrowing sync scope to changed calendars/events and add batching/backoff controls for provider calls.
- **Priority**: high

### Scheduling orchestration amplification in `runForUser`

- **Spotted during**: Convex Usage dashboard review (Feb 2026)
- **File**: convex/scheduling/actions.ts (`runForUser`)
- **Description**: `scheduling/actions.runForUser` has high compute and triggers multiple high-cost downstream functions in sequence, amplifying total usage per run.
- **Action**: Prune no-op phases, short-circuit superseded runs earlier, and avoid invoking downstream sync when scheduling output is unchanged.
- **Priority**: high

## Medium

### Scheduling commit still scans all tasks

- **Spotted during**: Convex optimization pass (Feb 2026)
- **File**: convex/scheduling/mutations.ts (`applySchedulingBlocks`)
- **Description**: The mutation still loads all user tasks via `by_userId` and iterates every row to clear/update `scheduledStart` and `scheduledEnd`, which inflates memory/runtime for large task sets.
- **Action**: Limit updates to impacted task IDs from changed scheduling blocks plus currently scheduled tasks (via `by_userId_status`) and patch only when values actually change.
- **Priority**: medium

### Feedback mutation allows unauthenticated submissions

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/feedback/mutations.ts:21
- **Description**: `createFeedback` checks `ctx.auth.getUserIdentity()` but doesn't require it. `userId` is stored as `identity?.subject` which can be `undefined`, allowing unauthenticated feedback and potential spam.
- **Action**: Use `withMutationAuth` wrapper to enforce authentication, or add explicit rate limiting for anonymous submissions.
- **Priority**: medium

### upsertGoogleTokens doesn't validate token ownership

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/calendar/mutations.ts:1163-1247
- **Description**: The mutation accepts any `refreshToken` and `syncToken` without validating that the refresh token belongs to the authenticated user. A malicious user could potentially store another user's refresh token if they obtained it.
- **Action**: Validate the refresh token's subject matches the authenticated user via Google token introspection, or trust that the WorkOS auth flow ensures this.
- **Priority**: medium

### Env var names leaked in error messages

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/env.ts:12-17
- **Description**: `readRequired()` throws errors containing full env var names (`Missing required Convex env var: AUTUMN_SECRET_KEY`). If error logs are exposed, attackers learn which secrets the system expects.
- **Action**: Use generic error messages without exposing specific env var names (e.g., "Missing required server configuration").
- **Priority**: medium

### Validator definitions duplicated across files

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/tasks/mutations.ts, convex/tasks/queries.ts, convex/habits/mutations.ts, convex/scheduling/mutations.ts, and others
- **Description**: Validators like `taskPriorityValidator`, `habitRecoveryPolicyValidator`, and `taskStatusValidator` are copy-pasted across many files. This creates maintenance burden and risk of divergence.
- **Action**: Centralize all shared validators in a single `convex/validators.ts` file and import from there.
- **Priority**: medium

### Unsafe type assertions on reservation entity IDs

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/tasks/mutations.ts:299, convex/habits/mutations.ts:249
- **Description**: `reservation.entityId as Id<"tasks">` uses unsafe type assertion. If `entityId` format is wrong or points to the wrong table, this could cause silent data corruption.
- **Action**: Validate entityId format before casting, or use a type guard.
- **Priority**: medium

### Missing max-length validation on task/habit titles

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/tasks/mutations.ts (createTask handler), convex/habits/mutations.ts (createHabit handler)
- **Description**: Category names are validated to max 100 chars, but task and habit titles have no length limits. Extremely long titles could bloat documents and break UI layouts.
- **Action**: Add max length validators (e.g., 500 chars) to all text input fields (title, description, location).
- **Priority**: medium

### No input length validation on webhook parameters

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/calendar/actions.ts:639-660
- **Description**: `channelToken` and `resourceId` have no length or format validation. An attacker could send very large headers to consume memory.
- **Action**: Add length and format validation on webhook parameters before processing.
- **Priority**: medium

### Inefficient deduplication in calendar queries

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/calendar/queries.ts:82-92
- **Description**: `dedupeByLatestRecency` builds dedup keys and computes `recencyScore()` for every event in memory. With thousands of events this uses significant memory and CPU. `recencyScore()` is called twice per comparison.
- **Action**: Cache `recencyScore()` during the initial loop. Consider pre-filtering at the query level.
- **Priority**: medium

### `window.dispatchEvent` for cross-component calendar state

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/components/app-sidebar.tsx:148-160
- **Description**: Uses `window.dispatchEvent` with `CustomEvent` for calendar visibility toggling instead of React context or state management. This makes data flow implicit, hard to debug, and non-reactive.
- **Action**: Replace with a shared context provider or Zustand store for calendar visibility state.
- **Priority**: medium

### Multiple useState calls for related form state

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/app/tasks/page.tsx:258-270
- **Description**: Six separate `useState` calls for `isCreateOpen`, `isEditOpen`, `editForm`, `createForm`, `paywallOpen`, `errorMessage` manage a single form workflow. This is fragile and can lead to inconsistent state.
- **Action**: Consolidate into a `useReducer` or state machine pattern.
- **Priority**: medium

### Missing useCallback on event handlers passed as props

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/app/tasks/page.tsx:316-589
- **Description**: Functions like `toggleLaneCollapsed`, `moveTask`, `reorderWithinStatus`, `openEdit`, `openCreate` are redefined on every render and passed as props to TaskCard components, causing unnecessary re-renders.
- **Action**: Wrap these functions with `useCallback`.
- **Priority**: medium

### Unstable empty object reference in useQuery conditional

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/components/app-sidebar.tsx:108-111
- **Description**: `useAuthenticatedQueryWithStatus` receives `isCalendarRoute ? {} : "skip"` - the empty object `{}` is recreated every render, potentially causing unnecessary query re-subscriptions.
- **Action**: Memoize the args object with `useMemo` or extract to a stable constant.
- **Priority**: medium

### Billing check response parsing is overly permissive

- **Spotted during**: Convex audit + Security audit (Feb 2026)
- **File**: convex/billing.ts:69-118
- **Description**: `parseCheckOutcome()` accepts `allowed` from multiple possible field names (`allowed`, `isAllowed`, `is_allowed`) and has deep fallback logic. This suggests the Autumn API response format is unstable and could silently grant or deny access incorrectly.
- **Action**: Enforce strict schema validation on billing provider responses using Zod or a Convex validator.
- **Priority**: medium

### Repeated range scans in normalization and dedupe

- **Spotted during**: Convex Usage dashboard review (Feb 2026)
- **File**: convex/calendar/internal.ts (`normalizeGoogleEventsInRange`, `dedupeUserCalendarEventsInRange`)
- **Description**: Both functions consume high database bandwidth due to large range reads followed by in-memory filtering and per-row patch/delete loops.
- **Action**: Bound range windows, paginate large reads, and skip per-row writes when normalized values are unchanged.
- **Priority**: medium

### Scheduling input query reads broad user datasets

- **Spotted during**: Convex Usage dashboard review (Feb 2026)
- **File**: convex/scheduling/queries.ts (`getSchedulingInputForUser`)
- **Description**: The query is a top bandwidth consumer and can pull large horizon/event/task/habit datasets even when only a subset is needed for a run.
- **Action**: Tighten data selection to horizon-relevant records and add guards for incremental scheduling runs.
- **Priority**: medium

### High call amplification in run-state checks

- **Spotted during**: Convex Usage dashboard review (Feb 2026)
- **File**: convex/scheduling/queries.ts (`isRunSuperseded`), convex/scheduling/mutations.ts (`markRunRunning`)
- **Description**: These functions appear in top call counts. While individually small, frequent invocation contributes meaningful overhead and indicates orchestration churn.
- **Action**: Consolidate run-state transitions and reduce duplicate supersession checks in the scheduling pipeline.
- **Priority**: medium

## Low

### No OAuth token cleanup on disconnect

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/calendar/mutations.ts
- **Description**: No visible mutation to delete `googleRefreshToken` when a user disconnects Google. Expired/revoked tokens remain stored indefinitely in the database.
- **Action**: Add explicit token deletion endpoint for when users disconnect integrations.
- **Priority**: low

### Timestamp-based event recency can be gamed

- **Spotted during**: Security audit (Feb 2026)
- **File**: convex/calendar/internal.ts:160-161
- **Description**: Event recency is derived from user-controlled timestamps (`lastSyncedAt`, `updatedAt`). A crafted event with a future timestamp could win in dedup conflict resolution.
- **Action**: Use database-assigned `_creationTime` as primary recency signal, or include validation for timestamp integrity.
- **Priority**: low

### `useIsMobile` returns false before hydration

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/hooks/use-mobile.ts:5-19
- **Description**: Initially returns `undefined`, then `!!undefined = false` until the useEffect runs. Mobile users briefly see the desktop layout before the hook corrects.
- **Action**: Use SSR-compatible media query detection or provide a server-side fallback based on user-agent.
- **Priority**: low

### Mounted state pattern causes visual shift

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/components/app-sidebar.tsx:102-106, 376-383
- **Description**: Theme toggle button is conditionally rendered only after `mounted` state is true, causing a layout shift on initial render.
- **Action**: Use `suppressHydrationWarning` or render a placeholder of the same dimensions.
- **Priority**: low

### Theme toggle not announced to screen readers

- **Spotted during**: Frontend/a11y audit (Feb 2026)
- **File**: apps/web/components/app-sidebar.tsx:376-383
- **Description**: Theme toggle button text changes ("Light mode" / "Dark mode") but no `aria-live` region announces the change to screen readers.
- **Action**: Add `aria-live="polite"` region or use a toast notification for theme changes.
- **Priority**: low

### Color contrast not verified for opacity-based states

- **Spotted during**: Frontend/a11y audit (Feb 2026)
- **File**: apps/web/components/app-sidebar.tsx:249, 266-268
- **Description**: `opacity-40` on hidden calendars may fail WCAG AA contrast requirements depending on background color.
- **Action**: Verify contrast ratios at all opacity levels. Consider using text decoration or icon changes instead of opacity alone.
- **Priority**: low

### Inconsistent auth wrapper usage

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/categories/queries.ts:20-21, convex/feedback/mutations.ts:21
- **Description**: Some functions manually call `ctx.auth.getUserIdentity()` instead of using the `withQueryAuth`/`withMutationAuth` wrappers. Inconsistent patterns increase risk of forgotten auth checks.
- **Action**: Use auth wrappers consistently across all public mutations/queries.
- **Priority**: low

### Magic number constants scattered

- **Spotted during**: Convex audit (Feb 2026)
- **File**: convex/billing.ts:13, convex/hours/mutations.ts:1724, and others
- **Description**: Some magic numbers are extracted to named constants, others remain inline. Inconsistent approach.
- **Action**: Extract all magic numbers to named constants at module level.
- **Priority**: low

### No optimistic updates for task mutations

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/app/app/tasks/page.tsx:558-589
- **Description**: Task mutations like `moveTask` and `updateTask` don't use optimistic updates. When dragging a task between columns, the UI waits for the server round-trip before updating.
- **Action**: Apply optimistic state while mutations are pending for drag-and-drop operations.
- **Priority**: low

### Query status hook conflates auth loading with data loading

- **Spotted during**: Frontend audit (Feb 2026)
- **File**: apps/web/hooks/use-convex-status.ts
- **Description**: `useAuthenticatedQueryWithStatus` skips queries during auth loading but returns `isPending` for both auth loading and data loading states. Components cannot distinguish which is which.
- **Action**: Return separate `isAuthLoading` and `isDataLoading` flags.
- **Priority**: low
