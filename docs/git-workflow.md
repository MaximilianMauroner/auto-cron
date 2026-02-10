# Git Workflow

This project prefers Graphite (`gt`) for stacked branch workflows.

## Basic commands

```bash
# Sync with main
gt sync

# Create a branch + commit
gt create -m "feat: short description"

# Update/amend current branch
gt modify

# Submit stack to GitHub
gt submit --publish

# Inspect branch stack
gt log
```

## Commit message format

Every commit/PR message should include:

1. Summary
2. Why
3. What needs to be tested
4. Future improvements
5. Confidence: X/5

## Branch naming

Use `codex/<topic>` for Codex-created branches unless another convention is explicitly requested.
