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

- None currently documented.

## High

- None currently documented.

## Medium

### Scheduling commit still scans all tasks

- **Spotted during**: Convex optimization pass (Feb 2026)
- **File**: convex/scheduling/mutations.ts (`applySchedulingBlocks`)
- **Description**: The mutation still loads all user tasks via `by_userId` and iterates every row to clear/update `scheduledStart` and `scheduledEnd`, which inflates memory/runtime for large task sets.
- **Action**: Limit updates to impacted task IDs from changed scheduling blocks plus currently scheduled tasks (via `by_userId_status`) and patch only when values actually change.
- **Priority**: medium

## Low

- None currently documented.
