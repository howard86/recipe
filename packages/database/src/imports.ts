import { prisma } from "./client";

/** `RecipeImport` doubles as the rate-limit ledger. */
export function countImportsSince(userId: string, since: Date) {
  return prisma.recipeImport.count({
    where: { createdAt: { gte: since }, userId },
  });
}

export function oldestImportSince(userId: string, since: Date) {
  return prisma.recipeImport.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
    where: { createdAt: { gte: since }, userId },
  });
}

/** The user's own recipe previously saved from this normalised URL, if any. */
export async function findImportedRecipe(
  userId: string,
  normalizedUrl: string
) {
  const row = await prisma.recipeImport.findFirst({
    orderBy: { createdAt: "desc" },
    select: { recipe: { select: { authorId: true, slug: true, title: true } } },
    where: { normalizedUrl, recipe: { authorId: userId }, userId },
  });
  return row?.recipe
    ? { slug: row.recipe.slug, title: row.recipe.title }
    : null;
}

export function recordImport(data: {
  errorCode?: string | null;
  normalizedUrl: string;
  status: "SUCCEEDED" | "FAILED";
  url: string;
  userId: string;
}) {
  return prisma.recipeImport.create({ data, select: { id: true } });
}
