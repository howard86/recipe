# ADR 0002: Recipe data model and search

## Status

Accepted. Implements the "Data model" section of [proposal 0001](../proposals/0001-recipe-sharing-tracking-site.md).

## Context

Recipes arrive typed by hand or imported from arbitrary sites. Imports must round-trip schema.org `Recipe` JSON-LD, ingredient parsers are imperfect, and search has to cover title, description and ingredients with typo tolerance.

## Decision

- **schema.org `Recipe` is the contract.** `packages/data/src/recipe/jsonld.ts` normalises imported JSON-LD and serialises stored recipes back (`HowToStep`/`HowToSection`, ISO 8601 durations). Durations are stored as integer minutes; total time is the explicit value or prep + cook.
- **Lossless ingredients.** Every `IngredientLine` keeps `raw`. Quantity, range, unit, name and note are optional extras from `parseIngredient`, re-derived from `raw` on every save, so a bad parse never loses text.
- **Sections are a nullable column** on lines and steps; consecutive equal values form a group. No section table.
- **One `Tag` table with a `kind`** (`GENERAL`, `CUISINE`, `COURSE`, `DIET`) instead of overlapping organisers. Tag slugs are global.
- **Slugs** are `kebab(title)-<6 chars>`, globally unique and stable across renames.
- **Full-text search** uses a stored generated `tsvector` (title A, description B, `ingredientsText` C) with a GIN index, plus a `pg_trgm` GIN index on title for a similarity fallback when full-text finds nothing. `ingredientsText` is a denormalised copy rewritten with the ingredients. The `'english'` config is assumed.
- **Migrations, not `db push`.** The generated column, indexes, `pg_trgm` and the cook-log rating CHECK live in hand-edited SQL in the `recipes` migration. The schema declares `searchVector` as `Unsupported("tsvector")? @default(dbgenerated())` and declares both GIN indexes, so `prisma migrate diff` reports no drift.
- **Search SQL** is composed with a small branded fragment builder (`packages/database/src/sql.ts`) and run through `$queryRawUnsafe` with bind parameters. Nested `Prisma.sql` fragments rely on `instanceof`, which failed inside the Next.js bundle and bound fragments as text.
- **The generator stays `prisma-client-js`** for now (open question 6). Migrating to `prisma-client` changes import paths and is a separate change.

## Consequences

- Search reads only through `searchRecipes`; the generated client never sees `searchVector`.
- Editing ingredients rewrites all child rows and positions in one transaction.
- Multilingual recipes would need a `simple` config or per-recipe language.
- Collections, images beyond hotlinked `EXTERNAL` covers, and soft delete are not implemented.
