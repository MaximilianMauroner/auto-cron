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
|-------|------------|
| Web Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Convex |
| Auth | WorkOS AuthKit (scaffolded) |
| Billing | Autumn |
| Build & Monorepo | Turbo + Bun workspaces |
| Code Quality | Biome + TypeScript |

## Core Data Model

Defined in `convex/schema.ts`:

- `userSettings` — per-user preferences, Google tokens, timezone, scheduling config
- `tasks` — task definitions with priority, deadline, duration, scheduling metadata
- `habits` — habit definitions with recurrence rules and recovery policy
- `hoursSets` — reusable time-window sets that control when tasks/habits can be scheduled
- `taskCategories` — user-defined categories with colors for tasks and habits
- `calendarEvents` — individual event occurrences from any source (manual, google, task, habit)
- `calendarEventSeries` — shared metadata for recurring event series
- `googleCalendarWatchChannels` — active Google push notification channel registrations
- `googleSyncRuns` — tracks lifecycle of each Google Calendar sync operation
- `schedulingRuns` — tracks lifecycle and diagnostics of each constraint-solver run
- `billingReservations` — transactional billing state for task/habit creation
- `billingLocks` — per-user/per-feature locks to serialize billable operations

## System Flowcharts

### High-level overview

The system has four external boundaries: the user's browser, WorkOS (auth), Google Calendar (bidirectional sync), and Autumn (billing). All domain logic runs inside Convex. The core loop is: user changes data → scheduler recomputes the plan → changed events push to Google → Google changes pull back in and may re-trigger the scheduler.

```mermaid
flowchart TB
    subgraph User["User (Browser)"]
        UI[Next.js Web App]
    end

    subgraph WorkOS["WorkOS"]
        Auth[AuthKit OAuth]
    end

    subgraph Google["Google"]
        GCal[Google Calendar API]
        GPush[Push Notifications]
    end

    subgraph AutumnSvc["Autumn"]
        Billing[Billing API]
    end

    subgraph Convex["Convex Backend"]
        Mutations[Mutations / Actions]
        Queries[Queries]
        Scheduler[Constraint Scheduler]
        SyncWorker[Google Sync Worker]
        Crons[Cron Jobs]
        DB[(Database)]
    end

    UI -->|auth redirect| Auth
    Auth -->|callback + tokens| UI
    UI -->|read| Queries
    UI -->|write| Mutations

    Mutations -->|enqueue| Scheduler
    Scheduler -->|read/write| DB
    Scheduler -->|push events| GCal

    GPush -->|webhook| SyncWorker
    SyncWorker -->|pull events| GCal
    SyncWorker -->|read/write| DB
    SyncWorker -->|enqueue| Scheduler

    Mutations -->|check/track| Billing
    Mutations -->|read/write| DB
    Queries -->|read| DB

    Crons -->|enqueue| SyncWorker
    Crons -->|renew channels| GCal
```

### Authentication & onboarding

**When:** A user visits the app for the first time or signs in again.

**Why:** WorkOS handles identity so we don't store passwords. The callback is also where we capture the Google OAuth refresh token — without it, calendar sync can't work. New users get seeded with default hours sets, sample tasks/habits, and a billing customer so every downstream feature has data to work with immediately.

```mermaid
flowchart TD
    A[User visits app] --> B[Redirect to WorkOS AuthKit]
    B --> C[OAuth flow completes]
    C --> D["/callback route"]

    D --> E{Google tokens\nin OAuth response?}
    E -->|Yes — needed for calendar sync| F[Store googleRefreshToken\nin userSettings]
    E -->|No| G[App works without\nGoogle sync]

    F --> H[Enqueue initial Google sync run\nto import existing calendar events]
    F --> I[Ensure watch channels\nso future Google changes push to us]

    D --> J{First time user?}
    J -->|Yes — no data exists yet| K[Bootstrap default planner data]
    J -->|No| L[Return to app]

    K --> K1[Create system hours sets\nWork 9-5 + Anytime 24/7\nso scheduler has time windows]
    K --> K2[Create default task categories\nso UI has colors/groups ready]
    K --> K3[Seed 6 sample tasks\nso dashboard isn't empty]
    K --> K4[Seed 6 sample habits\nso user sees the feature]
    K --> K5[Create Autumn billing customer\nso usage tracking works]

    K1 & K2 & K3 & K4 & K5 --> M[Enqueue scheduling run\nto place seeded items on calendar]
    M --> L
```

