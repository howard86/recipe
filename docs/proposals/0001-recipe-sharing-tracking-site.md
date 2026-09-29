# Proposal 0001: Recipe sharing and tracking site

## Status

Accepted; the MVP phase is implemented. Decisions are recorded in [ADR 0002](../adr/0002-recipe-data-model-and-search.md) (data model and search), [ADR 0003](../adr/0003-url-import-security.md) (import security) and [ADR 0004](../adr/0004-auth-onboarding-and-sharing.md) (auth, onboarding, sharing, and the open questions resolved for the MVP). The v1 and later phases remain proposals.

## Summary

A web app where signed-in people upload recipes (typed in, or imported from a URL) and track their own cooking (favourites, an "I cooked this" log with date, rating and notes, private per-recipe notes). Recipes are private by default and can be made unlisted or public, so sharing is opt-in. Public recipes are browsable and searchable by anyone, including anonymous visitors.

Key choices:

- **schema.org `Recipe` is the data contract.** The internal model maps 1:1 to it for import (JSON-LD on source pages) and export (JSON-LD on our own recipe pages, which also earns Google recipe rich results).
- **Structured but lossless ingredients.** Every ingredient line keeps its original string; parsed quantity/unit/name are optional extras, so bad parses never lose data.
- **Next.js 16 App Router on the existing template.** Server Components for reads, Server Actions for mutations, one Route Handler for URL import (SSRF-hardened, rate limited), Better Auth sessions checked in every action.
- **Postgres full-text search** via a generated `tsvector` column plus `pg_trgm`, managed with raw SQL in Prisma migrations.
- **Scope is sharing + tracking.** Meal planning, shopping lists, unit conversion, OCR and nutrition are explicitly parked.

## Product goals and non-goals

Goals:

1. Get a recipe in fast: paste a URL and confirm, or type it with ingredient and step editors that do not fight the user.
2. Cook from it comfortably on a phone: large type, step focus, ingredient checklist, screen stays awake, servings scaling.
3. Remember what happened: favourites, a dated cook log with a 1 to 5 rating and notes, and private notes that show up next time.
4. Share on purpose: per-recipe visibility (private, unlisted link, public), public profile pages, remix (fork) someone else's recipe with attribution.
5. Find things again: search own and public recipes by text, tag, cuisine, and time.

Non-goals (this proposal):

- Meal planning, shopping lists, pantry, grocery delivery.
- Unit conversion (metric/imperial) and nutrition calculation.
- Photo/OCR/AI import. The data model leaves room for it.
- Social feed, follows, comments, public reviews. Ratings stay attached to personal cook logs; a public average is an open question.
- Native apps. The site should be installable later but a PWA is not in scope.

## Competitive and design exploration

| Product | Upload / import | Tracking | Discovery and cooking | Takeaway |
| --- | --- | --- | --- | --- |
| **Paprika 3** (paid per platform) | Built-in web browser: browse any site and "download" a recipe in one tap [paprika] | Meal plans, grocery list consolidated by aisle, pantry [paprika] | Scaling; "keeps your screen on" while a recipe is open; cross off ingredients, tap to highlight the current step [paprika] | The cooking view details (checklist, step highlight, wake lock) are the bar to meet. Siloed per-platform purchase and no sharing are the gap. |
| **Mealie** (self-hosted, FastAPI + Vue/Nuxt, AGPL-3.0) | URL scraper "from hundreds of websites"; AI import from URL, images or text; manual editor; bookmarklet [mealie-features] [mealie-readme] [mealie-intro] | Meal planner with random-fill rules, shopping lists linked to recipes [mealie-features]. Ratings, favourites and a "last made" timeline exist in the app but were not confirmed in docs (unverified). | Categories, tags, tools, and "Cookbooks" that are saved filters over them [mealie-features] | Saved-filter collections are a cheap, powerful idea. Three overlapping organisers (category vs tag vs tool) confuse; we use one `Tag` table with a `kind`. |
| **Tandoor Recipes** (self-hosted, AGPL-3.0) | Import from websites with structured data; 24+ file formats (Paprika, Mealie, Cooklang, MealMaster, etc.); AI image recognition [tandoor-readme] [tandoor-import] | Meal plans, shopping lists from plans or recipes [tandoor-readme] | Full-text plus trigram similarity search, scaling, multi-step recipes, fraction/decimal display, cookbooks, sharing with a basic permission system [tandoor-readme] | Validates Postgres FTS + `pg_trgm` for recipe search. Broad importer support is a moat for self-hosters; not needed for an MVP. |
| **NYT Cooking** (subscription) | Editorial only; users save, they do not upload | Recipe Box, "mark as cooked", ratings, public and private notes [nyt-app] | 20,000+ recipes filterable by diet, cuisine and meal type; curated collections; Cook Mode; grocery list [nyt-app] | Closest model for tracking UX: mark-as-cooked plus private notes on a saved recipe. Community notes are valuable but need moderation; parked. |
| **Allrecipes** | Community submissions (submission flow not verified; site blocked automated fetch) | Ratings and reviews; "I Made It" photos with short notes from cooks (secondary source) [allrecipes-2nd] | Large catalogue, search, reviews | "I Made It" is effectively a public cook log with photo. Our `CookLog` with optional image supports that later without schema change. |
| **Samsung Food** (formerly Whisk; free + Food+ tier) | Save from the web or create from scratch; the app "standardizes their format" [samsung-news] | Meal plans, shopping lists built from ingredients, AI "Personalize Recipe" [samsung-news] | 160,000+ recipes, personalisation [samsung-news] | Normalising imported recipes into one format is the core value. AI rewriting is out of scope. |
| **Cooklang** (open markup spec) | Plain-text recipes: `@ingredient{qty%unit}`, `#cookware{}`, `~timer{25%minutes}`, YAML front matter, `= Section` headings, `>` notes [cooklang] | n/a | n/a | Good export target later, and a model for inline ingredient references in steps. Too technical as the primary authoring UI. |

Patterns worth copying:

- **One-tap import with a confirm step** (Paprika, Mealie, Samsung Food). Import is never silent; the user reviews a parsed preview before saving.
- **Cook view as its own mode** (Paprika, NYT): screen stays on, big steps, checkable ingredients.
- **Private notes attached to a saved recipe** (NYT). Notes are keyed by user and recipe, not stored inside the recipe, so they survive the author editing it.
- **Collections as curated lists** (NYT, Tandoor cookbooks). Mealie's saved-filter cookbooks are a later enhancement.

Things to avoid:

