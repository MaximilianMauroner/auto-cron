# Setup

Quickstart for local development and a lightweight production checklist.

## Prerequisites

- Bun `1.2.x`
- Node.js `20+` (for ecosystem tooling like `npx`)
- A Convex account/project
- WorkOS account (auth)
- Autumn account (billing)
- Google Cloud OAuth app (calendar sync)

## 1. Install dependencies

```bash
bun install
```

`bun install` runs `prepare`, which installs Husky git hooks for this repo.
If hooks are not active, run:

```bash
bun run prepare
```

## 2. Configure environment variables

Create and fill `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then populate values for Convex, WorkOS, Autumn, and Google OAuth.
For WorkOS AuthKit local dev, set `NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback`.
Validate env wiring before starting dev/build:

```bash
bun run env:check
```

See [environment.md](./environment.md) for the source of truth.

## 3. Start local development

```bash
bun run dev
```

`bun run dev` starts both web dev and Convex dev.

## 3.1 Scheduler migration + normalization (recommended once per user)

The scheduler now uses canonical task modes (`fastest|balanced|packed`) and habit RRULE/recovery fields.
Legacy records are auto-normalized by scheduler runs, but you can proactively normalize a user from the
Convex dashboard by running `hours.actions.migrateSchedulingDataForCurrentUser`.

## 3.2 Manual scheduler run

Use the Calendar diagnostics panel "Run scheduler" button (calls `scheduling.actions.runNow`) to force an
immediate scheduling run and refresh diagnostics.

## 4. Validate before shipping changes

```bash
bun run typecheck
bun run lint
bun run format
```

Pre-commit also enforces:

1. Format staged files (`lint-staged` + Biome)
2. Lint (`bun run lint`)
3. Typecheck (`bun run typecheck`)
4. Convex tests (`bun run test:convex:run`)

## Production deployment checklist

1. Create Convex production deployment (`npx convex deploy`).
2. Set all required production env vars in Convex and hosting platform.
3. Configure WorkOS redirect URIs to production domain.
4. Configure Autumn production products/features and webhook endpoints.
5. Configure Google OAuth consent + production redirect URIs.
6. Build and smoke test web app (`bun run build`).