### Task & habit lifecycle

**When:** Any time the user creates, edits, deletes, or reorders a task or habit from the UI.

**Why:** Every data change that could affect the calendar plan must trigger a scheduling run so the plan stays current. Creates are the only billable operation — Autumn enforces plan limits. Updates and deletes are ungated (auth + ownership only) because the user already paid for the entity. Moving a task to backlog unpins its calendar events so the scheduler reclaims those slots.

```mermaid
flowchart TD
    subgraph Create["Create — only billable operation"]
        C1[UI calls createTask / createHabit action]
        C1 --> C2[Acquire billing lock\nserializes concurrent creates per user]
        C2 --> C3{Autumn check:\nplan limit reached?}
        C3 -->|Yes| C3a[Throw FEATURE_LIMIT_REACHED\nUI shows upgrade prompt]
        C3 -->|No| C4[Create billing reservation\ntracks in-flight operation]
        C4 --> C5[Insert task/habit into DB]
        C5 --> C6[Track usage via Autumn\nidempotent by operationKey]
        C6 -->|Success| C7[Commit reservation]
        C6 -->|Failure| C8[Rollback — delete entity\nuser sees no partial state]
        C7 --> C9[Release lock]
        C8 --> C9
        C5 --> C10[Enqueue scheduling run\nnew item needs calendar placement]
    end

    subgraph Update["Update — ungated"]
        U1[UI calls updateTask / updateHabit]
        U1 --> U2[Validate ownership]
        U2 --> U3[Patch entity in DB]
        U3 --> U4{Changed priority, duration,\ndeadline, hours set, or status?}
        U4 -->|Yes — affects placement| U5[Enqueue scheduling run]
        U4 -->|No — cosmetic change| U6[Done — no reschedule needed]
    end

    subgraph Delete["Delete — ungated"]
        D1[UI calls deleteTask / deleteHabit]
        D1 --> D2[Validate ownership]
        D2 --> D3[Delete entity from DB]
        D3 --> D4[Enqueue scheduling run\nfrees up calendar slots]
    end

    subgraph StatusChange["Task status transitions"]
        S1[User moves task to\nbacklog / queued / done]
        S1 --> S2{Moving to backlog?}
        S2 -->|Yes — user deprioritized it| S3[Unpin all calendar events\nso scheduler reclaims those slots]
        S2 -->|No| S4{Moving to done?}
        S4 -->|Yes| S5[Set completedAt\nscheduler stops placing it]
        S3 & S4 & S5 --> S6[Enqueue scheduling run\nplan needs to reflect new status]
    end
```

### Scheduling pipeline

**When:** Enqueued by any mutation that changes tasks, habits, hours sets, calendar events, or scheduling-relevant settings (timezone, horizon, downtime, mode).

**Why:** The scheduler is the core of auto-cron — it turns a pile of tasks, habits, and time constraints into a concrete calendar plan. It debounces (3 s window) to avoid redundant runs when the user makes rapid edits. It supersedes stale runs so only the latest state gets solved. After placing events locally, it pushes changes to Google so the user's external calendar stays in sync.

```mermaid
flowchart TD
    T1([Task change]) --> E
    T2([Habit change]) --> E
    T3([Hours set change]) --> E
    T4([Calendar event change]) --> E
    T5([Settings change:\ntimezone, horizon,\ndowntime, mode]) --> E

    E[enqueueSchedulingRunFromMutation]
    E --> E1{Pending run\nalready queued?}
    E1 -->|Yes — no need for another| E2[Return existing run ID]
    E1 -->|No| E3{Run completed within\nlast 3 s for same trigger?}
    E3 -->|Yes — too soon| E2
    E3 -->|No| E4[Insert schedulingRun\nstatus: pending]
    E4 --> E5[Schedule runForUser action\nexecutes immediately]

    E5 --> R1[Mark run: status running]
    R1 --> R2{Newer pending run\narrived while waiting?}
    R2 -->|Yes — our input is stale| R3[Fail: SUPERSEDED_BY_NEWER_RUN\nthe newer run will use fresher data]
    R2 -->|No| R4[Bootstrap hours sets\n+ migrate legacy scheduling fields]
    R4 --> R5[Load all scheduling input:\nsettings, hours sets, tasks,\nhabits, calendar events]
    R5 --> R6[solveSchedule — constraint solver\npass A: due-date feasibility\npass B: optimize placement]

    R6 --> R7{Feasible?}
    R7 -->|No — INFEASIBLE_HARD\ntoo many tasks for available time| R8[Fail run\nkeep existing blocks unchanged\nso user's calendar isn't wiped]
    R7 -->|Yes| R9[applySchedulingBlocks]

    R9 --> R9a[Diff new blocks vs existing calendarEvents\npatch-in-place to preserve googleEventIds]
    R9a --> R9b[Insert new / delete stale events\nonly touch what actually changed]
    R9b --> R9c[Update each task's\nscheduledStart + scheduledEnd + status]
    R9c --> R10[Complete run\nstore diagnostics: lateTasks,\nhabitShortfalls, objectiveScore]

    R10 --> R11{Any scheduled events\nactually changed?}
    R11 -->|Yes — Google needs to know| R12[syncScheduledBlocksToGoogle\npush creates/updates/deletes]
    R11 -->|No — plan unchanged| R13[Done]
```