- Multiple overlapping taxonomies (Mealie categories vs tags vs tools).
- Import that discards the source string (ingredient parsers are imperfect; keep `raw`).
- Paywalling basic tracking (NYT puts Recipe Box behind a subscription [nyt-app]).

## Data standard: schema.org Recipe and JSON-LD import

### The standard

`Recipe` sits at `Thing > CreativeWork > HowTo > Recipe` [schema-recipe]. Properties used by this app:

| schema.org property | Type | Our field |
| --- | --- | --- |
| `name` | Text | `Recipe.title` |
| `description` | Text | `Recipe.description` |
| `image` | URL or `ImageObject` (one or many) | `Recipe.coverImage` (+ step images) |
| `author` | `Person` or `Organization` | `Recipe.author` (user) or `sourceName` for imports |
| `datePublished` | Date | `Recipe.publishedAt` |
| `prepTime`, `cookTime`, `totalTime` | Duration, ISO 8601 (`PT1H30M`) | `prepMinutes`, `cookMinutes`, `totalMinutes` |
| `recipeYield` | `QuantitativeValue` or Text | `yieldText` + numeric `servings` |
| `recipeCategory` | Text (appetizer, entree) | `Tag` with `kind = COURSE` |
| `recipeCuisine` | Text | `Tag` with `kind = CUISINE` |
| `suitableForDiet` | `RestrictedDiet` | `Tag` with `kind = DIET` |
| `keywords` | Text | `Tag` with `kind = GENERAL` |
| `recipeIngredient` | Text (supersedes `ingredients`) | `IngredientLine[]` (`raw` is the Text) |
| `recipeInstructions` | Text, `ItemList`, or `CreativeWork` (`HowToStep` / `HowToSection`) | `InstructionStep[]` with optional `section` |
| `nutrition` | `NutritionInformation` | `Recipe.nutrition` JSON (stored, not computed) |
| `aggregateRating` | `AggregateRating` | Derived from cook logs (open question) |
| `video` | `VideoObject` | Not stored in MVP |

Sources: [schema-recipe], [google-recipe].

Durations are stored as integer minutes and serialised to ISO 8601 on export. Minutes are what the UI filters on ("under 30 min"), and parsing ISO strings in SQL is awkward.

### Google Recipe rich results

Required: `name`, `image`. Recommended: `aggregateRating`, `author`, `cookTime`, `datePublished`, `description`, `keywords`, `nutrition.calories`, `prepTime`, `recipeCategory`, `recipeCuisine`, `recipeIngredient`, `recipeInstructions`, `recipeYield`, `totalTime`, `video` [google-recipe]. Instructions should be `HowToStep` (optionally grouped in `HowToSection`) and must not include labels such as "Step 1" or "Directions" [google-recipe]. Images should be at least 50K pixels (width x height), in 16x9, 4x3 and 1x1 ratios [google-recipe].

