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

### Use `by_userId_seriesId_occurrenceStart` index for series event queries

- **Spotted during**: Query optimization audit
- **Description**: Two queries in `convex/calendar/mutations.ts` (lines 1119-1123 in `updateEvent` and lines 1217-1221 in `moveResizeEvent`) filter on `seriesId` using `.withIndex("by_userId")` + `.filter(q.eq(q.field("seriesId"), ...))`. The compound index `by_userId_seriesId_occurrenceStart` already exists — switching to `.withIndex("by_userId_seriesId_occurrenceStart", (q) => q.eq("userId", userId).eq("seriesId", event.seriesId))` would eliminate the full-table scan over all user events and read only the matching series.
- **Priority**: high

### Convert `ctx.db.replace` calls to `ctx.db.patch` on `userSettings`

- **Spotted during**: Query optimization audit
- **Description**: Three `ctx.db.replace` calls on `userSettings` (in `hours/mutations.ts:481` `ensureSettingsForUser`, `calendar/mutations.ts:842` `performUpsertSyncedEventsForUser`, and `calendar/mutations.ts:896` `upsertGoogleTokens`) replace the entire document even though only 2-4 fields change. Each replace rewrites 16+ fields and risks stripping fields added later. Converting to `ctx.db.patch` with only the changed fields reduces write bandwidth and eliminates the fragile field-forwarding pattern.
- **Priority**: high

### Fix N+1 query pattern in `reorderTasks`

- **Spotted during**: Query optimization audit
- **Description**: `convex/tasks/mutations.ts` `reorderTasks` (line 279) loops over `args.items` and calls `ctx.db.get(item.id)` sequentially for each task to verify ownership. This is an N+1 pattern — for a list of 20 tasks, that's 20 sequential point reads. Replace with a single `Promise.all(args.items.map(item => ctx.db.get(item.id)))` to parallelize the reads, or fetch all user tasks once with the `by_userId` index and verify membership in-memory.
- **Priority**: medium

### Parallelize sequential queries in `upsertWatchChannel`

- **Spotted during**: Query optimization audit
- **Description**: `convex/calendar/mutations.ts` `upsertWatchChannel` performs two independent queries sequentially — fetching the existing watch channel and the user settings. These can be parallelized with `Promise.all` since neither depends on the other's result.
- **Priority**: low

### Add pagination or limits to unbounded `.collect()` calls on hot paths

- **Spotted during**: Query optimization audit
- **Description**: Several hot-path queries use unbounded `.collect()` which reads all matching documents into memory. Key examples: `getSchedulingInputForUser` collects all user tasks/habits/hoursSets, `performUpsertSyncedEventsForUser` reset flow collects all user events, and `applySchedulingBlocks` collects all events in the scheduling horizon. For users with large datasets, these can become expensive. Consider adding `.take(limit)` guards or paginated processing where feasible.
- **Priority**: low

### Extract shared normalize/dedupe helpers to reduce duplication

- **Spotted during**: Query optimization audit (PR review)
- **Description**: `normalizeAndDedupeEventsInRange` in `convex/calendar/internal.ts` largely duplicates logic from the standalone `normalizeGoogleEventsInRange` and `dedupeUserCalendarEventsInRange` mutations. With three separate implementations, future fixes to normalization or dedupe behavior can easily diverge. Extract shared helper functions (e.g., normalize over an in-memory event list, then dedupe) and reuse them from all three mutations to keep behavior consistent.
- **Priority**: medium
