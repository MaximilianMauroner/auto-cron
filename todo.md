# Auto Cron — Implementation Roadmap

## Phase 1: Monorepo Setup [DONE]
- [x] Clean up old T3 stack project files
- [x] Create TurboRepo monorepo with Bun workspaces
- [x] Set up Biome for linting/formatting
- [x] Create `apps/web` — Next.js 15 app with Tailwind v4
- [x] Install all shadcn/ui components
- [x] Create `packages/types` — shared TypeScript types (Priority, TaskStatus, HabitFrequency, etc.)
- [x] Create `packages/config` — shared tsconfig
- [x] Create `convex/` — schema, auth config, HTTP router
- [x] Create placeholder apps (mobile, desktop)
- [x] Verify: `bun install`, `turbo build`, `biome check .` all pass

## Phase 1.5: Billing with Autumn [DONE]
- [x] Install `autumn-js` and `@useautumn/convex`
- [x] Create `autumn.config.ts` with 3 plans: Basic (€5/mo), Pro (€8/mo), Premium (€16/mo)
- [x] Define features: tasks, habits, scheduling_runs, analytics (Google Sync is free for all plans)
- [x] Set up Convex Autumn component (`convex/convex.config.ts`, `convex/autumn.ts`)
- [x] Create Next.js API route handler (`app/api/autumn/[...all]/route.ts`)
- [x] Add `AutumnProvider` wrapper to root layout
- [x] Install shadcn Autumn components (pricing-table, paywall-dialog, checkout-dialog)
- [x] Create `/pricing` page with plan comparison
- [ ] Push config to Autumn dashboard (`npx atmn push`) — requires `AUTUMN_SECRET_KEY`
- [ ] Wire up `identify` in API route + Convex once WorkOS auth is live
- [ ] Add feature gating with `check()` in Convex mutations (tasks, habits, scheduling runs)
- [ ] Add billing portal link to settings page

## Phase 2: Auth + Convex Backend
- [ ] Set up Convex project (`npx convex dev`)
- [ ] Configure WorkOS AuthKit (Google OAuth provider)
- [ ] Implement `ConvexProviderWithAuthKit` wrapper in web app
- [ ] Add sign-in/sign-out flows with WorkOS
- [ ] Request Google Calendar scopes (calendar.events.owned, calendar.readonly) + offline access
- [ ] Store Google refresh tokens in Convex `userSettings` table
- [ ] Add auth guard to dashboard layout (redirect to /sign-in if unauthenticated)
- [ ] Install Convex components: `@convex-dev/workos-authkit`, `@convex-dev/workpool`, `@convex-dev/workflow`, `@convex-dev/crons`, `@convex-dev/action-retrier`, `@convex-dev/rate-limiter`

## Phase 3: Task System
- [ ] Task CRUD mutations (create, update, delete, reorder)
- [ ] Task queries (by status, by user, sorted by priority/deadline)
- [ ] Tasks page UI — split view: Backlog (left) + Queue (right)
- [ ] Drag-and-drop between backlog and queue (change status on drop)
- [ ] Task creation dialog (title, description, priority, estimated duration, deadline)
- [ ] Task detail sheet/dialog with edit capability
- [ ] Inline priority badge + deadline indicator
- [ ] Bulk actions (mark done, change priority, delete)

## Phase 4: Habits System
- [ ] Habit CRUD mutations
- [ ] Habit queries (active habits by user)
- [ ] Habits page UI — grid/list of habits with frequency badges
- [ ] Habit creation dialog (title, category, frequency, duration, preferred time window, preferred days)
- [ ] Habit toggle (active/inactive)
- [ ] Habit scheduling windows — preferred time ranges per habit
- [ ] Smart free/busy detection for habit placement

## Phase 5: Auto-Scheduling Engine
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

## Phase 6: Calendar Views
- [ ] Integrate Schedule-X calendar (day/week/month views)
- [ ] Custom event rendering by source type (task=blue, habit=green, google=gray, manual=purple)
- [ ] Drag-and-drop events to reschedule (update scheduledStart/scheduledEnd)
- [ ] Event detail popover on click
- [ ] Mini-calendar for date navigation
- [ ] "Today" button + view switcher (day/week/month)
- [ ] Responsive layout: sidebar collapses on mobile

## Phase 7: Google Calendar Sync
- [ ] Bidirectional sync: pull Google events into Convex, push scheduled events to Google
- [ ] Token refresh flow using stored refresh tokens
- [ ] Incremental sync using Google sync tokens (`syncToken` in `userSettings`)
- [ ] Use `@convex-dev/action-retrier` for Google Calendar API calls
- [ ] Use `@convex-dev/crons` for periodic sync (every 15 minutes)
- [ ] Conflict resolution: Google events take precedence, reschedule displaced tasks
- [ ] Handle event deletions (both directions)

## Phase 8: Focus Time + Buffer Time
- [ ] Focus time blocks: user-defined "do not schedule" periods
- [ ] Buffer time between events (configurable: 5/10/15 min)
- [ ] Travel time estimation between events (optional)
- [ ] Deep work preference: prefer scheduling complex tasks in long uninterrupted blocks

## Phase 9: Analytics Dashboard
- [ ] Settings page: working hours, timezone, scheduling horizon, sync preferences
- [ ] Weekly/monthly productivity stats (tasks completed, habits maintained)
- [ ] Time allocation breakdown (chart: tasks vs habits vs meetings vs free)
- [ ] Streak tracking for habits
- [ ] Schedule adherence score
