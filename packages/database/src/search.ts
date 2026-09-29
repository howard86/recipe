import type {
  SearchSort,
  Visibility,
} from "@workspace-template/data/recipe/schema";
import { prisma } from "./client";
import type { RecipeCard } from "./recipes";
import { empty, join, render, type SqlFragment, sql } from "./sql";

export interface SearchParams {
  cuisine?: string;
  /** Opaque cursor from a previous `newest` page. */
  cursor?: string;
  diet?: string;
  limit?: number;
  maxTime?: number;
  /** Viewer id: search the viewer's own recipes (any visibility) instead of public ones. */
  mineFor?: string;
  page?: number;
  q?: string;
  sort?: SearchSort;
  tags?: string[];
}

export interface SearchResult {
  /** True when full-text search found nothing and trigram similarity was used. */
  fuzzy: boolean;
  nextCursor: string | null;
  nextPage: number | null;
  results: RecipeCard[];
}

interface SearchRow {
  authorHandle: string | null;
  authorName: string | null;
  coverImageUrl: string | null;
  description: string | null;
  id: string;
  publishedAt: Date | null;
  servings: number | null;
  slug: string;
  sortedAt: Date;
  sourceName: string | null;
  title: string;
  totalMinutes: number | null;
  visibility: Visibility;
}

const DEFAULT_LIMIT = 24;
const FUZZY_THRESHOLD = 0.3;

function encodeCursor(row: SearchRow): string {
  return Buffer.from(`${row.sortedAt.toISOString()}|${row.id}`).toString(
    "base64url"
  );
}

function decodeCursor(cursor: string): { id: string; sortedAt: Date } | null {
  const [iso, id] = Buffer.from(cursor, "base64url")
    .toString("utf8")
    .split("|");
  const sortedAt = new Date(iso ?? "");
  return id && !Number.isNaN(sortedAt.getTime()) ? { id, sortedAt } : null;
}

function tagFilter(slug: string, kind?: "CUISINE" | "DIET"): SqlFragment {
  const kindClause = kind ? sql`AND t.kind = ${kind}::"TagKind"` : empty;
  return sql`EXISTS (
    SELECT 1 FROM "RecipeTag" rt JOIN "Tag" t ON t.id = rt."tagId"
    WHERE rt."recipeId" = r.id AND t.slug = ${slug} ${kindClause}
  )`;
}

function filterClauses(params: SearchParams): SqlFragment[] {
  const clauses: SqlFragment[] = [
    params.mineFor
      ? sql`r."authorId" = ${params.mineFor}`
      : sql`r.visibility = 'PUBLIC'`,
  ];
  for (const slug of params.tags ?? []) {
    clauses.push(tagFilter(slug));
  }
  if (params.cuisine) {
    clauses.push(tagFilter(params.cuisine, "CUISINE"));
  }
  if (params.diet) {
    clauses.push(tagFilter(params.diet, "DIET"));
  }
  if (params.maxTime) {
    clauses.push(sql`r."totalMinutes" <= ${params.maxTime}`);
  }
  return clauses;
}

type Mode = "fuzzy" | "text" | "browse";

function matchClause(mode: Mode, q: string): SqlFragment {
  if (mode === "text") {
    return sql`r."searchVector" @@ websearch_to_tsquery('english', ${q})`;
  }
  if (mode === "fuzzy") {
    return sql`word_similarity(${q}, r.title) >= ${FUZZY_THRESHOLD}`;
  }
  return sql`TRUE`;
}

function orderClause(mode: Mode, sort: SearchSort, q: string): SqlFragment {
  if (sort === "quickest") {
    return sql`r."totalMinutes" ASC NULLS LAST, r.id`;
  }
  if (sort === "relevance" && mode === "text") {
    return sql`ts_rank(r."searchVector", websearch_to_tsquery('english', ${q})) DESC, "sortedAt" DESC, r.id DESC`;
  }
  if (sort === "relevance" && mode === "fuzzy") {
    return sql`word_similarity(${q}, r.title) DESC, "sortedAt" DESC, r.id DESC`;
  }
  return sql`"sortedAt" DESC, r.id DESC`;
}

function runQuery(
  mode: Mode,
  params: SearchParams,
  sort: SearchSort,
  limit: number
) {
  const q = params.q?.trim() ?? "";
  const clauses = [...filterClauses(params), matchClause(mode, q)];
  const cursor =
    sort === "newest" && params.cursor ? decodeCursor(params.cursor) : null;
  if (cursor) {
    clauses.push(
      sql`(COALESCE(r."publishedAt", r."createdAt"), r.id) < (${cursor.sortedAt}, ${cursor.id})`
    );
  }
  const offset =
    sort === "newest" ? 0 : Math.max(0, (params.page ?? 1) - 1) * limit;
  const { text, values } = render(sql`
    SELECT r.id, r.slug, r.title, r.description, r."totalMinutes", r.servings,
      r.visibility, r."sourceName", r."publishedAt",
      COALESCE(r."publishedAt", r."createdAt") AS "sortedAt",
      p.handle AS "authorHandle", u.name AS "authorName", i.url AS "coverImageUrl"
    FROM "Recipe" r
    JOIN "User" u ON u.id = r."authorId"
    LEFT JOIN "Profile" p ON p."userId" = r."authorId"
    LEFT JOIN "Image" i ON i.id = r."coverImageId"
    WHERE ${join(clauses, " AND ")}
    ORDER BY ${orderClause(mode, sort, q)}
    LIMIT ${limit + 1} OFFSET ${offset}
  `);
  return prisma.$queryRawUnsafe<SearchRow[]>(text, ...values);
}

function toCard({ sortedAt: _sortedAt, ...row }: SearchRow): RecipeCard {
  return row;
}

/**
 * Public (or own, with `mineFor`) recipe search: `websearch_to_tsquery` over the
 * weighted `searchVector`, falling back to trigram similarity on the title when
 * full-text search finds nothing ("lasgna"). Cursor pagination for `newest`,
 * offset pages otherwise.
 */
export async function searchRecipes(
  params: SearchParams
): Promise<SearchResult> {
  const limit = params.limit ?? DEFAULT_LIMIT;
  const q = params.q?.trim();
  const sort: SearchSort = params.sort ?? (q ? "relevance" : "newest");
  let mode: Mode = q ? "text" : "browse";
  let rows = await runQuery(mode, params, sort, limit);
  const firstPage = !(params.cursor || (params.page && params.page > 1));
  if (q && rows.length === 0 && firstPage) {
    mode = "fuzzy";
    rows = await runQuery(mode, params, sort, limit);
  }
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    fuzzy: mode === "fuzzy",
    nextCursor:
      hasMore && sort === "newest" && last ? encodeCursor(last) : null,
    nextPage: hasMore && sort !== "newest" ? (params.page ?? 1) + 1 : null,
    results: page.map(toCard),
  };
}
