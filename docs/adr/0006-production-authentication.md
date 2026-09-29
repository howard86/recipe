# ADR 0006: Production authentication

## Status

Accepted. Supersedes the sign-in method bullet of [ADR 0004](0004-auth-onboarding-and-sharing.md).

## Context

The MVP enabled email and password everywhere, but there is no email sender: no verification and no password reset. In production that means anyone can register an address they don't own, and a forgotten password is unrecoverable. Better Auth's rate limiting also defaults to in-memory counters, which reset per serverless instance.

## Decision

- **Production is Google-only.** `resolveAuthMode` (`apps/web/lib/auth-mode.ts`) turns email and password off when `NODE_ENV=production`; Google turns on when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. Without them production has no sign-in method and `/sign-in` says so. Google accounts arrive with verified emails.
- **Email and password stay for local work, with verification required.** No session is created until the verification link is used. The dev stand-in sender prints the link to the server console. Sign-in with an unverified address returns `EMAIL_NOT_VERIFIED` and resends the link.
- **Rate limits live in Postgres** (`rateLimit.storage = "database"`, `RateLimit` model). Better Auth's default rules apply: sign-in and sign-up paths 3 per 10 s, verification and reset emails 3 per minute, other endpoints 100 per 10 s. Clients are keyed by `x-forwarded-for`. Vercel overwrites that header to prevent spoofing; a self-hosted deploy must sit behind a proxy that does the same, or the limit can be bypassed by rotating the header.
- **Session cookie cache** (signed, 5 minutes) avoids a database read on every page. A revoked session can stay valid for up to 5 minutes.
- Secure cookies follow the `https` `BETTER_AUTH_URL`; CSRF origin checks stay on (Better Auth defaults).

## Consequences

- Production needs a Google OAuth client with `<BETTER_AUTH_URL>/api/auth/callback/google` as a redirect URI. Vercel preview URLs need their own registered redirect or will not sign in.
- Adding an email provider later means supplying `sendVerificationEmail` and a reset sender, then enabling email and password in production in `resolveAuthMode`.