### Google Calendar sync — inbound (pull)

**When:** Triggered by three sources: (1) Google push notification webhook — fires within seconds of any change in the user's Google Calendar, (2) cron fallback every 6 hours — catches anything webhooks missed, (3) OAuth connect — imports the user's full calendar on first link.

**Why:** The scheduler needs to know about external busy time (meetings, appointments) to avoid double-booking. Inbound sync also detects when a user moves or deletes a scheduler-generated event in Google — moved events get pinned (respected as-is), deleted events get cancelled and trigger rescheduling so the task/habit gets a new slot.

```mermaid
flowchart TD
    subgraph Triggers["When does a sync start?"]
        W[Google push notification\nPOST /google/calendar/webhook\nfires seconds after any Google change]
        CR[Cron fallback — every 6 h\ncatches missed webhooks]
        OA[OAuth connect\nimports full calendar on first link]
    end

    W --> V1[Validate channel ID +\ntoken hash + resource ID]
    V1 --> V2{Valid channel?}
    V2 -->|No — stale or spoofed| V3[Reject silently — 200 OK]
    V2 -->|Yes| V4[Record notification\ndebounce 15 s to batch rapid changes]
    V4 --> V5{State = sync?}
    V5 -->|Yes — just a handshake| V6[Return — no work needed]
    V5 -->|No — real change| ENQ

    CR --> ENQ
    OA --> ENQ

    ENQ[Enqueue googleSyncRun\nstatus: pending]
    ENQ --> S1[Mark run: status running]
    S1 --> S2[Fetch googleRefreshToken\n+ per-calendar sync tokens]
    S2 --> S3[List writable calendars from Google]
    S3 --> S4[For each calendar:\nincremental sync via syncToken\nonly fetches changes since last sync]
    S4 --> S5[Map Google events to local format]
    S5 --> S6[Batch upsert into calendarEvents\nbatch size 50 to avoid OCC failures]

    S6 --> S7[Per event: conflict resolution]
    S7 --> S7a{Is it a scheduler-generated event?\nsource = task or habit with sourceId}
    S7a -->|Yes + deleted in Google\nuser removed it from their calendar| S7b[Unlink googleEventId +\nmark cancelled\nscheduleImpact = true]
    S7a -->|Yes + moved/resized in Google\nuser manually adjusted it| S7c[Pin event\nscheduler will respect\nthis manual placement\nscheduleImpact = true]
    S7a -->|No — regular Google event| S7d[Standard upsert\nnewer timestamp wins]

    S6 --> S8[Normalize + dedupe events in range]
    S8 --> S9[Complete sync run — store counts]

    S9 --> S10{scheduleImpact = true?\na protected event was touched}
    S10 -->|Yes — plan is now stale| S11[Enqueue scheduling run\ntriggeredBy: calendar_change\nscheduler re-solves around\nthe pinned/cancelled event]
    S10 -->|No — only external events changed| S12[Done — scheduler already\nknows about this busy time\nnext run will pick it up naturally]
```

### Google Calendar sync — outbound (push)

**When:** Immediately after a scheduling run completes, but only if the solver actually changed any calendar events.

**Why:** The scheduler writes task/habit blocks to the local `calendarEvents` table, but the user's Google Calendar doesn't know about them yet. This step mirrors the local plan to Google so the user sees their scheduled blocks alongside their existing meetings. It diffs against what's already in Google to minimize API calls — unchanged events are skipped entirely.

