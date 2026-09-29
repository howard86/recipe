# ADR 0001: Maison-style full-stack workspace template

## Status

Accepted

## Context

Howard's agent projects benefit from consistent CI, dev tools, repo shape, and agent instructions. The `maison` repository provides a proven baseline for Bun, Turborepo, Next.js, Prisma/Postgres, and quality gates.

## Decision

This template mirrors Maison's setup while removing Maison-specific product code. Generated repos start with a full-stack app posture and can delete unneeded packages later.

## Consequences

- New projects get strong defaults for agents and CI.
- The template is opinionated and heavier than a library-only starter.
- Product-specific generated repos must rename package namespaces and replace starter context/UI/schema details.
