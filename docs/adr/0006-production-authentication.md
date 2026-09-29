# ADR 0006: Production authentication

## Status

Accepted. Supersedes the sign-in method bullet of [ADR 0004](0004-auth-onboarding-and-sharing.md).

## Context

The MVP enabled email and password everywhere, but there is no email sender: no verification and no password reset. In production that means anyone can register an address they don't own, and a forgotten password is unrecoverable. At this stage only the owner edits recipes; everyone else just reads public recipes.

## Decision

- **Production is Google-only.** `resolveAuthMode` (`apps/web/lib/auth-mode.ts`) turns email and password off when `NODE_ENV=production`; Google turns on when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. Without them production has no sign-in method and `/sign-in` says so. Google accounts arrive with verified emails.
- **Email and password stay for local work, with verification required.** No session is created until the verification link is used. The dev stand-in sender prints the link to the server console. Sign-in with an unverified address returns `EMAIL_NOT_VERIFIED` and resends the link.
- **Sign-in is limited to `AUTH_ALLOWED_EMAILS`** (comma-separated, case-insensitive). Better Auth database hooks check it before a user is created and before every session is created, so a new account outside the list is never stored and removing an address locks out an existing account. Production fails closed: an empty list admits nobody. Outside production an empty list admits anyone. OAuth refusals redirect to `/sign-in?error=…`, which explains that sign-in is limited.
- **No rate limiting at this stage** (`rateLimit.enabled = false`, and none on `/api/import`). With the allowlist, only the owner can reach authenticated endpoints. If sign-in opens to other accounts, re-enable Better Auth's limiter with `storage: "database"` (in-memory counters reset per serverless instance) and restore an import limit. Better Auth keys clients by `x-forwarded-for`, which Vercel overwrites to prevent spoofing; self-hosting needs a proxy that does the same.
- **Session cookie cache** (signed, 5 minutes) avoids a database read on every page. A revoked session can stay valid for up to 5 minutes.
- Secure cookies follow the `https` `BETTER_AUTH_URL`; CSRF origin checks stay on (Better Auth defaults).

## Consequences

- Production needs `AUTH_ALLOWED_EMAILS` set to the owner's Google address, and a Google OAuth client with `<BETTER_AUTH_URL>/api/auth/callback/google` as a redirect URI. Vercel preview URLs need their own registered redirect or will not sign in.
- Adding an email provider later means supplying `sendVerificationEmail` and a reset sender, then enabling email and password in production in `resolveAuthMode`.