```mermaid
flowchart TD
    A[Scheduling run completed\nwith changed events] --> B[syncScheduledBlocksToGoogle]

    B --> C[Fetch googleRefreshToken]
    C --> D[List local scheduled events\nsource = task or habit\nwithin scheduling horizon]
    D --> E[List current Google events\nin same horizon for comparison]

    E --> F[Build remote event map\nby googleEventId]

    F --> G[For each event the scheduler removed]
    G --> G1{Still exists in Google?}
    G1 -->|Yes — stale block| G2[Delete from Google Calendar\nso user doesn't see a ghost event]
    G1 -->|No — already gone| G3[Skip]

    F --> H[For each local scheduled event]
    H --> H1{Already in Google\nand unchanged?}
    H1 -->|Yes — title, time, etc. match| H2[Skip — no API call needed]
    H1 -->|No googleEventId — new block| H3[Create in Google Calendar]
    H1 -->|Has googleEventId but changed| H4[Update in Google Calendar]

    H3 --> I[Store returned googleEventId +\netag + lastSyncedAt locally\nso next diff can detect changes]
    H4 --> I

    I --> J[Done — Google Calendar\nnow matches the local plan]
```

### Watch channel lifecycle

**When:** Channels are created on OAuth connect (so push notifications start immediately) and renewed by a cron every 6 hours (Google watch channels expire after ~7 days).

**Why:** Without watch channels, the only way to detect Google Calendar changes would be polling. Push notifications let us react within seconds. Each writable calendar gets its own channel. When a user removes a calendar from their Google account, the orphaned channel is stopped to avoid wasted webhook traffic.

```mermaid
flowchart TD
    A[OAuth connect\nor cron renewal every 6 h] --> B[ensureWatchChannelsForUser]
    B --> C[List writable calendars from Google]
    C --> D[List existing watch channels from DB]

    D --> E[For each target calendar]
    E --> F{Fresh channel exists?\nnot expiring within renewal window}
    F -->|Yes — still valid| G[Reuse — no action needed]
    F -->|Expiring or stopped| H[Stop old channel in Google\nso it doesn't send duplicate notifications]
    H --> I[Deactivate channel in DB]
    I --> J[Create new watch via Google API\nregisters webhook endpoint]
    J --> K[Store channel metadata in\ngoogleCalendarWatchChannels]

    D --> L[For orphaned channels\ncalendar no longer exists or not writable]
    L --> M[Stop channel in Google]
    M --> N[Deactivate in DB\nprevents stale webhook handling]
```

### Trigger chain — what causes what and why

This diagram shows the complete cause-and-effect chain across the system. The key feedback loop: user actions trigger scheduling, scheduling pushes to Google, Google changes pull back in, and if a protected event was touched, scheduling runs again.

```mermaid
flowchart LR
    subgraph UserActions["User actions in the UI"]
        TA[Create / update / delete task]
        HA[Create / update / delete habit]
        HSA[Create / update / delete hours set]
        CEA[Create / update / delete\nmanual calendar event]
        SA[Change settings:\ntimezone, horizon,\ndowntime, scheduling mode]
        DnD[Drag/resize event\nin calendar UI]
    end

    subgraph ExternalTriggers["External / automated triggers"]
        GW[Google webhook\nfires on any calendar change]
        CRON1[Cron: sync fallback every 6 h\ncatches missed webhooks]
        CRON2[Cron: watch renewal every 6 h\nkeeps push channels alive]
        CRON3[Cron: clamp horizons daily 03:00 UTC\nenforces plan limits]
    end

    TA & HA & HSA & CEA & SA & DnD -->|plan may be stale| SR[Scheduling Run]
    SR -->|events changed| GOUT[Google outbound sync\nmirrors plan to Google]

    GW & CRON1 -->|external events changed| GIN[Google inbound sync\nimports changes to local DB]
    GIN -->|protected event\nmoved or deleted| SR

    DnD -->|task/habit event dragged| PIN[Pin event\nscheduler respects manual placement]
    PIN --> SR

    CRON2 --> WR[Watch channel renewal\nkeeps push notifications flowing]
    CRON3 --> CH[Clamp user horizons\nto billing plan limits]
```

## Architecture principle

Provider-specific logic should stay isolated behind adapter boundaries.

- Auth provider concerns belong in auth integration layers (`convex/auth.config.ts`, web auth wrappers).
- Billing provider concerns belong in Autumn-specific modules (`convex/autumn.ts`, `autumn.config.ts`, web API adapter).
- Business logic should not depend directly on provider SDK details.
