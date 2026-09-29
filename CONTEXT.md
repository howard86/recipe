# Project Context

## Product

This repository is a template. Generated projects should replace this section with their product goals, users, and constraints.

## Architecture

Maison-style full-stack TypeScript monorepo:

- Bun is the package manager and runtime for scripts.
- Turborepo coordinates workspace tasks.
- Next.js powers `apps/web`.
- Prisma/Postgres lives in `packages/database`. Prisma is pinned to exact 7.x versions: npm's `latest` tag for `prisma` points at an 8.0 release candidate that renames the CLI (`migrate` → `migration`) and drops `generate`, which breaks `db:migrate:*`, `db:seed`, and the `typecheck` task that depends on `generate`.
- Shared data/config lives in `packages/data`.
- Shared TypeScript compiler settings live in `packages/config-typescript`.

## Current conventions

- Tailwind CSS v4 is the default styling layer (utility classes, CSS-first config); brand tokens live in `apps/web/app/globals.css` `@theme`. Dark mode is OS-driven via `prefers-color-scheme`.
- Ultracite/Biome for linting and formatting (class sorting enforced via `useSortedClasses`).
- Commitlint with Conventional Commits.
- Husky local gates for commit, commit message, and push checks.
- Gitleaks and Typos in local hooks and CI.
- GitHub Issues and PRs carry repo continuation state.

## Non-goals

- Product-specific models, UI, copy, integrations, or payment flows.
- Mandatory CI builds; Vercel previews can own build validation unless the generated repo opts in.
