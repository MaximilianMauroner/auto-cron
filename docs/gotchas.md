# Gotchas

Hard-won lessons from debugging sessions. Agents should check this file when stuck and add new entries when a fix was non-obvious.

## Convex

- `@useautumn/convex` operations may call external APIs under the hood. Keep those calls in runtime contexts supported by Convex for network access.
- WorkOS AuthKit webhook is wired via `@convex-dev/workos-authkit` component (`convex/auth.ts`, `convex/http.ts`). The `WORKOS_WEBHOOK_SECRET` env var must be set in Convex (not `.env.local`) via `npx convex env set`.
- Google calendar sync can fail with `Google refresh token not configured` if OAuth callback token persistence races or misses. Backfill `google_refresh_token` from HTTP-only cookie into `calendar/mutations:upsertGoogleTokens` during `/calendar` server render to self-heal existing sessions.
- Autumn web SDK can log `Fetch failed: /api/autumn/...` during SSR when `backendUrl` is relative. Use an absolute backend URL in `apps/web/app/AutumnProvider.tsx` and optionally set `NEXT_PUBLIC_AUTUMN_BACKEND_URL`.

## Monorepo

- Root commands run through Turbo. If a workspace-specific script is missing at root, run it in the relevant package/app directly.

## Documentation process

- When a non-obvious issue is fixed, add a concise entry here with file references and the reason the issue was tricky.
