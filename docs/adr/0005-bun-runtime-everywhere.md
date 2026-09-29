# ADR 0005: Bun runtime everywhere

## Status

Accepted.

## Context

Bun was already the package manager, but most processes still ran on Node: every CLI bin (`next`, `prisma`, `tsc`, `commitlint`, `lint-staged`, `ultracite`) has a `#!/usr/bin/env node` shebang, the seed ran through `tsx`, the import fetcher depended on undici (which Bun stubs), so its tests needed `tsx --test`, and Vercel ran functions on Node.

## Decision

- **Root scripts:** `bunfig.toml` sets `[run] bun = true`, so `node` and node shebangs resolve to Bun for scripts run from the repo root (`check`, `fix`, turbo entry points).
- **Package scripts:** Bun reads `bunfig.toml` from the working directory only, and turbo runs tasks inside each package, so package scripts prefix JS CLIs explicitly: `bun --bun next dev|build|start|typegen`, `bun --bun prisma …`, `bun --bun tsc`. TypeScript files run directly: `bun src/seed.ts`, `bun test`.
- **Git hooks:** `bun x --bun commitlint`, `bun x --bun lint-staged`.
- **Deploy:** `apps/web/vercel.json` sets `"bunVersion": "1.4.x"` (Vercel's Bun runtime, beta), matching the local Bun 1.4 and the Bun-run `dev`/`build` scripts Vercel requires for Next.js.
- **Import fetcher** is built on `node:http`/`node:https` with a guarded `lookup` and `agent: false`; Bun honours both, and TLS still verifies the certificate against the hostname. `tsx` and `undici` are removed.

## Consequences

- One runtime to reason about locally, in CI and in production.
- Vercel's Bun runtime is beta; switching back means removing `bunVersion` and the `--bun` prefixes.
- New package scripts that call a JS CLI need the `bun --bun` prefix, or they silently run on Node.
