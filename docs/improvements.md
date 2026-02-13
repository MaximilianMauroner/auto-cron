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
