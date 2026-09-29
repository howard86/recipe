import type { TagKind } from "@workspace-template/data/recipe/schema";
import { listTags } from "@workspace-template/database/recipes";
import { searchRecipes } from "@workspace-template/database/search";
import { Badge } from "@workspace-template/ui/components/badge";
import { Button } from "@workspace-template/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace-template/ui/components/empty";
import { Input } from "@workspace-template/ui/components/input";
import { cn } from "@workspace-template/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RecipeGrid } from "@/components/recipe/recipe-card";
import { buttonClass } from "@/lib/button-class";
import { getViewerId, signInPath } from "@/lib/session";
import {
  type BrowseQuery,
  browseHref,
  hasFilters,
  parseBrowseQuery,
  toSearchParams,
} from "./search-params";

export const metadata: Metadata = { title: "Browse recipes" };

const SELECT_CLASS =
  "h-8 rounded-2xl border border-input bg-transparent px-3 text-sm";
const TIME_OPTIONS = [15, 30, 45, 60, 90];

interface TagOption {
  kind: TagKind;
  name: string;
  slug: string;
}

function Filters({ query, tags }: { query: BrowseQuery; tags: TagOption[] }) {
  const cuisines = tags.filter((tag) => tag.kind === "CUISINE");
  const diets = tags.filter((tag) => tag.kind === "DIET");
  return (
    <search>
      <form action="/recipes" className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search recipes"
          className="min-w-56 flex-1"
          defaultValue={query.q}
          name="q"
          placeholder={
            query.mine ? "Search your recipes" : "Search by name or ingredient"
          }
          type="search"
        />
        {query.tags.map((tag) => (
          <input key={tag} name="tag" type="hidden" value={tag} />
        ))}
        {query.mine && <input name="mine" type="hidden" value="1" />}
        {cuisines.length > 0 && (
          <select
            aria-label="Cuisine"
            className={SELECT_CLASS}
            defaultValue={query.cuisine ?? ""}
            name="cuisine"
          >
            <option value="">Any cuisine</option>
            {cuisines.map((tag) => (
              <option key={tag.slug} value={tag.slug}>
                {tag.name}
              </option>
            ))}
          </select>
        )}
        {diets.length > 0 && (
          <select
            aria-label="Diet"
            className={SELECT_CLASS}
            defaultValue={query.diet ?? ""}
            name="diet"
          >
            <option value="">Any diet</option>
            {diets.map((tag) => (
              <option key={tag.slug} value={tag.slug}>
                {tag.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Time"
          className={SELECT_CLASS}
          defaultValue={query.maxTime ?? ""}
          name="maxTime"
        >
          <option value="">Any time</option>
          {TIME_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              Under {minutes} min
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          className={SELECT_CLASS}
          defaultValue={query.sort ?? ""}
          name="sort"
        >
          <option value="">{query.q ? "Best match" : "Newest"}</option>
          <option value="newest">Newest</option>
          <option value="quickest">Quickest</option>
        </select>
        <Button type="submit">Search</Button>
      </form>
    </search>
  );
}

function TagChips({ query, tags }: { query: BrowseQuery; tags: TagOption[] }) {
  const chips = tags.filter(
    (tag) => tag.kind === "GENERAL" || tag.kind === "COURSE"
  );
  if (!chips.length) {
    return null;
  }
  return (
    <ul aria-label="Tags" className="flex flex-wrap gap-2">
      {chips.map((tag) => {
        const active = query.tags.includes(tag.slug);
        const nextTags = active
          ? query.tags.filter((item) => item !== tag.slug)
          : [...query.tags, tag.slug];
        return (
          <li key={tag.slug}>
            <Link
              aria-pressed={active}
              href={browseHref(query, { tags: nextTags })}
            >
              <Badge
                className={cn(active && "bg-primary text-primary-foreground")}
                variant="secondary"
              >
                {tag.name}
              </Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function BrowsePage({
  searchParams,
}: PageProps<"/recipes">) {
  const query = parseBrowseQuery(await searchParams);
  const viewerId = await getViewerId();
  if (query.mine && !viewerId) {
    redirect(signInPath(browseHref(query)));
  }
  const [result, tags] = await Promise.all([
    searchRecipes(toSearchParams(query, viewerId)),
    listTags(),
  ]);
  const filtered = hasFilters(query);
  const nextHref = result.nextCursor
    ? browseHref(query, { cursor: result.nextCursor })
    : result.nextPage && browseHref(query, { page: result.nextPage });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-5xl">
          {query.mine ? "Search my recipes" : "Browse recipes"}
        </h1>
        {viewerId && (
          <Link
            className="text-primary hover:underline"
            href={browseHref(query, { mine: !query.mine })}
          >
            {query.mine ? "Search public recipes" : "Search only mine"}
          </Link>
        )}
      </div>
      <Filters query={query} tags={tags} />
      <TagChips query={query} tags={tags} />
      {result.fuzzy && (
        <p className="text-muted-foreground">
          No exact matches for “{query.q}”. Showing close matches.
        </p>
      )}
      {result.results.length ? (
        <>
          <RecipeGrid recipes={result.results} showVisibility={query.mine} />
          {nextHref && (
            <div className="flex justify-center">
              <Link
                className={buttonClass({ variant: "outline" })}
                href={nextHref}
              >
                More recipes
              </Link>
            </div>
          )}
        </>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle className="font-heading text-2xl">
              No recipes found
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try removing a filter or searching for something broader."
                : "Nothing here yet."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <EmptyContent>
              <Link
                className={buttonClass({ variant: "outline" })}
                href={query.mine ? "/recipes?mine=1" : "/recipes"}
              >
                Clear filters
              </Link>
            </EmptyContent>
          )}
        </Empty>
      )}
    </main>
  );
}