Implication: public recipe pages render a `<script type="application/ld+json">` built from the database, emit `HowToStep`/`HowToSection`, and the image pipeline should produce the three crops. Recipes without an image still render JSON-LD but will not be rich-result eligible. Typed with `schema-dts` (Google's TypeScript types for schema.org JSON-LD) [schema-dts].

### How import works in practice

Mealie and Tandoor both build on the Python `recipe-scrapers` library (MIT), which parses supplied HTML via site-specific scrapers, schema.org markup (JSON-LD, Microdata, RDFa) and OpenGraph fallback, and leaves the network request to the caller [py-recipe-scrapers]. (That Mealie and Tandoor use it is from their dependency manifests as commonly known; unverified in this pass.)

JS/TS options:

| Library | Notes |
| --- | --- |
| `recipe-scrapers` (TS, `github.com/recipe-scrapers/recipe-scrapers`) | Port of the Python library; schema.org, OpenGraph and site-specific extraction; cheerio + zod; optional `parse-ingredient`; MIT; only parses supplied HTML. Young: 7 stars at time of reading [ts-recipe-scrapers]. |
| `recipe-data-scraper` | JSON-LD and Microdata; fetches for you (which conflicts with our SSRF-controlled fetch) [recipe-data-scraper]. |
| `html-recipe-parser` | JSON-LD only, TypeScript [html-recipe-parser]. |
| Hand-rolled extractor | About 150 lines: find `script[type="application/ld+json"]`, `JSON.parse`, walk for `@type` including `Recipe`, normalise. |

Recommendation: own the fetch (see Architecture) and a small hand-rolled JSON-LD normaliser behind an `extractRecipe(html, url)` interface; evaluate the TS `recipe-scrapers` port as a drop-in for Microdata and site-specific fallbacks once it matures. JSON-LD covers most sites because Google's rich results push publishers to it [google-recipe].

Normalisation pitfalls the extractor must handle (from the spec's permitted types plus common publisher output):

- **`@graph` wrappers and multiple script tags.** Search every block, recurse into `@graph` arrays.
- **`@type` as an array**, e.g. `["Recipe", "NewsArticle"]`. Match by inclusion.
- **Single value vs array** for nearly everything (`image`, `author`, `recipeYield`, `recipeCategory`, `keywords`). Coerce with `toArray()`.
- **`keywords` as a comma-separated string** rather than an array.
- **`image`** as a URL string, an array of strings, an `ImageObject` (`url` or `contentUrl`), or an array of those. Pick the largest by declared width, else the first.
- **`recipeInstructions`** as one string (split on newlines), an array of strings, `HowToStep[]`, or `HowToSection[]` each with `itemListElement` of steps. Flatten to ordered steps, carrying the section `name`. Strip "Step 1:" prefixes.
- **`recipeYield`** as `"4"`, `"4 servings"`, `["4", "4 servings"]`, or a number. Keep the longest string as `yieldText`, extract the first integer as `servings`.
- **Durations** that are invalid or zero-padded (`PT0M`, `P0DT1H`, `PT90M`). Parse leniently; treat zero as unknown.
- **HTML entities and tags** inside text fields. Decode and strip.
- **Ingredient strings need parsing** (`"1 1/2 cups (190g) flour, sifted"`). Store the string as `raw`, attempt a parse (`parse-ingredient` or similar) into quantity, unit, name, note, and show the parse in the preview so the user can fix it.
- **Author** as a string, `Person`, `Organization`, or an array. Store as `sourceName` on imports; the uploader is always the owning user.

## Core UX flows

### Route map

`typedRoutes: true` is already on in `next.config.ts`, so these become typed `Link` targets. "RSC" means Server Component; "client island" names the interactive child.

| Route | Rendering | Auth | Purpose |
| --- | --- | --- | --- |
| `/` | RSC | public | Landing: recent public recipes, search box, "Add a recipe" CTA |
| `/recipes` | RSC, reads `searchParams` | public | Browse and search public recipes (`?q=&tag=&cuisine=&maxTime=&sort=`) |
| `/recipes/new` | RSC shell + client form | signed in | Choose "Paste a URL" or "Write it"; the editor |
| `/recipes/new/import` | RSC shell + client | signed in | URL import preview and confirm |
| `/recipes/[slug]` | RSC + client islands (save button, servings stepper, cooked dialog, notes) | public if PUBLIC/UNLISTED, owner if PRIVATE | Detail page with JSON-LD |
| `/recipes/[slug]/edit` | RSC shell + client form | owner | Same editor as new |
| `/recipes/[slug]/cook` | Client component (data passed from RSC parent) | same as detail | Cook mode |
| `/me` | RSC | signed in | My recipes (all visibilities), favourites, recent cooks |
| `/me/cooked` | RSC | signed in | Cook log timeline, filter by recipe or month |
| `/me/collections`, `/me/collections/[slug]` | RSC + client reorder | signed in | Collections (v1) |
| `/u/[handle]` | RSC | public | Public profile: public recipes and public collections (v1) |
| `/sign-in` | RSC + client form | public | Better Auth sign-in, also the anonymous upgrade target |
| `/api/auth/[...all]` | Route Handler | n/a | Better Auth `toNextJsHandler(auth)` [better-auth-next] |
| `/api/import` | Route Handler (POST) | signed in | Fetch URL server-side, extract, return a draft |
| `/api/uploads` | Route Handler (POST) | signed in | Image upload token exchange (v1) [vercel-blob-client] |

A separate `/search` page is not needed: `/recipes` with query params is the search page, and `/me` gets a scoped search box that adds `?mine=1`.

Mutations are Server Actions colocated with the feature (`app/recipes/actions.ts` etc.): `createRecipe`, `updateRecipe`, `deleteRecipe`, `setVisibility`, `forkRecipe`, `toggleFavorite`, `logCook`, `updateCookLog`, `deleteCookLog`, `saveRecipeNote`, collection CRUD. Every action calls `auth.api.getSession({ headers: await headers() })` and checks ownership itself, because Next.js warns that Server Functions are POSTs to the page route and a Proxy matcher change can silently drop coverage [next-proxy] [better-auth-next]. Route Handlers are used only where a non-form client needs an HTTP endpoint: auth, import (future bookmarklet/extension can call it), and upload token exchange.

### Flow 1: Onboarding (anonymous browse, sign in, upgrade)

1. **Visitor lands on `/` or a shared `/recipes/[slug]`.** No session. Everything public is readable; cook mode works (checklist state is local only).
2. **Visitor taps Save, "I cooked this", or "Add a recipe".** Two options, decided in Open questions:
   - A (simpler, recommended for MVP): redirect to `/sign-in?next=<current>`; after sign-in, the pending action is replayed from the `next` URL plus an `intent` param.
   - B: create a Better Auth anonymous user on first write (`isAnonymous = true`, already in the schema), let them save and log immediately, and later link a real account. Better Auth's anonymous plugin calls `onLinkAccount({ anonymousUser, newUser })` so we can move favourites, logs, notes and recipes to the new user; by default the anonymous user is deleted after linking [better-auth-anon].
3. **`/sign-in`** states: idle, submitting, error (bad credentials, rate-limited), magic-link-sent (if email links are chosen). On success, redirect to `next`.
4. **First sign-in** creates a `Profile` with a generated handle; a dismissible banner on `/me` asks them to pick a handle before anything is made public.

### Flow 2: Upload a recipe

Entry `/recipes/new` shows two cards: "Paste a link" and "Write it myself".

**2a. URL import**

1. **Paste URL** (`/recipes/new/import`). States: empty, invalid URL (client-side check), submitting (spinner with the domain shown), error, rate-limited ("Try again in N minutes").
2. `POST /api/import` fetches and extracts (see Architecture). Error codes map to copy: `NOT_FOUND`, `BLOCKED_HOST`, `TOO_LARGE`, `TIMEOUT`, `NO_RECIPE_FOUND` ("We couldn't find a recipe on that page. Write it yourself?" pre-fills `sourceUrl`), `PAYWALLED` (heuristic: page has no Recipe JSON-LD and a login form).
3. **Preview/confirm.** The same editor as manual entry, pre-filled, with an "Imported from example.com" chip. Ingredient rows whose parse is low-confidence are highlighted. The source image is shown but not yet copied.
4. **Save** calls `createRecipe` with `sourceType = URL_IMPORT`, `sourceUrl`, `sourceName`, `visibility = PRIVATE`, and the raw JSON-LD in `importedJsonLd` for re-parsing later. Redirect to the detail page with a toast "Saved privately. Share it?".
5. **Duplicate check**: if the user already imported this normalised URL, step 2 returns their existing recipe and offers "Open it" or "Import again".

Default private for imports matters: republishing someone else's text publicly is a copyright risk (see Open questions).

**2b. Manual editor** (client component, one form, React 19 `useActionState` for pending and field errors)

- **Basics**: title (required), description, servings (number) and yield text, prep and cook minutes (total computed unless overridden), visibility radio.
- **Ingredients editor**: one textarea-like list where each line is a row. Paste of a multi-line block splits into rows. Each row shows the raw text; a small parsed preview (`1.5 cup flour, sifted`) appears under it. Rows can be dragged, deleted, and given a section heading ("For the sauce"). Keyboard: Enter adds a row below, Backspace on empty row deletes it.
- **Steps editor**: same list mechanics, multi-line text per step, optional section heading, optional image per step (v1).
- **Tags**: combobox over existing tags with create-new, grouped by kind (cuisine, course, diet, other).
- **Cover image**: v1.
- States: pristine, dirty (warn on navigate away), saving, field errors (server-validated with zod), saved.

### Flow 3: Recipe detail and cook mode

**Detail `/recipes/[slug]`** (RSC)

- Header: title, author link (`/u/[handle]`) or "Imported from source", times, servings, tags, cover.
- Actions island: Save (heart), "I cooked this", "Cook mode", overflow menu (Edit and visibility for owner; "Remix" for others).
- Servings stepper (client): scales parsed quantities linearly by `servings / recipe.servings`; lines with no parsed quantity show unchanged with a subtle "not scaled" marker. Fractions rendered as vulgar fractions where close (1/2, 1/3, 1/4, 2/3, 3/4). No unit conversion.
- Ingredients grouped by section, steps grouped by section.
- **Your notes** (only for signed-in viewer): private `RecipeNote`, autosaves on blur.
- **Your history**: last cooked date, count, your latest rating, link to all logs.
- Remix banner if `forkedFrom` is set: "Remixed from X by Y".
- JSON-LD script for PUBLIC recipes; `noindex` meta for UNLISTED; 404 for PRIVATE when not owner (not 403, to avoid leaking existence).

**Cook mode `/recipes/[slug]/cook`** (client component; the page RSC loads the recipe and passes a serialisable prop)

1. Full-screen, large type, high contrast; one step at a time with previous/next (buttons, swipe, arrow keys) and a step list drawer.
2. Ingredient checklist panel (tap to cross off), filtered to ingredients mentioned in the current step when a name match is found, else all.
3. Servings carried over from the detail page via `?servings=`.
4. **Screen Wake Lock**: request `navigator.wakeLock.request("screen")` on enter; it auto-releases when the tab is hidden, so re-request on `visibilitychange` when visible; release on exit. Needs a secure context; the API is Baseline 2025 [mdn-wakelock]. Show a small "Screen will stay on" indicator, and a fallback note when unsupported.
5. Checklist and current step persist in `sessionStorage` keyed by recipe id, so a refresh does not lose place.
6. Finish screen: "Log this cook?" opens the cook-log dialog pre-filled with today and the servings used.

### Flow 4: Personal collection and tracking

- **Favourite**: optimistic toggle (`useOptimistic`) calling `toggleFavorite`. Anonymous viewers go through Flow 1.
- **"I cooked this" dialog**: date (default today, can backdate), rating 1 to 5 (optional), notes (optional), servings made (optional), photo (v1). Saving creates a `CookLog`. Multiple logs per recipe are expected.
- **`/me/cooked`**: reverse-chronological timeline grouped by month; each entry shows recipe thumbnail, date, stars, note excerpt; filters by recipe and rating; empty state links to favourites.
- **`/me`**: tabs "My recipes" (with visibility badges), "Saved", "Recently cooked". Each tab is its own RSC segment so it streams independently.
- **Private notes** are per user per recipe (one note, edited in place), and are also shown in cook mode's drawer.
- **Collections (v1)**: named, ordered lists with visibility; "Add to collection" in the detail overflow menu.
- **Remix**: copies the recipe, ingredients, steps and tags into a new PRIVATE recipe owned by the viewer with `forkedFromId` set.

### Flow 5: Discovery and search

- `/recipes` reads `q`, `tag` (repeatable), `cuisine`, `diet`, `maxTime`, `sort` (`relevance`, `newest`, `quickest`) from `searchParams`, and runs one raw SQL query (see Data model) restricted to `visibility = 'PUBLIC'`.
- Text search: `websearch_to_tsquery('english', q)` against the weighted `searchVector` (title A, description B, ingredients C), ranked with `ts_rank`; if it returns nothing, fall back to trigram similarity on title for typo tolerance ("lasgna").
- Filters render as chips from the `Tag` table grouped by kind; counts are optional (costly) and deferred.
- Results as a card grid; pagination by cursor (`publishedAt, id`) for newest, offset for relevance.
- States: initial (popular tags + recent), results, no results (suggest removing a filter), error.

## Visual design directions and recommended tokens

Constraints from the repo: Tailwind v4 CSS-first config in `apps/web/app/globals.css`; brand tokens under `@theme`; `@theme inline` maps `--font-sans` to the `next/font` variable; dark mode follows `prefers-color-scheme` with `color-scheme: light dark`. Tailwind requires theme variables at top level, not inside media queries [tailwind-theme], so dark-mode surfaces are plain CSS variables redefined under `@media (prefers-color-scheme: dark)` and exposed to utilities through `@theme inline`, the pattern Tailwind documents for referencing other variables [tailwind-theme].

All fonts below are on Google Fonts and load through `next/font/google` like the existing Inter setup.

### Direction A: Warm editorial (cookbook)

Paper-toned background, serif display headings, tomato/terracotta accent, olive secondary. Feels like a cookbook; photos carry the page.

- Fonts: **Fraunces** (display, variable, optical sizes) + **Inter** (UI, already loaded).
- Accent: terracotta, hue about 40.

### Direction B: Clean utility (app-like)

Neutral greys, one saturated green accent, dense lists, sans only. Feels like a tool; best for the tracking side.

- Fonts: **Inter** only.
- Accent: herb green, hue about 150.

### Direction C: Playful pantry

Cream background, rounded shapes, saffron and plum, chunky display type.

- Fonts: **Bricolage Grotesque** (display) + **Nunito Sans** (UI).
- Accent: saffron, hue about 80, plum secondary hue about 320.

### Recommendation: C, playful pantry, in the "Berry Rhea" colourway

After reviewing the flow mockups in three colourways, the chosen one is Berry Rhea: white ground, mauve-tinted neutrals, rose as the single accent, DM Sans body with Instrument Serif headings, large radius, and soft card elevation. It keeps direction C's rounded, friendly geometry but trades cream-and-saffron for a cleaner white page that photographs well, with the plum tint moved into the neutrals. It maps directly to a shadcn/ui preset (see below), so adopting shadcn later costs no redesign.

Contrast rules:

- Rose (`brand-600`) is a dark fill with light text and also passes as link text on white (about 5.9:1). One accent does both jobs.
- Neutrals carry a slight mauve tint (hue about 325) so the page reads warm, not clinical. Muted copy stays at or above 4.5:1 on white.
- "Cooked" and other status badges use the muted neutral pair, not a second hue. Stars use amber.
- Instrument Serif ships one weight: headings are `font-weight: 400` at a slightly larger size, never faux-bold.

Proposed replacement for the `@theme` block (values are starting points; verify contrast with a checker before adopting):

```css
@theme inline {
  --font-sans: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-instrument-serif), ui-serif, Georgia, serif;

  --color-surface: var(--surface);
  --color-surface-raised: var(--surface-raised);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-line: var(--line);
}

@theme {
  /* Rose brand (replaces the blue brand-50/500/600/700). Dark fill with light text; also link colour. */
  --color-brand-50: oklch(0.969 0.015 12.422);
  --color-brand-100: oklch(0.941 0.030 12.580);
  --color-brand-200: oklch(0.892 0.058 10.001);
  --color-brand-500: oklch(0.586 0.253 17.585);
  --color-brand-600: oklch(0.514 0.222 16.935);
  --color-brand-700: oklch(0.455 0.188 13.697);

  /* Mauve neutral pair for chips, badges, secondary buttons */
  --color-muted: oklch(0.96 0.003 325.6);
  --color-muted-foreground: oklch(0.542 0.034 322.5);

  /* Rating stars */
  --color-star: oklch(0.769 0.188 70.08);

  --radius-card: 1.125rem;
  --radius-control: 0.875rem;
  --shadow-card: 0 1px 2px oklch(0.145 0.008 326 / 5%), 0 6px 20px oklch(0.145 0.008 326 / 6%);
}

:root {
  color-scheme: light dark;
  --surface: oklch(1 0 0);
  --surface-raised: oklch(1 0 0);
  --ink: oklch(0.145 0.008 326);
  --ink-muted: oklch(0.542 0.034 322.5);
  --line: oklch(0.922 0.005 325.62);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: oklch(0.145 0.008 326);
    --surface-raised: oklch(0.205 0.008 326);
    --ink: oklch(0.985 0 0);
    --ink-muted: oklch(0.72 0.02 325);
    --line: oklch(1 0 0 / 10%);
  }
}
```

The rose and mauve values are the ones shadcn/ui ships for its `rose` theme and `mauve` base colour [shadcn-create]; the radius, shadow and star tokens are project additions.

Earlier colourways, if reverted: cream-and-saffron with plum links (`--surface: oklch(0.975 0.03 85)`, `--color-brand-500: oklch(0.76 0.16 80)` as a light fill with dark text, plum `oklch(0.40 0.11 320)` for links) with Bricolage Grotesque and Nunito Sans; or the warm editorial terracotta scale (`-600: oklch(0.56 0.16 36)`) with Fraunces.

Dark mode notes:

- Rose stays a fill with light text in dark mode; for link text on the dark surface use `brand-200` or `brand-500` (lighter), since `brand-600` drops below 4.5:1 there. Use `dark:` variants in components rather than redefining brand tokens.
- The dark surface is shadcn's mauve dark background, so light and dark share the same tint. Card elevation switches from shadow to a 10 percent white border line.
- Cook mode should default to the OS scheme but offer a forced high-contrast toggle; that would need the class-based `@custom-variant dark` the stylesheet already has commented out. Adopting it is a small, separate change.
- The layout needs two `next/font/google` calls: DM Sans with `variable: "--font-dm-sans"` and Instrument Serif with `variable: "--font-instrument-serif"` (weight 400 only), replacing Inter.

### If the app adopts shadcn/ui

The repo has no component library yet; adopting shadcn/ui is a separate decision. If it does, `npx shadcn create` [shadcn-create] configures a preset from: `style` (nova, vega, maia, lyra, mira, luma, sera, rhea), `baseColor` (neutral, stone, zinc, gray, mauve, olive, mist, taupe), `theme` (17 hues plus the base colours), `font` and `fontHeading` (26 Google fonts), `radius` (none, small 0.45rem, medium 0.625rem, large 0.875rem, default), `iconLibrary` (lucide, hugeicons, tabler, phosphor, remixicon), `menuAccent` (subtle, bold) and `menuColor` (default, inverted, translucent variants). Backgrounds are white in every base colour, so the cream page tint stays a project token. Option names and values were read from the create page's own scripts on 2026-09-29; the preset codes below are generated with its encoder and round-trip decoded, but not opened in a browser (unverified).

Presets closest to the chosen direction:

| Preset | style / baseColor / theme | font + heading / radius / icons | Link |
| --- | --- | --- | --- |
| Pantry | maia / taupe / yellow | Nunito Sans + Outfit / large / phosphor | <https://ui.shadcn.com/create?preset=b305igJTma> |
| Sunny Luma | luma / stone / amber | Figtree + Space Grotesk / large / hugeicons | <https://ui.shadcn.com/create?preset=b6SuZQgip6> |
| Berry Rhea (recommended) | rhea / mauve / rose | DM Sans + Instrument Serif / large / phosphor | <https://ui.shadcn.com/create?preset=b8SYlfc2Su> |
| Citrus Nova | nova / zinc / lime | Manrope + Space Grotesk / medium / tabler | <https://ui.shadcn.com/create?preset=b6V4Z9eqtk> |

`yellow` and `lime` are light fills with dark text (the saffron rule); `amber`, `rose`, `green` and `orange` are dark fills with light text. Bricolage Grotesque is not in the create font list, so Outfit or Space Grotesk stand in for headings; the project can still load Bricolage through `next/font` and set `--font-heading` itself.

## Data model

### Notes before the schema

- **Generator.** The repo uses `provider = "prisma-client-js"` with `output = "../generated/client"`. Prisma 7 docs mark `prisma-client-js` as deprecated in favour of `prisma-client`, which requires `output` [prisma-generators]. Migrating the generator is a separate change (it alters import paths in `packages/database/src/client.ts`); the models below work with either.
- **Driver adapter.** `packages/database/src/client.ts` already constructs `PrismaClient({ adapter: new PrismaPg(...) })` with `@prisma/adapter-pg` 7.10.0 pinned at the root, matching the Prisma 7 usage [prisma-generators]. Datasource URL lives in `prisma.config.ts`, not the schema.
- **`tsvector`.** Declared as `Unsupported("tsvector")?`. Such fields are not available in the generated client, so search runs through `$queryRaw` (or TypedSQL). Keep the field optional so `create()` stays available. GIN indexes, the generated-column expression, `pg_trgm` and CHECK constraints go into a migration created with `prisma migrate dev --create-only` and edited by hand [prisma-unsupported].
- **Why not Prisma's `fullTextSearchPostgres` preview?** It exists [prisma-fts], but it builds the `tsvector` at query time; the docs page does not state that it uses a GIN index (unverified either way). A stored generated column with a GIN index is the approach the Postgres docs show [pg-fts-tables].
- **Ingredients in search.** A generated column cannot read other tables, so `Recipe.ingredientsText` is a denormalised copy of the ingredient names, rewritten in the same transaction as ingredient edits.
- **Drift.** Whether `prisma migrate dev` reports drift for a generated column declared as `Unsupported` is unverified; check with `prisma migrate diff` in the first migration PR.
- **Tables** keep Prisma's default PascalCase names to match the existing Better Auth models.

### Additions to `model User`

Only relation fields are added; existing columns are untouched.

```prisma
  // appended inside model User
  profile       Profile?
  recipes       Recipe[]
  collections   Collection[]
  favorites     Favorite[]
  cookLogs      CookLog[]
  recipeNotes   RecipeNote[]
  images        Image[]
  recipeImports RecipeImport[]
```

### New models (append to `schema.prisma`)

```prisma
enum Visibility {
  PRIVATE
  UNLISTED
  PUBLIC
}

enum RecipeSourceType {
  MANUAL
  URL_IMPORT
  FORK
}

enum TagKind {
  GENERAL
  CUISINE
  COURSE
  DIET
}

enum StorageProvider {
  VERCEL_BLOB
  S3
  EXTERNAL
}

enum ImportStatus {
  SUCCEEDED
  FAILED
}

model Profile {
  userId        String   @id
  handle        String   @unique
  bio           String?
  avatarImageId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  avatarImage   Image?   @relation("ProfileAvatar", fields: [avatarImageId], references: [id], onDelete: SetNull)
}

model Recipe {
  id              String                   @id @default(cuid())
  slug            String                   @unique
  authorId        String
  title           String
  description     String?
  visibility      Visibility               @default(PRIVATE)
  servings        Int?
  yieldText       String?
  prepMinutes     Int?
  cookMinutes     Int?
  totalMinutes    Int?
  sourceType      RecipeSourceType         @default(MANUAL)
  sourceUrl       String?
  sourceName      String?
  forkedFromId    String?
  coverImageId    String?
  nutrition       Json?
  importedJsonLd  Json?
  ingredientsText String                   @default("")
  searchVector    Unsupported("tsvector")?
  publishedAt     DateTime?
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  author      User               @relation(fields: [authorId], references: [id], onDelete: Cascade)
  forkedFrom  Recipe?            @relation("RecipeFork", fields: [forkedFromId], references: [id], onDelete: SetNull)
  forks       Recipe[]           @relation("RecipeFork")
  coverImage  Image?             @relation("RecipeCover", fields: [coverImageId], references: [id], onDelete: SetNull)
  ingredients IngredientLine[]
  steps       InstructionStep[]
  tags        RecipeTag[]
  collections CollectionRecipe[]
  favorites   Favorite[]
  cookLogs    CookLog[]
  notes       RecipeNote[]
  imports     RecipeImport[]

  @@index([authorId, updatedAt])
  @@index([visibility, publishedAt])
  @@index([forkedFromId])
}

model IngredientLine {
  id          String   @id @default(cuid())
  recipeId    String
  position    Int
  section     String?
  raw         String
  quantity    Decimal? @db.Decimal(10, 3)
  quantityMax Decimal? @db.Decimal(10, 3)
  unit        String?
  name        String?
  note        String?
  recipe      Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@index([recipeId, position])
}

model InstructionStep {
  id       String  @id @default(cuid())
  recipeId String
  position Int
  section  String?
  text     String
  imageId  String?
  recipe   Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  image    Image?  @relation("StepImage", fields: [imageId], references: [id], onDelete: SetNull)

  @@index([recipeId, position])
}

model Tag {
  id      String      @id @default(cuid())
  slug    String      @unique
  name    String
  kind    TagKind     @default(GENERAL)
  recipes RecipeTag[]

  @@index([kind, name])
}

model RecipeTag {
  recipeId String
  tagId    String
  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  tag      Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([recipeId, tagId])
  @@index([tagId])
}

model Collection {
  id          String             @id @default(cuid())
  ownerId     String
  slug        String
  name        String
  description String?
  visibility  Visibility         @default(PRIVATE)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  owner       User               @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  recipes     CollectionRecipe[]

  @@unique([ownerId, slug])
}

model CollectionRecipe {
  collectionId String
  recipeId     String
  position     Int
  addedAt      DateTime   @default(now())
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  recipe       Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@id([collectionId, recipeId])
  @@index([recipeId])
}

model Favorite {
  userId    String
  recipeId  String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipe    Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@id([userId, recipeId])
  @@index([recipeId])
}

model CookLog {
  id           String   @id @default(cuid())
  userId       String
  recipeId     String
  cookedAt     DateTime
  rating       Int?
  notes        String?
  servingsMade Int?
  imageId      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipe       Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  image        Image?   @relation("CookLogImage", fields: [imageId], references: [id], onDelete: SetNull)

  @@index([userId, cookedAt])
  @@index([recipeId, userId])
}

model RecipeNote {
  id        String   @id @default(cuid())
  userId    String
  recipeId  String
  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipe    Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([userId, recipeId])
}

model Image {
  id          String            @id @default(cuid())
  ownerId     String
  provider    StorageProvider
  storageKey  String
  url         String
  contentType String?
  byteSize    Int?
  width       Int?
  height      Int?
  alt         String?
  createdAt   DateTime          @default(now())
  owner       User              @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  recipeCover Recipe[]          @relation("RecipeCover")
  stepImages  InstructionStep[] @relation("StepImage")
  cookLogs    CookLog[]         @relation("CookLogImage")
  avatars     Profile[]         @relation("ProfileAvatar")

  @@unique([provider, storageKey])
  @@index([ownerId])
}

model RecipeImport {
  id            String       @id @default(cuid())
  userId        String
  url           String
  normalizedUrl String
  status        ImportStatus
  errorCode     String?
  recipeId      String?
  createdAt     DateTime     @default(now())
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipe        Recipe?      @relation(fields: [recipeId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([userId, normalizedUrl])
}
```

Design notes:

- **Slug** is globally unique: `kebab(title)-<6 char id>` (e.g. `garlic-noodles-k3j9x2`), so `/recipes/[slug]` needs no author prefix and renames do not collide. Keep the old slug working via a redirect table later if renames become common (not in MVP).
- **Ordering** uses `position` with an index, not a unique constraint, because reordering under a `@@unique([recipeId, position])` needs deferred constraints. Editors rewrite all positions for a recipe in one transaction.
- **Sections** are a nullable string on each line/step; consecutive equal values form a group. That is enough to round-trip `HowToSection` without another table.
- **`quantityMax`** supports ranges ("2 to 3 cloves").
- **Cuisine and category are tags** with a `kind`, avoiding Mealie-style overlapping organisers.
- **`Image.provider = EXTERNAL`** lets an import reference the source image URL until it is copied to our storage (v1), without a separate code path.
- **`RecipeImport`** doubles as the rate-limit ledger (count rows per user in the last hour) and the duplicate-import check.
- **Soft delete** is not modelled; delete cascades. Revisit if public recipes that others forked should survive deletion (forks keep working because `forkedFromId` is `SET NULL`).

### Hand-written migration SQL

```sql
-- in the migration created with: prisma migrate dev --create-only
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Recipe" DROP COLUMN IF EXISTS "searchVector";
ALTER TABLE "Recipe" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("ingredientsText", '')), 'C')
  ) STORED;

CREATE INDEX "Recipe_searchVector_idx" ON "Recipe" USING GIN ("searchVector");
CREATE INDEX "Recipe_title_trgm_idx" ON "Recipe" USING GIN ("title" gin_trgm_ops);

ALTER TABLE "CookLog"
  ADD CONSTRAINT "CookLog_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
```

The generated-column and GIN pattern is from the Postgres manual [pg-fts-tables]; `setweight` is standard Postgres text search. Search query sketch:

```sql
SELECT id, slug, title, ts_rank("searchVector", q) AS rank
FROM "Recipe", websearch_to_tsquery('english', $1) AS q
WHERE visibility = 'PUBLIC' AND "searchVector" @@ q
ORDER BY rank DESC, "publishedAt" DESC
LIMIT 24;
```

## Architecture

### Fit with the existing repo

- `apps/web`: Next.js 16.3.6, React 19.3, `typedRoutes: true`, `experimental.typedEnv: true`, `reactStrictMode`. Typecheck runs `next typegen && tsc --noEmit`, so the global `PageProps<'/recipes/[slug]'>` and `LayoutProps` helpers (already used in `layout.tsx`) are available; `params` and `searchParams` are Promises [next-page].
- `apps/web/proxy.ts` is a no-op with an empty matcher. In Next.js 16 `middleware` is deprecated and renamed `proxy`, defaulting to the Node.js runtime [next-proxy]. Proposal: use it only for an optimistic redirect on `/me/:path*` and `/recipes/new` using Better Auth's `getSessionCookie` (cookie presence only) [better-auth-next]; real checks stay in pages and actions.
- `apps/web/lib/auth.ts` and `auth-client.ts` are config stubs; no `betterAuth()` instance or `/api/auth` route exists yet. MVP work wires Better Auth with the Prisma adapter against the existing `User/Account/Session/Verification` models, the `nextCookies()` plugin (last in the list) so Server Actions can set cookies [better-auth-next], and optionally the anonymous plugin.
- `packages/database`: add models and the SQL migration; export small query functions (`getRecipeBySlug`, `searchRecipes`) so `apps/web` never hand-writes raw SQL inline.
- `packages/data`: shared zod schemas for recipe input (`RecipeInput`, `IngredientLineInput`) and the JSON-LD serialiser/normaliser, so the CLI can reuse them (e.g. a bulk import script in `apps/cli`).

### Rendering and caching

- Read paths are async Server Components that call `packages/database` functions directly.
- `cacheComponents` is a stable top-level config flag in Next.js 16 that enables `"use cache"`, `cacheLife`, `cacheTag`, and makes Partial Prerendering the default; it requires the Node.js runtime [next-cache-components]. It is not enabled in `next.config.ts` today. Recommendation: leave it off for MVP (most pages are per-viewer: favourite state, notes, private visibility) and revisit in v1 for public recipe pages, where a cached public body plus a streamed per-viewer island is a good fit. Enabling it also changes navigation to keep routes mounted with React `<Activity>` [next-cache-components], which affects cook mode's wake-lock cleanup and should be tested.
- Mutations call `revalidatePath` for the affected recipe and `/me` routes (or `updateTag`/`revalidateTag` if Cache Components is adopted; exact API choice unverified until then).

### URL import route (`POST /api/import`)

1. Authenticate (`auth.api.getSession`); reject anonymous if Flow 1 option A.
2. Rate limit: count `RecipeImport` rows for the user in the last hour (for example 20/hour) and a global per-IP cap for abuse. Return 429 with `Retry-After`.
3. Validate: `new URL()`, scheme `https:` or `http:` only, no credentials in URL, port 80/443 only, length under 2 KB.
4. SSRF controls per OWASP [owasp-ssrf]: resolve DNS ourselves, reject if any resolved address is private (`10/8`, `172.16/12`, `192.168/16`), loopback (`127/8`, `::1`), link-local (`169.254/16`, `fe80::/10`, which includes the `169.254.169.254` metadata endpoint), unique-local `fc00::/7`, CGNAT `100.64/10`, multicast, or unspecified; connect to the validated IP (pin it) to defeat DNS rebinding; disable automatic redirects and re-run validation on each `Location` hop (max 3).
5. Limits: 8 s total timeout via `AbortSignal.timeout`, response streamed with a 3 MB cap, `Content-Type` must be `text/html` or `application/xhtml+xml`, identifiable `User-Agent`.
6. Extract with `extractRecipe(html, url)`; record a `RecipeImport` row with status and error code; return the normalised draft JSON. Nothing is written to `Recipe` until the user confirms via `createRecipe`.

Pinning the IP with Node's `fetch` (undici) needs a custom dispatcher/`lookup`; exact implementation is left to the MVP issue.

### Images (v1)

- A `StorageAdapter` interface in `apps/web/lib/storage.ts` (`createUploadToken`, `delete`, `publicUrl`) with a Vercel Blob implementation first and an S3-compatible one possible later. `Image.provider` + `storageKey` keep the DB independent of the vendor.
- Vercel Blob client uploads send the file from the browser straight to storage after a token exchange; the route must authenticate in `onBeforeGenerateToken`, can restrict `allowedContentTypes`, passes the user id through `tokenPayload`, and records the upload in `onUploadCompleted` [vercel-blob-client]. Server-side uploads are limited to 4.5 MB, which is why client uploads are preferred [vercel-blob-client]. `onUploadCompleted` cannot reach localhost without a tunnel [vercel-blob-client]; for local dev, create the `Image` row from the client's returned blob URL instead and treat the callback as confirmation.
- Imported recipe images start as `EXTERNAL`; a background copy to our storage runs on save (v1) so recipes do not break when the source changes.
- Render with `next/image`; add the storage hostname to `images.remotePatterns` when this lands.

### Security and privacy checklist

- Authorisation in every Server Action and Route Handler; PRIVATE recipes 404 for non-owners.
- zod validation on all action inputs, including length caps (title 200, ingredient line 500, step 5,000, 200 lines max).
- Render user text as text; no HTML in recipe fields (imports are stripped).
- UNLISTED pages send `noindex`; PUBLIC pages are in a sitemap (v1).
- Better Auth has its own rate limiting for auth endpoints (configuration unverified in this pass).

## Delivery phases

Each bullet is roughly one issue/PR, per the repo's one-issue-per-branch rule.

**MVP: upload, cook, track**

1. Wire Better Auth: `betterAuth()` instance, Prisma adapter, `/api/auth/[...all]`, `/sign-in`, `nextCookies()`; session helper in `lib/`.
2. Schema: models above minus `Collection*`, plus the SQL migration; seed with a handful of public recipes.
3. Shared zod input schemas and JSON-LD serialiser in `packages/data`.
4. Manual editor (`/recipes/new`, `/recipes/[slug]/edit`) with ingredient/step list editors and ingredient parsing.
5. URL import route with SSRF controls, rate limit, extractor, and preview/confirm flow.
6. Recipe detail with JSON-LD, servings scaling, visibility, remix.
7. Cook mode with wake lock, checklist, step navigation.
8. Favourites, cook log dialog, `/me`, `/me/cooked`, private notes.
9. `/recipes` search (FTS + trigram fallback) and basic tag filters.
10. Apply the Berry Rhea tokens, DM Sans and Instrument Serif; update `CONTEXT.md` "Product" section and add ADRs for the data model and import security.

**v1: share and organise**

- Collections and `/me/collections`; public collections on profiles.
- Public profiles `/u/[handle]` and handle picker.
- Tag management and richer filters (diet, max time, sort by quickest).
- Images: cover, step and cook-log photos via the storage adapter; copy imported images.
- Evaluate `cacheComponents` for public recipe pages; sitemap for public recipes.
- Optional anonymous-first onboarding (Flow 1 option B).
- Import from a Paprika or Mealie export file (Tandoor shows demand for this [tandoor-import]).

**Later (parked, out of the current request)**

- Meal plan and shopping list.
- Unit conversion on top of scaling.
- Photo/OCR and AI import.
- Nutrition calculation (beyond storing imported `nutrition`).
- Cooklang export, bookmarklet or browser extension calling `/api/import`.
- Public ratings/reviews and community notes, with moderation.

## Open questions

1. **Anonymous-first or sign-in-first?** Option A (redirect to sign-in) is simpler; option B (Better Auth anonymous users migrated in `onLinkAccount`) removes friction but adds data-migration code and orphaned anonymous rows. Recommend A for MVP.
2. **Sign-in methods.** Email + password, magic link, or OAuth (Google/Apple)? Affects the `/sign-in` screen states and whether an email provider is needed.
3. **Copyright on imports.** Ingredient lists are generally treated as facts but instruction text and photos are not (legal status not verified here). Proposal: imported recipes default PRIVATE; making one PUBLIC shows a prompt to rewrite the steps in their own words and always shows source attribution. Needs a product decision.
4. **Public ratings.** Show an `aggregateRating` on public recipes computed from each user's latest cook-log rating, or keep ratings purely personal? Public ratings help rich results [google-recipe] but invite gaming.
5. **Should cook logs ever be public** (an Allrecipes "I Made It" style)? Would add `CookLog.visibility`.
6. **Prisma generator migration** from deprecated `prisma-client-js` to `prisma-client` [prisma-generators]: do it before or after the first product migration?
7. **Search language.** `'english'` text search config assumes English recipes; multilingual users would need `simple` config or per-recipe language.
8. **Hosting.** Vercel is implied by `apps/web/vercel.json`; confirm, since it decides Vercel Blob vs S3 and how the import route's outbound fetch and IP pinning behave.

## Sources

- [schema-recipe] schema.org, Recipe type: <https://schema.org/Recipe>
- [google-recipe] Google Search Central, Recipe structured data: <https://developers.google.com/search/docs/appearance/structured-data/recipe>
- [schema-dts] Google, schema-dts TypeScript types: <https://github.com/google/schema-dts>
- [py-recipe-scrapers] hhursev/recipe-scrapers (Python): <https://github.com/hhursev/recipe-scrapers>
- [ts-recipe-scrapers] recipe-scrapers (TypeScript port): <https://github.com/recipe-scrapers/recipe-scrapers>
- [recipe-data-scraper] thelifenadine/recipe-data-scraper: <https://github.com/thelifenadine/recipe-data-scraper>
- [html-recipe-parser] mschunke/html-recipe-parser: <https://github.com/mschunke/html-recipe-parser>
- [paprika] Paprika Recipe Manager: <https://www.paprikaapp.com/>
- [mealie-features] Mealie docs, Features: <https://mealie.io/documentation/getting-started/features/>
- [mealie-intro] Mealie docs, Introduction: <https://mealie.io/documentation/getting-started/introduction/>
- [mealie-readme] mealie-recipes/mealie: <https://github.com/mealie-recipes/mealie>
- [tandoor-readme] TandoorRecipes/recipes: <https://github.com/TandoorRecipes/recipes>
- [tandoor-import] Tandoor docs, Import/Export: <https://docs.tandoor.dev/features/import_export/>
- [nyt-app] NYT Cooking, App Store listing: <https://apps.apple.com/us/app/nyt-cooking-recipes-tips/id911422904>
- [allrecipes-2nd] Secondary source (allrecipes.com blocked automated fetch; treat as unverified): <https://eathealthy365.com/how-to-master-the-allrecipes-com-recipe-search/>
- [samsung-news] Samsung Global Newsroom, Samsung Food launch: <https://news.samsung.com/global/samsung-announces-global-launch-of-samsung-food-an-ai-powered-personalized-food-and-recipe-service>
- [cooklang] Cooklang language spec: <https://cooklang.org/docs/spec/>
- [mdn-wakelock] MDN, Screen Wake Lock API: <https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API>
- [next-proxy] Next.js 16.3.6 docs, proxy.js: <https://nextjs.org/docs/app/api-reference/file-conventions/proxy>
- [next-page] Next.js 16.3.6 docs, page.js and `PageProps`: <https://nextjs.org/docs/app/api-reference/file-conventions/page>
- [next-cache-components] Next.js 16.3.6 docs, cacheComponents: <https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents>
- [better-auth-next] Better Auth, Next.js integration: <https://www.better-auth.com/docs/integrations/next>
- [better-auth-anon] Better Auth, Anonymous plugin: <https://www.better-auth.com/docs/plugins/anonymous>
- [prisma-generators] Prisma docs, Generators: <https://www.prisma.io/docs/orm/prisma-schema/overview/generators>
- [prisma-unsupported] Prisma docs, Unsupported database features: <https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported-database-features>
- [prisma-fts] Prisma docs, Full-text search: <https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search>
- [pg-fts-tables] PostgreSQL docs, Text search tables and indexes: <https://www.postgresql.org/docs/current/textsearch-tables.html>
- [tailwind-theme] Tailwind CSS docs, Theme variables: <https://tailwindcss.com/docs/theme>
- [shadcn-create] shadcn/ui, create and preset commands: <https://ui.shadcn.com/create>, <https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create>, <https://ui.shadcn.com/docs/changelog/2026-04-preset-commands>
- [vercel-blob-client] Vercel docs, Client uploads with Vercel Blob: <https://vercel.com/docs/vercel-blob/client-upload>
- [owasp-ssrf] OWASP SSRF Prevention Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html>

Not reachable in this pass: allrecipes.com (fetch blocked), samsungfood.com (HTTP 403). Claims about those products rely on the sources listed above.
