# TODO

Feature requirements, platform status, and roadmap. Update when features are implemented or priorities change.

Legend: [x] implemented · [~] partially implemented · [ ] not started

## Requirements checklist

### Foundations

1. [x] Monorepo setup with Turbo + Bun workspaces
2. [x] Convex schema for core scheduling entities
3. [x] Shared package structure (`packages/types`, `packages/config`)
4. [x] Billing scaffolding with Autumn
5. [~] WorkOS auth integration scaffold (config present, full wiring pending)

### Core product

1. [ ] Task CRUD and prioritization flows
2. [ ] Habit CRUD and scheduling preference flows
3. [ ] Auto-scheduling engine with conflict handling
4. [ ] Calendar views with drag/drop rescheduling
5. [ ] Google Calendar bidirectional sync
6. [ ] Scheduling run history and diagnostics UI
7. [ ] Feature gating via Autumn `check()` in Convex functions

## Roadmap

### Near term

- [ ] Complete WorkOS auth wiring in web and Convex
- [ ] Implement task CRUD mutations and queries
- [ ] Implement habit CRUD mutations and queries
- [ ] Build dashboard pages for tasks/habits/calendar/settings
- [ ] Add billing portal entry point in settings

### Mid term

- [ ] Implement first scheduling solver iteration (priority + deadlines + working hours)
- [ ] Add rate-limited re-scheduling triggers
- [ ] Add Google Calendar token storage + refresh handling
- [ ] Add periodic sync cron jobs

### Later

- [ ] Mobile app implementation (Expo)
- [ ] Desktop app implementation
- [ ] Analytics dashboard and schedule adherence metrics
