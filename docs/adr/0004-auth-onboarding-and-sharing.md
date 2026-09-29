# ADR 0004: Auth, onboarding and sharing

## Status

Accepted. Resolves open questions 1, 2, 4, 5 and 8 of [proposal 0001](../proposals/0001-recipe-sharing-tracking-site.md) for the MVP.

## Decision

- **Better Auth** with the Prisma adapter over the existing auth models; `nextCookies()` stays last in the plugin list. Sign-in methods and production hardening: see [ADR 0006](0006-production-authentication.md) (Google-only in production, verified email and password outside it).
- **Sign-in first (option A).** Anonymous visitors can read public and unlisted recipes and use cook mode. Save and "I cooked this" send them to `/sign-in?next=<recipe>?intent=save|cooked`; the detail page replays the intent on return. Anonymous users (option B) are not implemented.
- **Authorisation lives in pages, actions and route handlers.** Each one calls the session helper itself. `proxy.ts` only does an optimistic cookie-presence redirect for `/me` and `/recipes/new`.
- **Profiles:** a user-create hook makes a `Profile` with a generated handle; `/me` prompts for a real one until it is picked or kept. Public profile pages (`/u/[handle]`) are not built yet, so handles render as text.
- **Visibility:** recipes are PRIVATE by default. UNLISTED is link-only with `noindex`; PUBLIC is listed, searchable and emits JSON-LD. PRIVATE recipes 404 for non-owners. `publishedAt` is set the first time a recipe becomes public.
- **Ratings and cook logs stay personal** (questions 4 and 5): no public aggregate rating, no public cook logs.
- **Hosting (question 8):** Vercel is assumed from `vercel.json`; nothing in the MVP depends on Vercel Blob yet.
- **Caching:** `cacheComponents` stays off; every page is per-viewer and dynamic.

## Consequences

- Revisit anonymous-first onboarding, public profiles, collections and image uploads in the proposal's v1 phase.
