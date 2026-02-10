# Code Conventions

## General

- TypeScript-first across apps and packages.
- Keep domain logic in Convex/shared packages, not page-level UI.
- Prefer composable functions over large monolithic modules.

## Error handling

- Use explicit, typed return paths for expected failures.
- Keep external provider failures isolated and observable.
- Avoid silent fallbacks for auth, billing, and scheduling logic.

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
