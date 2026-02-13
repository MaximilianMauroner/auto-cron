# Improvements

Potential improvements spotted during development that were out of scope for the current task.

## Format

```markdown
### <short title>

- **Spotted during**: <task/commit context>
- **Description**: <what could be improved and why>
- **Priority**: low | medium | high | critical
```

### Add scheduler simulation mode

- **Spotted during**: Roadmap review
- **Description**: Add a dry-run mode that computes schedule placement without mutating `calendarEvents`, useful for explainability and UX previews.
- **Priority**: medium

### Add end-to-end auth + onboarding tests

- **Spotted during**: Setup and docs alignment
- **Description**: Add integration tests around WorkOS sign-in flow and first-run user settings initialization.
- **Priority**: high

### Strengthen environment validation

- **Spotted during**: Environment documentation pass
- **Description**: Add runtime env validation at startup so missing required variables fail fast with clear error messages.
- **Priority**: medium

### Expand RRULE support

- **Spotted during**: CP scheduler rollout
- **Description**: RRULE parsing is intentionally constrained to supported daily/weekly/monthly families; add broader RRULE support (`BYSETPOS`, richer monthly variants, exception handling) with clear validation and migration guidance.
- **Priority**: high

### Add move-weight auto-relax loop

- **Spotted during**: CP scheduler rollout
- **Description**: Implement iterative `W_move` relaxation when new mandatory work cannot be placed, so reruns can trade stability for feasibility without manual retuning.
- **Priority**: medium

### Add end-to-end scheduling diagnostics tests

- **Spotted during**: Calendar diagnostics integration
- **Description**: Add web integration tests that assert `runNow` flow, latest-run panel rendering, and hard-infeasible warning behavior.
- **Priority**: high

### Split oversized files into smaller modules

- **Spotted during**: Calendar and global styling refactors
- **Description**: Break up files with multiple thousands of LOC into smaller feature-focused modules/components to improve maintainability, reviewability, and testability.
- **Priority**: high

### Consolidate reusable design-language components

- **Spotted during**: UI and CSS deduplication pass
- **Description**: Audit the codebase for repeated UI patterns and extract reusable components that enforce the existing styling/design language consistently.
- **Priority**: medium

### Extract shared compact form field primitives

- **Spotted during**: UI and CSS deduplication pass
- **Description**: Repeated compact field patterns (`space-y-1.5` wrappers, uppercase micro-labels, 2-column field grids) appear across quick-create dialogs and edit sheets; introduce shared form primitives (e.g. `FormField`, `FormFieldLabel`, `FormFieldGrid`) to reduce drift and keep spacing/typography consistent.
- **Priority**: medium

### Consolidate stats tile pattern across tasks and habits

- **Spotted during**: UI and CSS deduplication pass
- **Description**: The `MetricTile` implementation is duplicated in tasks and habits pages with identical structure and styling; move to a shared dashboard tile component to centralize design tokens and hover behavior.
- **Priority**: medium

### Add reusable status/info inline banner component

- **Spotted during**: UI and CSS deduplication pass
- **Description**: Loading, empty, and error inline banners use near-identical rounded border + icon + muted text blocks in calendar and other surfaces; create a shared inline status banner component with variants (`loading`, `empty`, `error`).
- **Priority**: medium

### Standardize selectable list row component for settings surfaces

- **Spotted during**: UI and CSS deduplication pass
- **Description**: Category rows and hours-set rows share the same selected/hover/border treatment, spacing, and badge layout; extract a reusable selectable list row component to align interactions and visual hierarchy.
- **Priority**: medium

### Reuse calendar event quick-action control

- **Spotted during**: UI and CSS deduplication pass
- **Description**: Date-grid and time-grid events each implement nearly identical hover-only edit buttons (positioned icon button with blur/dark overlay styling); extract a single event quick-action control to keep event affordances visually consistent.
- **Priority**: low

### Split calendar client into view, interaction, and date/recurrence modules

- **Spotted during**: Calendar and global styling refactors
- **Description**: `apps/web/app/app/calendar/calendar-client.tsx` mixes ScheduleX setup, timezone/date parsing, RRULE formatting/parsing, drag/resize interactions, and right-panel/editor UI in one 4k+ LOC file; split into focused modules/hooks (e.g. `calendar-date-utils`, `calendar-recurrence`, `use-calendar-interactions`, `calendar-toolbar`, `event-editor-sheet`) to improve testability and reviewability.
- **Priority**: high

### Split habits page into templates, cards, and editor modules

- **Spotted during**: Calendar and global styling refactors
- **Description**: `apps/web/app/app/habits/page.tsx` combines large static template data, formatting helpers, list cards, and a multi-section dialog; extract feature modules (template catalog + filters, `HabitCard`, `HabitDialog` sections, shared helpers/constants) to reduce page-level complexity.
- **Priority**: high

### Split tasks page into board, dialog, and domain helpers

- **Spotted during**: Calendar and global styling refactors
- **Description**: `apps/web/app/app/tasks/page.tsx` currently holds board rendering, task card controls, dialog logic, form conversion utilities, and status lane definitions; split into `tasks-board`, `task-dialog`, and `task-form` helpers to isolate UI from transformation logic.
- **Priority**: high

### Split hours mutations by concern (preferences, hours-set CRUD, bootstrap)

- **Spotted during**: Calendar and global styling refactors
- **Description**: `convex/hours/mutations.ts` includes user preference mutations, hours-set CRUD, and internal bootstrap/migration flows in one file; split into concern-specific modules to reduce coupling and make auth/validation boundaries easier to reason about.
- **Priority**: high

### Split calendar mutations into sync state, event CRUD, and pinning modules

- **Spotted during**: Calendar and global styling refactors
- **Description**: `convex/calendar/mutations.ts` mixes sync-run bookkeeping, watch channel state, token upserts, event CRUD/move-resize, and pin/unpin behavior; divide into narrower mutation modules to simplify ownership and targeted tests.
- **Priority**: high

### Split calendar actions into sync orchestration, watch channels, and push pipeline

- **Spotted during**: Calendar and global styling refactors
- **Description**: `convex/calendar/actions.ts` combines Google sync orchestration, webhook/watch-channel lifecycle, and push-to-Google logic in a single large action file; separate these flows into dedicated action modules to improve operability and incident debugging.
- **Priority**: high

### Add horizontal swipe navigation between calendar periods

- **Spotted during**: Calendar UX improvements
- **Description**: Allow horizontal swipe/scroll to navigate between weeks/days/months in the calendar, like scrolling through an Excel sheet. A scroll-snap approach with 3 panels (prev, current, next) was prototyped but had issues: browser back gesture conflicts on macOS, Schedule-X re-initialization flashing, and layout breakage from the scroll container restructuring. Needs either a custom Schedule-X plugin or a pre-rendering strategy for adjacent periods to work smoothly.
- **Priority**: medium
