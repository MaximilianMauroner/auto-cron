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
