# Gotchas

Hard-won lessons from debugging sessions. Agents should check this file when stuck and add new entries when a fix was non-obvious.

## Convex

- `@useautumn/convex` operations may call external APIs under the hood. Keep those calls in runtime contexts supported by Convex for network access.
- WorkOS is scaffolded but not fully wired. `convex/auth.config.ts` and `convex/http.ts` contain TODO markers and should be treated as in-progress.

## Monorepo

- Root commands run through Turbo. If a workspace-specific script is missing at root, run it in the relevant package/app directly.

## Documentation process

- When a non-obvious issue is fixed, add a concise entry here with file references and the reason the issue was tricky.
