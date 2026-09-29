import type { CookLogInput } from "@workspace-template/data/recipe/schema";
import { prisma } from "./client";
import {
  canViewRecipe,
  type RecipeCard,
  recipeCardSelect,
  toRecipeCard,
} from "./recipes";

async function findViewableRecipeId(recipeId: string, viewerId: string) {
  const recipe = await prisma.recipe.findUnique({
    select: { authorId: true, id: true, visibility: true },
    where: { id: recipeId },
  });
  return recipe && canViewRecipe(recipe, viewerId) ? recipe.id : null;
}

/** Returns the new state, or null when the viewer cannot see the recipe. */
export async function toggleFavorite(
  userId: string,
  recipeId: string
): Promise<boolean | null> {
  if (!(await findViewableRecipeId(recipeId, userId))) {
    return null;
  }
  const where = { userId_recipeId: { recipeId, userId } };
  const existing = await prisma.favorite.findUnique({ where });
  if (existing) {
    await prisma.favorite.delete({ where });
    return false;
  }
  await prisma.favorite.create({ data: { recipeId, userId } });
  return true;
}

/** Favourites the viewer can still see (a recipe made private drops out). */
export async function listFavorites(userId: string): Promise<RecipeCard[]> {
  const rows = await prisma.favorite.findMany({
    orderBy: { createdAt: "desc" },
    select: { recipe: { select: { ...recipeCardSelect, authorId: true } } },
    where: {
      OR: [
        { recipe: { visibility: { not: "PRIVATE" } } },
        { recipe: { authorId: userId } },
      ],
      userId,
    },
  });
  return rows.map(({ recipe }) => toRecipeCard(recipe));
}

function cookLogData(input: CookLogInput) {
  return {
    cookedAt: new Date(`${input.cookedAt}T12:00:00Z`),
    notes: input.notes,
    rating: input.rating ?? null,
    servingsMade: input.servingsMade ?? null,
  };
}

export async function logCook(userId: string, input: CookLogInput) {
  if (!(await findViewableRecipeId(input.recipeId, userId))) {
    return null;
  }
  return prisma.cookLog.create({
    data: { ...cookLogData(input), recipeId: input.recipeId, userId },
    select: { id: true },
  });
}

export async function updateCookLog(
  id: string,
  userId: string,
  input: CookLogInput
) {
  const { count } = await prisma.cookLog.updateMany({
    data: cookLogData(input),
    where: { id, userId },
  });
  return count > 0;
}

export async function deleteCookLog(id: string, userId: string) {
  const { count } = await prisma.cookLog.deleteMany({ where: { id, userId } });
  return count > 0;
}

export interface CookLogEntry {
  cookedAt: Date;
  id: string;
  notes: string | null;
  rating: number | null;
  recipe: {
    coverImageUrl: string | null;
    id: string;
    slug: string;
    title: string;
  };
  servingsMade: number | null;
}

export async function listCookLogs(
  userId: string,
  filters: { limit?: number; minRating?: number; recipeId?: string } = {}
): Promise<CookLogEntry[]> {
  const rows = await prisma.cookLog.findMany({
    orderBy: [{ cookedAt: "desc" }, { createdAt: "desc" }],
    select: {
      cookedAt: true,
      id: true,
      notes: true,
      rating: true,
      recipe: {
        select: {
          coverImage: { select: { url: true } },
          id: true,
          slug: true,
          title: true,
        },
      },
      servingsMade: true,
    },
    take: filters.limit,
    where: {
      rating: filters.minRating ? { gte: filters.minRating } : undefined,
      recipeId: filters.recipeId,
      userId,
    },
  });
  return rows.map((row) => ({
    ...row,
    recipe: {
      coverImageUrl: row.recipe.coverImage?.url ?? null,
      id: row.recipe.id,
      slug: row.recipe.slug,
      title: row.recipe.title,
    },
  }));
}

/** Recipes the user has logged, for the cook-log filter. */
export async function listCookedRecipes(userId: string) {
  const rows = await prisma.recipe.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
    where: { cookLogs: { some: { userId } } },
  });
  return rows;
}

export interface ViewerRecipeState {
  cookCount: number;
  favorited: boolean;
  lastCookedAt: Date | null;
  latestRating: number | null;
  note: string;
}

export async function getViewerRecipeState(
  userId: string,
  recipeId: string
): Promise<ViewerRecipeState> {
  const [favorite, note, cookCount, latest, latestRated] = await Promise.all([
    prisma.favorite.findUnique({
      where: { userId_recipeId: { recipeId, userId } },
    }),
    prisma.recipeNote.findUnique({
      where: { userId_recipeId: { recipeId, userId } },
    }),
    prisma.cookLog.count({ where: { recipeId, userId } }),
    prisma.cookLog.findFirst({
      orderBy: { cookedAt: "desc" },
      where: { recipeId, userId },
    }),
    prisma.cookLog.findFirst({
      orderBy: { cookedAt: "desc" },
      where: { rating: { not: null }, recipeId, userId },
    }),
  ]);
  return {
    cookCount,
    favorited: !!favorite,
    lastCookedAt: latest?.cookedAt ?? null,
    latestRating: latestRated?.rating ?? null,
    note: note?.body ?? "",
  };
}

/** One private note per user per recipe; an empty body deletes it. */
export async function saveRecipeNote(
  userId: string,
  recipeId: string,
  body: string
) {
  if (!(await findViewableRecipeId(recipeId, userId))) {
    return false;
  }
  const where = { userId_recipeId: { recipeId, userId } };
  if (!body.trim()) {
    await prisma.recipeNote.deleteMany({ where: { recipeId, userId } });
    return true;
  }
  await prisma.recipeNote.upsert({
    create: { body, recipeId, userId },
    update: { body },
    where,
  });
  return true;
}
