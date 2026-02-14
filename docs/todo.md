# TODO

Feature requirements, platform status, and roadmap. Update when features are implemented or priorities change.

Legend: [x] implemented · [~] partially implemented · [ ] not started

## Requirements checklist

### Foundations

1. [x] Monorepo setup with Turbo + Bun workspaces
2. [x] Convex schema for core scheduling entities
3. [x] Shared package structure (`packages/types`, `packages/config`)
4. [x] Billing scaffolding with Autumn
5. [x] WorkOS auth integration (web + Convex wiring)
6. [x] Pre-commit quality gate (format staged files, lint, typecheck, tests)

### UX + Performance

1. [ ] Unified design language based on the dataset (so it works well with shadcn/ui)
2. [ ] Use shadcn/ui whenever possible for UI primitives and patterns
3. [ ] Store a bit of calendar events on device for fast initial load

### Core product

1. [x] Task CRUD and prioritization flows
2. [x] Habit CRUD and scheduling preference flows
3. [x] Auto-scheduling engine with conflict handling
4. [x] Calendar views with drag/drop rescheduling
5. [~] Google Calendar bidirectional sync (task/habit event protection, pinning on move/resize)
6. [x] Scheduling run history and diagnostics UI
7. [~] Feature gating via Autumn `check()` in Convex functions (task/habit create only)

## Implementation roadmap

### Phase 1: Monorepo setup [DONE]

- [x] Clean up old T3 stack project files
- [x] Create TurboRepo monorepo with Bun workspaces
- [x] Set up Biome for linting/formatting
- [x] Create `apps/web` - Next.js 15 app with Tailwind v4
- [x] Install all shadcn/ui components
- [x] Create `packages/types` - shared TypeScript types (Priority, TaskStatus, HabitFrequency, etc.)
- [x] Create `packages/config` - shared tsconfig
- [x] Create `convex/` - schema, auth config, HTTP router
- [x] Create placeholder apps (mobile, desktop)
- [x] Verify: `bun install`, `turbo build`, `biome check .` all pass
- [x] Add Husky pre-commit hook with staged formatting + lint/typecheck/tests gate

### Phase 1.5: Billing with Autumn [DONE]

- [x] Install `autumn-js` and `@useautumn/convex`
- [x] Create `autumn.config.ts` with 3 plans: Basic (EUR 5/mo), Pro (EUR 8/mo), Premium (EUR 16/mo)
- [x] Define features: tasks, habits, analytics (Google Sync + scheduling are free for all plans)
- [x] Set up Convex Autumn component (`convex/convex.config.ts`, `convex/autumn.ts`)
- [x] Create Next.js API route handler (`app/api/autumn/[...all]/route.ts`)
- [x] Add `AutumnProvider` wrapper to root layout
- [x] Install shadcn Autumn components (pricing-table, paywall-dialog, checkout-dialog)
- [x] Create `/pricing` page with plan comparison
- [x] Push config to Autumn dashboard (`npx atmn push`) - requires `AUTUMN_SECRET_KEY`
- [x] Wire up `identify` in API route + Convex once WorkOS auth is live
- [x] Add feature gating + reservation flow for `createTask`/`createHabit` actions only
- [ ] Add billing portal link to settings page

### Phase 2: Auth + Convex backend

