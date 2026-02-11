# Environment Variables

Single source of truth for environment variables used by `auto-cron`.

## Root `.env`

Copy from `.env.example` and set values:

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex URL used by the web client | Yes |
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

## Notes

- `NEXT_PUBLIC_*` variables are exposed to browser bundles.
- `NEXT_PUBLIC_AUTUMN_BACKEND_URL` avoids Autumn SSR fetch errors caused by relative `/api/autumn/*` URLs.
- Keep secrets out of client code and logs.
- For production, mirror required values in your deployment platform + Convex dashboard.
