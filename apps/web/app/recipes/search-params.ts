import {
  SEARCH_SORTS,
  type SearchSort,
} from "@workspace-template/data/recipe/schema";
import type { SearchParams } from "@workspace-template/database/search";
import type { Route } from "next";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface BrowseQuery {
  cuisine?: string;
  cursor?: string;
  diet?: string;
  maxTime?: number;
  mine: boolean;
  page?: number;
  q?: string;
  sort?: SearchSort;
  tags: string[];
}

const SLUG_PATTERN = /^[a-z0-9-]{1,60}$/;
const MAX_TIMES = new Set([15, 30, 45, 60, 90]);

function one(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function slug(value: string | undefined): string | undefined {
  return value && SLUG_PATTERN.test(value) ? value : undefined;
}

/** Parses `?q=&tag=&cuisine=&diet=&maxTime=&sort=&cursor=&page=&mine=` defensively. */
export function parseBrowseQuery(params: RawSearchParams): BrowseQuery {
  const rawTags = params.tag;
  const tags = (Array.isArray(rawTags) ? rawTags : [rawTags])
    .map((tag) => slug(tag))
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 5);
  const maxTime = Number.parseInt(one(params.maxTime) ?? "", 10);
  const page = Number.parseInt(one(params.page) ?? "", 10);
  const sort = one(params.sort);
  return {
    cuisine: slug(one(params.cuisine)),
    cursor: one(params.cursor)?.slice(0, 200),
    diet: slug(one(params.diet)),
    maxTime: MAX_TIMES.has(maxTime) ? maxTime : undefined,
    mine: one(params.mine) === "1",
    page: page > 1 && page < 1000 ? page : undefined,
    q: one(params.q)?.slice(0, 200),
    sort: SEARCH_SORTS.find((value) => value === sort),
    tags: [...new Set(tags)],
  };
}

export function toSearchParams(
  query: BrowseQuery,
  viewerId: string | null
): SearchParams {
  return {
    cuisine: query.cuisine,
    cursor: query.cursor,
    diet: query.diet,
    maxTime: query.maxTime,
    mineFor: query.mine && viewerId ? viewerId : undefined,
    page: query.page,
    q: query.q,
    sort: query.sort,
    tags: query.tags,
  };
}

/** Builds a /recipes URL; pagination resets whenever filters change. */
export function browseHref(
  query: BrowseQuery,
  changes: Partial<BrowseQuery> = {}
): Route {
  const next: BrowseQuery = {
    ...query,
    cursor: changes.cursor,
    page: changes.page,
    ...changes,
  };
  const params = new URLSearchParams();
  if (next.q) {
    params.set("q", next.q);
  }
  for (const tag of next.tags) {
    params.append("tag", tag);
  }
  for (const key of ["cuisine", "diet", "sort", "cursor"] as const) {
    const value = next[key];
    if (value) {
      params.set(key, value);
    }
  }
  if (next.maxTime) {
    params.set("maxTime", String(next.maxTime));
  }
  if (next.page) {
    params.set("page", String(next.page));
  }
  if (next.mine) {
    params.set("mine", "1");
  }
  const search = params.toString();
  return (search ? `/recipes?${search}` : "/recipes") as Route;
}

export function hasFilters(query: BrowseQuery): boolean {
  return Boolean(
    query.q || query.tags.length || query.cuisine || query.diet || query.maxTime
  );
}
