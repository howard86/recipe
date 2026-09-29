# Project Context

## Product

Recipe Box: signed-in people save recipes (typed in, or imported from a URL and reviewed before saving), cook from them on a phone, and track what they made. Design and phasing: [proposal 0001](docs/proposals/0001-recipe-sharing-tracking-site.md).

- Recipes are private by default; owners can make them unlisted (link only, `noindex`) or public (browse, search, JSON-LD).
- Tracking is personal: favourites, a dated cook log with 1 to 5 stars and notes, and one private note per recipe.
- Anonymous visitors can read public and unlisted recipes and use cook mode; saving or logging goes through sign-in and replays the action.
- Out of scope for now: meal planning, shopping lists, unit conversion, nutrition calculation, photo/OCR/AI import, social features, collections, public profiles, image uploads.
- Decisions: [ADR 0002](docs/adr/0002-recipe-data-model-and-search.md) data model and search, [ADR 0003](docs/adr/0003-url-import-security.md) URL import security, [ADR 0004](docs/adr/0004-auth-onboarding-and-sharing.md) auth and sharing.

## Architecture

Maison-style full-stack TypeScript monorepo:

- Bun is the package manager and the only runtime: scripts, tests, CLIs (`bun --bun next|prisma|tsc`), the Next.js server locally and on Vercel (`bunVersion` in `apps/web/vercel.json`). See [ADR 0005](docs/adr/0005-bun-runtime-everywhere.md).
- Turborepo coordinates workspace tasks.
- Next.js powers `apps/web`.
- Prisma/Postgres lives in `packages/database`, which also exports the query modules (`recipes`, `search`, `tracking`, `profiles`, `imports`) the app calls; apps never write raw SQL. Schema changes go through migrations (`db:migrate:deploy`), not `db push`, because search depends on hand-written SQL. Prisma is pinned to exact 7.x versions: npm's `latest` tag for `prisma` points at an 8.0 release candidate that renames the CLI (`migrate` → `migration`) and drops `generate`, which breaks `db:migrate:*`, `db:seed`, and the `typecheck` task that depends on `generate`.
- Shared data/config lives in `packages/data`: zod input schemas, ingredient parsing and scaling, schema.org JSON-LD import/export (subpath exports under `@workspace-template/data/recipe/*`; barrel files are disallowed).
- Shared TypeScript compiler settings live in `packages/config-typescript`.

## Current conventions

- Tailwind CSS v4 is the default styling layer (utility classes, CSS-first config), with shadcn/ui (base-ui primitives, "Berry Rhea" preset: rhea / mauve / rose, DM Sans + Instrument Serif, phosphor icons) in the monorepo layout: `packages/ui` owns the shared Tailwind entry, tokens and vendored components; `apps/web` imports `@workspace-template/ui/globals.css` and re-exports its PostCSS config. Dark mode is class-based via next-themes, defaulting to the OS scheme.
- Ultracite/Biome for linting and formatting (class sorting enforced via `useSortedClasses`).
- Tests: `bun run test` (turbo) runs `bun test` per package.
- Commitlint with Conventional Commits.
- Husky local gates for commit, commit message, and push checks.
- Gitleaks and Typos in local hooks and CI.
- GitHub Issues and PRs carry repo continuation state.

## Non-goals

- Payment flows and paid tiers.
- Mandatory CI builds; Vercel previews can own build validation unless the generated repo opts in.
