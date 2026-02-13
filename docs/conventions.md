# Code Conventions

## General

- TypeScript-first across apps and packages.
- Keep domain logic in Convex/shared packages, not page-level UI.
- Prefer composable functions over large monolithic modules.

## Error handling

- Use explicit, typed return paths for expected failures.
- Keep external provider failures isolated and observable.
- Avoid silent fallbacks for auth, billing, and scheduling logic.
- For auth failures in Convex functions, throw structured `ConvexError` payloads with stable codes (for example `UNAUTHORIZED`) instead of generic `Error` strings.

## Authentication boundaries

- Public Convex functions must enforce auth by default using wrapper helpers from `convex/auth.ts`:
  - `withQueryAuth`
  - `withMutationAuth`
  - `withActionAuth`
- Prefer internal-only Convex functions for backend sync pipelines and cross-function orchestration. Do not expose sync-upsert internals as public API unless the web/mobile client directly needs them.

## Schema-first changes

When changing data contracts:

1. Update `convex/schema.ts`
2. Update shared domain types in `packages/types`
3. Update affected queries/mutations/UI

## Styling

Follow [ui-styling.md](./ui-styling.md) for visual language and component styling rules.

## Formatting and linting

- Biome is the source of truth for formatting/lint checks.
- Keep imports organized and avoid dead exports.
