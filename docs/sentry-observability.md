# Sentry observability

## Setup

The Next.js SDK initializes in the browser, Node.js and Edge runtimes. Supabase
clients are instrumented in each existing factory. Session Replay, user
identification, request data, query filters and mutation bodies are disabled or
removed before an event is sent. Expected Supabase 4xx failures are filtered;
5xx failures remain reportable.

Sentry source maps are uploaded during builds when the upload credentials are
present, then deleted from the build output. Do not commit any Sentry secrets.

## Vercel variables

Configure these values for Preview first, then Production after the release is
approved:

| Variable | Scope | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Preview and Production | Project DSN from Sentry; public ingest DSN only |
| `SENTRY_DSN` | Preview and Production | Same project DSN; server-side fallback |
| `SENTRY_ORG` | Preview and Production | Sentry organization slug |
| `SENTRY_PROJECT` | Preview and Production | Sentry project slug for the Next.js app |
| `SENTRY_AUTH_TOKEN` | Preview and Production build environment | Sentry token with project/release and source-map upload permissions; secret |
| `SENTRY_ENVIRONMENT` | Optional | Override; otherwise `VERCEL_ENV` supplies `preview` or `production` and is baked into the browser bundle |
| `SENTRY_RELEASE` | Optional | Explicit release name; otherwise Vercel commit SHA is used server-side |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Optional | Normally derived from `SENTRY_RELEASE` or Vercel's commit SHA at build time |

For local `.env.local`, set only the DSN values if you want to send development
events. Keep `SENTRY_AUTH_TOKEN` out of local committed files and never expose it
with a `NEXT_PUBLIC_` prefix. No Supabase settings are changed.

## Preview verification

1. Add Preview variables in Vercel and deploy a Preview build after review.
2. In the Preview browser console, run `setTimeout(() => { throw new Error('sentry-preview-browser-check') }, 0)` to raise an uncaught browser error.
3. Trigger a controlled server error in a non-production test route or test
   harness. Confirm it appears in Sentry with environment `preview` and readable
   stack frames.
4. Run a controlled Supabase 5xx failure in the test harness; confirm a Sentry
   event appears. A simulated invalid-credentials 401 should not create an issue.
5. Inspect the captured events: there should be no user identity, request URL,
   cookies, headers, query strings, exception text, message contents or database
   mutation data. Confirm no Replay is recorded.
6. Smoke test login/logout and session refresh, Athlete / Coach / Admin routes,
   PWA install/offline fallback, service worker updates and authenticated API
   caching on desktop and mobile.

Do not add a permanent public route that deliberately throws. Prefer an
authorized test route behind a Preview-only guard or a local test harness.

## Initial alert thresholds

Tune these after the first two weeks of Preview/Production traffic:

| Priority | Initial condition | Notification |
| --- | --- | --- |
| P0 | New issue affecting at least 20 users in 5 minutes, or error rate above 5% for 5 minutes on login or core app routes | Immediate, on-call channel |
| P1 | New issue affecting at least 5 users in 30 minutes, or sustained 5xx rate above 1% for 15 minutes | Immediate team notification |
| P2 | Any new issue with at least 10 events in 24 hours, or recurring issue with a rising 7-day trend | Daily digest / business hours |

Exclude Preview and known expected auth/validation failures from production
alerts. Alert on error count and affected users together to avoid paging for a
single isolated client failure.

## Remaining operational steps

The repository integration alone does not activate a Sentry project or Vercel
Preview. Project DSN/slug/token configuration and an approved Preview deployment
are still required. Production release remains subject to explicit approval.
The installed SDK requires Node.js 20.19+ or 22.12+; confirm the Vercel project
runtime meets this before its first Preview deployment.