- [x] Set up Convex project (`npx convex dev`)
- [x] Configure WorkOS AuthKit (Google OAuth provider)
- [x] Implement `ConvexProviderWithAuthKit` wrapper in web app
- [x] Add sign-in/sign-out flows with WorkOS
- [x] Request Google Calendar scopes (calendar.events.owned, calendar.readonly) + offline access
- [x] Store Google refresh tokens in Convex `userSettings` table
- [x] Add auth guard to dashboard layout (redirect to /sign-in if unauthenticated)
- [x] Install Convex component: `@convex-dev/workos-authkit`
- [x] Add Convex auth wrappers + structured unauthorized errors (`UNAUTHORIZED`)
- [x] Add Convex auth hardening tests (`convex-test` + `vitest` + edge-runtime)
- [~] Install Convex components: `@convex-dev/crons` done; `@convex-dev/workpool`, `@convex-dev/workflow`, `@convex-dev/action-retrier`, and `@convex-dev/rate-limiter` pending (https://www.convex.dev/components/rate-limiter)

### Cross-cutting UX + performance

- [ ] Unified design language based on the dataset (so it works well with shadcn/ui)
- [ ] Use shadcn/ui whenever possible for UI primitives and patterns
- [ ] Store a bit of calendar events on-device for fast initial load
- [x] Standardize Convex query usage on status-aware hooks (`useQueryWithStatus` + authenticated wrappers)

### Phase 3: Task system

- [x] Task CRUD API surface (`create` action + `update/delete/reorder` mutations)
- [x] Task queries (by status, by user, sorted by status/sort order)
- [x] Tasks page UI - split view: Backlog (left) + execution lanes (right)
- [ ] Drag-and-drop between backlog and queue (change status on drop)
- [x] Task creation dialog (title, description, priority, estimated duration, deadline)
- [x] Task detail/edit dialog with update capability
- [x] Inline priority badge + deadline indicator
- [x] Per-task hours set assignment (`hoursSetId`) + scheduling mode override (`fastest|balanced|packed`)
- [ ] Bulk actions (mark done, change priority, delete)

### Phase 4: Habits system

- [x] Habit CRUD API surface (`create` action + `update/delete/toggle` mutations)
- [x] Habit queries (all by user + optional active filter)
- [x] Habits page UI - dense list/cards with frequency/category/duration chips
- [x] Habit creation/edit dialog (title, category, frequency, duration, preferred window, preferred days)
- [x] Habit advanced options editor (priority, calendar, visibility, time defense, reminders, location)
- [x] Habit toggle (active/inactive)
- [x] Habit scheduling windows - preferred time ranges per habit
- [x] Habit hours set assignment (`hoursSetId`)
- [ ] Smart free/busy detection for habit placement

### Phase 5: Auto-scheduling engine

- [x] Constraint-based slot scheduler (`convex/scheduling/*`) with two-pass solve (on-time feasibility + optimized pass)
- [x] Hours-set model + bootstrap migration (`Work`, `Anytime (24/7)`, default enforcement)
- [x] Respect selected hours sets in scheduler placement logic
- [x] Respect existing calendar events (busy status)
- [x] Place habits from RRULE recurrence with preference penalties + recovery/skip policies
- [x] Trigger system: auto-reschedule on task create/update/delete, on habit change, on calendar event change
- [ ] Rate-limit rescheduling triggers (max 1 per 30s per user via `@convex-dev/rate-limiter`; docs: https://www.convex.dev/components/rate-limiter)
- [ ] Use `@convex-dev/workpool` for priority-based job queue
- [ ] Use `@convex-dev/workflow` for durable multi-step scheduling pipeline
- [x] Apply scheduling results as mutations to `calendarEvents` table
- [x] Scheduling run history (track in `schedulingRuns` table)
- [x] Hard infeasibility policy: no partial apply, preserve existing schedule and emit diagnostics
- [x] Keep scheduling unlimited for all plans (remove scheduling metering)

### Phase 6: Calendar views

- [x] Integrate Schedule-X calendar (day/week/month views)
- [x] Custom event rendering by source type (task=blue, habit=green, google=gray, manual=purple)
- [x] Drag-and-drop events to reschedule (update scheduledStart/scheduledEnd)
- [x] Event detail popover on click
- [x] Event editor fields for calendar, busy/free, visibility, and location
- [x] Mini-calendar for date navigation
- [x] "Today" button + view switcher (day/week/month)
- [x] Responsive layout: sidebar collapses on mobile
- [x] Collapsible left sidebar with icon mode and SidebarRail
- [x] Right aside panel with Tasks/Priorities tabs and keyboard shortcut (Cmd+.)

### Phase 7: Google Calendar sync

- [x] Bidirectional sync: pull Google events into Convex, push scheduled events to Google
- [x] Token refresh flow using stored refresh tokens
- [x] Incremental sync using Google sync tokens (`syncToken` in `userSettings`)
- [x] Preserve per-calendar sync tokens during refresh-token backfill/update flows
- [x] Recover invalid sync tokens (Google 410) and persist replacement tokens
- [ ] Use `@convex-dev/action-retrier` for Google Calendar API calls
- [x] Queue-backed periodic fallback sync via cron (6h) for connected users
- [x] Push-triggered sync via Google Calendar watch channels (`events.watch`) + Convex webhook
- [x] Watch-channel renewal cron (6h) with expiring-channel refresh
- [~] Conflict resolution: task/habit events preserve identity during Google sync; moved task events get pinned
- [x] Handle event deletions (both directions, task/habit events unlink + reschedule instead of hard-delete)
- [x] Allow local event deletion when provider-side delete fails
- [x] Honor recurring move scope (`single`, `following`, `series`) in local mutations
- [x] Internalize sync-upsert mutation surface (remove unused public `upsertSyncedEvents`)

### Phase 8: Focus time + buffer time

- [ ] Focus time blocks: user-defined "do not schedule" periods
- [ ] Buffer time between events (configurable: 5/10/15 min)
- [ ] Travel time estimation between events (optional)
- [ ] Deep work preference: prefer scheduling complex tasks in long uninterrupted blocks

### Phase 9: Analytics dashboard

- [~] Settings page: hours sets manager + default task scheduling mode + calendar timezone/clock mode implemented; remaining sections pending (scheduling horizon, sync preferences)
- [x] Calendar diagnostics panel with latest run, late tasks, shortfalls, and manual run trigger
- [ ] Weekly/monthly productivity stats (tasks completed, habits maintained)
- [ ] Time allocation breakdown (chart: tasks vs habits vs meetings vs free)
- [ ] Streak tracking for habits
- [ ] Schedule adherence score
