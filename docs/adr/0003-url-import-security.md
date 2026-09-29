# ADR 0003: URL import security

## Status

Accepted. Implements "URL import route" in [proposal 0001](../proposals/0001-recipe-sharing-tracking-site.md).

## Context

`POST /api/import` fetches arbitrary user-supplied URLs server-side, which is a server-side request forgery (SSRF) surface, and republishing imported text raises copyright questions.

## Decision

- **Fetch controls** (`apps/web/lib/import/`): http(s) only, no credentials, ports 80/443, URL under 2 KB, IP-literal hosts screened before connecting. DNS is resolved inside the socket connect through the `lookup` option of `node:http`/`node:https`, with `agent: false` so every hop opens a fresh socket through it; if any resolved address is private, loopback, link-local (including 169.254.169.254), unique-local, CGNAT, multicast, reserved, unspecified or NAT64, the connection is refused. The socket connects only to addresses that passed, so there is no second resolution to rebind. Redirects are manual, re-validated per hop, max 3. One 8 s timeout covers the whole fetch; the body streams with a 3 MB cap; the content type must be HTML.
- IPv4-mapped IPv6 is checked as IPv4. `::ffff:0:0/96` must not go in the `BlockList`: `net.BlockList` (Node and Bun) treats it as matching every IPv4 address.
- **Rate limits:** 20 imports per user per hour counted from the `RecipeImport` ledger (every attempt past URL validation is recorded), plus a coarse in-memory 60 per IP per hour per server instance.
- **Duplicates:** a normalised URL (no `www`, tracking params, fragment or trailing slash) that the user already saved returns the existing recipe with an option to import again.
- **Error codes** map to user copy. 401/402 and a login-wall heuristic are `PAYWALLED`; 403, which bot protection usually sends, is `FETCH_FAILED`.
- **Nothing is saved by the import route.** The user reviews the draft in the editor; saving creates a PRIVATE recipe with `sourceUrl`, `sourceName`, the raw JSON-LD and an `EXTERNAL` cover image.
- **Copyright (open question 3):** imports default to private, always show source attribution, and making one public shows a prompt to rewrite the steps in their own words.

## Consequences

- The fetcher uses only `node:http`/`node:https`/`node:dns`, which Bun implements (including `lookup`), so it runs and is tested on Bun. undici is not used: Bun ships a stub for it.
- Cover images are hotlinked until a copy-to-storage step exists.
- The per-IP cap does not coordinate across instances; the per-user ledger does.
