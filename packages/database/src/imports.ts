import { prisma } from "./client";

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
