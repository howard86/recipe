# workspace-template

Maison-style full-stack Turborepo template for Howard agent projects.

## Stack

- Bun workspace + Turborepo
- Next.js app in `apps/web`
- Tailwind CSS v4 as the default styling layer (CSS-first config; brand tokens in `apps/web/app/globals.css`)
- Bun CLI starter in `apps/cli`
- Shared data package in `packages/data`
- Prisma/Postgres package in `packages/database`
- Shared TypeScript configs in `packages/config-typescript`
- Ultracite/Biome, Husky, Commitlint, Gitleaks, Typos, Dependabot, GitHub Actions CI

## Setup

```sh
brew install bun gitleaks typos-cli
bun install
cp .env.sample .env.local
docker compose up -d db
bun run generate
bun run db:push
bun run dev
```

## Common scripts

```sh
bun run check       # Ultracite lint/check
bun run fix         # Ultracite autofix
bun run typecheck   # Turbo typecheck across workspaces
bun run build       # Turbo build
bun run generate    # Prisma generate
bun run db:push     # Push Prisma schema to local DB
bun run db:seed     # Seed local DB
bun run dev         # Run persistent dev tasks
```

## Quality gates

| Gate | Runs | Bypass |
|---|---|---|
| `pre-commit` | lint-staged Ultracite fixes, staged Gitleaks scan | `git commit --no-verify` |
| `commit-msg` | Commitlint Conventional Commits | `git commit --no-verify` |
| `pre-push` | Ultracite check, Turbo typecheck, Typos, Gitleaks history scan | `git push --no-verify` |
| CI | Ultracite check, typecheck, Typos, Gitleaks, actionlint | Required for merge |

Build is intentionally not in CI by default; Vercel previews should own app build validation unless a generated project decides otherwise.

## Agent workflow

Read `AGENTS.md` before editing. Keep work issue-scoped, inspect code first, make atomic conventional commits, run checks, and document stack/base notes for dependent PRs.

## Customizing a generated repo

1. Replace `workspace-template` and `@workspace-template/*` package names with the project namespace.
2. Update `CONTEXT.md` with product-specific goals and non-goals.
3. Replace the starter homepage and seed data.
4. Retune brand tokens in `apps/web/app/globals.css` (`@theme`) and swap the font in `apps/web/app/layout.tsx`.
5. Add product models to `packages/database/prisma/schema.prisma`.
6. Keep quality gates intact unless the repo explicitly chooses different gates.
