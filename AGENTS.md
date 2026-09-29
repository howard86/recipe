# Agent Instructions

## Operating rules

- Inspect existing code, configs, and docs before proposing or editing changes.
- Keep changes scoped to the current issue or explicit user request.
- Prefer one issue per branch/PR.
- Make atomic Conventional Commits.
- Run relevant checks before reporting completion.
- Update `CONTEXT.md` and ADRs when architecture or repo conventions change.
- Use `Closes #NN` only when the PR fully satisfies the issue; otherwise use `Refs #NN`.
- For stacked work, clearly document `Stacked on`, `Base branch`, and dependency notes in the PR.

## Repo shape

This is a Maison-style Bun/Turborepo full-stack workspace:

- `apps/web` — Next.js app. Default styling is Tailwind CSS v4 utility classes; brand tokens live in `app/globals.css` `@theme`.
- `apps/cli` — Bun CLI/scripts package.
- `packages/data` — shared static/domain data.
- `packages/database` — Prisma/Postgres client, schema, migrations, and seed.
- `packages/config-typescript` — shared TypeScript configs.

## Quality gates

Use these commands before handoff unless the task is docs-only and the narrower check is justified:

```sh
bun run check
bun run typecheck
```

Use database commands only with a configured local or remote `DATABASE_URL`/`DIRECT_URL`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
