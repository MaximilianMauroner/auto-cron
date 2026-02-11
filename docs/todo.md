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

### UX + Performance

1. [ ] Unified design language based on the dataset (so it works well with shadcn/ui)
2. [ ] Use shadcn/ui whenever possible for UI primitives and patterns
3. [ ] Store a bit of calendar events on device for fast initial load

### Core product

1. [ ] Task CRUD and prioritization flows
2. [ ] Habit CRUD and scheduling preference flows
3. [ ] Auto-scheduling engine with conflict handling
4. [x] Calendar views with drag/drop rescheduling
5. [~] Google Calendar bidirectional sync
6. [ ] Scheduling run history and diagnostics UI
7. [ ] Feature gating via Autumn `check()` in Convex functions

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

### Phase 1.5: Billing with Autumn [DONE]

- [x] Install `autumn-js` and `@useautumn/convex`
- [x] Create `autumn.config.ts` with 3 plans: Basic (EUR 5/mo), Pro (EUR 8/mo), Premium (EUR 16/mo)
- [x] Define features: tasks, habits, scheduling_runs, analytics (Google Sync is free for all plans)
- [x] Set up Convex Autumn component (`convex/convex.config.ts`, `convex/autumn.ts`)
- [x] Create Next.js API route handler (`app/api/autumn/[...all]/route.ts`)
- [x] Add `AutumnProvider` wrapper to root layout
- [x] Install shadcn Autumn components (pricing-table, paywall-dialog, checkout-dialog)
- [x] Create `/pricing` page with plan comparison
- [x] Push config to Autumn dashboard (`npx atmn push`) - requires `AUTUMN_SECRET_KEY`
- [ ] Wire up `identify` in API route + Convex once WorkOS auth is live
- [ ] Add feature gating with `check()` in Convex mutations (tasks, habits, scheduling runs)
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
- [ ] Install Convex components: `@convex-dev/workpool`, `@convex-dev/workflow`, `@convex-dev/crons`, `@convex-dev/action-retrier`, `@convex-dev/rate-limiter`

### Cross-cutting UX + performance

- [ ] Unified design language based on the dataset (so it works well with shadcn/ui)
- [ ] Use shadcn/ui whenever possible for UI primitives and patterns
- [ ] Store a bit of calendar events on-device for fast initial load

### Phase 3: Task system

- [ ] Task CRUD mutations (create, update, delete, reorder)
- [ ] Task queries (by status, by user, sorted by priority/deadline)
- [ ] Tasks page UI - split view: Backlog (left) + Queue (right)
- [ ] Drag-and-drop between backlog and queue (change status on drop)
- [ ] Task creation dialog (title, description, priority, estimated duration, deadline)
- [ ] Task detail sheet/dialog with edit capability
- [ ] Inline priority badge + deadline indicator
- [ ] Bulk actions (mark done, change priority, delete)

### Phase 4: Habits system

- [ ] Habit CRUD mutations
- [ ] Habit queries (active habits by user)
- [ ] Habits page UI - grid/list of habits with frequency badges
- [ ] Habit creation dialog (title, category, frequency, duration, preferred time window, preferred days)
- [ ] Habit toggle (active/inactive)
- [ ] Habit scheduling windows - preferred time ranges per habit
- [ ] Smart free/busy detection for habit placement

### Phase 5: Auto-scheduling engine

- [ ] Priority-based greedy solver: sort tasks by (deadline urgency * priority weight), place in earliest available slot
- [ ] Respect working hours from `userSettings`
- [ ] Respect existing calendar events (busy status)
- [ ] Place habits in preferred windows when possible, fallback to any free slot
- [ ] Trigger system: auto-reschedule on task create/update/delete, on habit change, on calendar event change
- [ ] Rate-limit rescheduling triggers (max 1 per 30s per user via `@convex-dev/rate-limiter`)
- [ ] Use `@convex-dev/workpool` for priority-based job queue
- [ ] Use `@convex-dev/workflow` for durable multi-step scheduling pipeline
- [ ] Apply scheduling results as mutations to `calendarEvents` table
- [ ] Scheduling run history (track in `schedulingRuns` table)

### Phase 6: Calendar views

- [x] Integrate Schedule-X calendar (day/week/month views)
- [x] Custom event rendering by source type (task=blue, habit=green, google=gray, manual=purple)
- [x] Drag-and-drop events to reschedule (update scheduledStart/scheduledEnd)
- [x] Event detail popover on click
- [x] Mini-calendar for date navigation
- [x] "Today" button + view switcher (day/week/month)
- [x] Responsive layout: sidebar collapses on mobile

### Phase 7: Google Calendar sync

- [x] Bidirectional sync: pull Google events into Convex, push scheduled events to Google
- [x] Token refresh flow using stored refresh tokens
- [x] Incremental sync using Google sync tokens (`syncToken` in `userSettings`)
- [x] Preserve per-calendar sync tokens during refresh-token backfill/update flows
- [x] Recover invalid sync tokens (Google 410) and persist replacement tokens
- [ ] Use `@convex-dev/action-retrier` for Google Calendar API calls
- [~] Periodic sync every 15 minutes via Convex cron jobs (`convex/crons.ts`); component migration pending
- [ ] Conflict resolution: Google events take precedence, reschedule displaced tasks
- [x] Handle event deletions (both directions)
- [x] Allow local event deletion when provider-side delete fails
- [x] Honor recurring move scope (`single`, `following`, `series`) in local mutations

### Phase 8: Focus time + buffer time

- [ ] Focus time blocks: user-defined "do not schedule" periods
- [ ] Buffer time between events (configurable: 5/10/15 min)
- [ ] Travel time estimation between events (optional)
- [ ] Deep work preference: prefer scheduling complex tasks in long uninterrupted blocks

### Phase 9: Analytics dashboard

- [ ] Settings page: working hours, timezone, scheduling horizon, sync preferences
- [ ] Weekly/monthly productivity stats (tasks completed, habits maintained)
- [ ] Time allocation breakdown (chart: tasks vs habits vs meetings vs free)
- [ ] Streak tracking for habits
- [ ] Schedule adherence score
