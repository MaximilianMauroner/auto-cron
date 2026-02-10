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

## 2. Configure environment variables

Create and fill `.env` from `.env.example`:

```bash
cp .env.example .env
```

Then populate values for Convex, WorkOS, Autumn, and Google OAuth.

See [environment.md](./environment.md) for the source of truth.

## 3. Start local development

Terminal 1 (monorepo dev tasks):

```bash
bun run dev
```

Terminal 2 (Convex backend):

```bash
npx convex dev
```

## 4. Validate before shipping changes

```bash
bun run typecheck
bun run lint
bun run format
```

## Production deployment checklist

1. Create Convex production deployment (`npx convex deploy`).
2. Set all required production env vars in Convex and hosting platform.
3. Configure WorkOS redirect URIs to production domain.
4. Configure Autumn production products/features and webhook endpoints.
5. Configure Google OAuth consent + production redirect URIs.
6. Build and smoke test web app (`bun run build`).
