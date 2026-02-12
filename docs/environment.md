# Environment Variables

Single source of truth for environment variables used by `auto-cron`.

## Root `.env`

Copy from `.env.example` and set values:

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex URL used by the web client (public) | Yes* |
| `CONVEX_URL` | Server-side Convex URL fallback when `NEXT_PUBLIC_CONVEX_URL` is not set | Yes* |
| `CONVEX_DEPLOY_KEY` | Convex deployment/auth key for backend operations | Yes |
| `WORKOS_API_KEY` | WorkOS server API key | Yes |
| `WORKOS_CLIENT_ID` | WorkOS AuthKit client ID | Yes |
| `WORKOS_COOKIE_PASSWORD` | Session cookie encryption secret (>= 32 chars) | Yes |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Browser redirect URI for WorkOS auth flow | Yes |
| `AUTUMN_SECRET_KEY` | Autumn secret key for billing calls | Yes |
| `NEXT_PUBLIC_AUTUMN_BACKEND_URL` | Absolute origin for Autumn web SDK (recommended for SSR) | No |
| `WORKOS_WEBHOOK_SECRET` | WorkOS webhook signing secret (set in Convex env via `npx convex env set`) | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for calendar sync | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret for calendar sync | Yes |
| `GOOGLE_CALENDAR_WEBHOOK_URL` | Public HTTPS endpoint for Google Calendar push notifications (Convex HTTP route) | Yes (for push sync) |
| `GOOGLE_CALENDAR_WEBHOOK_TOKEN_SECRET` | Secret used to hash/validate Google watch channel tokens | Yes (for push sync) |

## Notes

- Env validation uses `@t3-oss/env-nextjs` in web (`apps/web/env/*`) and `@t3-oss/env-core` for root checks (`scripts/validate-env.ts`).
- Convex runtime reads env directly via `process.env` in `convex/env.ts` (Convex-managed env behavior).
- `bun run build` now fails fast when required env variables are missing or invalid.
- `bun run env:check` validates build/runtime vars; Convex-only secrets like `WORKOS_WEBHOOK_SECRET` still need to be configured in Convex separately.
- `*` Convex URL requirement means at least one of `NEXT_PUBLIC_CONVEX_URL` or `CONVEX_URL` must be set.
- `NEXT_PUBLIC_*` variables are exposed to browser bundles.
- `NEXT_PUBLIC_AUTUMN_BACKEND_URL` avoids Autumn SSR fetch errors caused by relative `/api/autumn/*` URLs.
- Keep secrets out of client code and logs.
- For production, mirror required values in your deployment platform + Convex dashboard.
- `GOOGLE_CALENDAR_WEBHOOK_URL` must be externally reachable by Google (localhost URLs will not receive production push notifications).

## Scheduler configuration source

Scheduler behavior is configured from Convex user data, not environment variables:

- `userSettings.timezone`
- `userSettings.timeFormatPreference` (`12h` or `24h`)
- `userSettings.schedulingHorizonDays` (clamped to 4-12 weeks)
- `userSettings.defaultTaskSchedulingMode` (`fastest|balanced|packed`)
