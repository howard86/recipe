import { resolveTotalMinutes } from "@workspace-template/data/recipe/duration";
import type {
  RecipeInput,
  TagKind,
  Visibility,
} from "@workspace-template/data/recipe/schema";
import {
  createRecipeSlug,
  slugify,
} from "@workspace-template/data/recipe/slug";
import { Prisma } from "../generated/client";
import { prisma } from "./client";

export interface RecipeCard {
  authorHandle: string | null;
  authorName: string | null;
  coverImageUrl: string | null;
  description: string | null;
  id: string;
  publishedAt: Date | null;
  servings: number | null;
  slug: string;
  sourceName: string | null;
  title: string;
  totalMinutes: number | null;
  visibility: Visibility;
}

export interface IngredientLineView {
  id: string;
  name: string | null;
  note: string | null;
  quantity: number | null;
  quantityMax: number | null;
  raw: string;
  section: string | null;
  unit: string | null;
}

export interface RecipeDetail extends RecipeCard {
  author: { handle: string | null; id: string; name: string | null };
  cookMinutes: number | null;
  createdAt: Date;
  forkedFrom: {
    authorHandle: string | null;
    authorName: string | null;
    slug: string;
    title: string;
    visibility: Visibility;
  } | null;
  ingredients: IngredientLineView[];
  nutrition: Prisma.JsonValue;
  prepMinutes: number | null;
  sourceType: "MANUAL" | "URL_IMPORT" | "FORK";
  sourceUrl: string | null;
  steps: { id: string; section: string | null; text: string }[];
  tags: { kind: TagKind; name: string; slug: string }[];
  updatedAt: Date;
  yieldText: string | null;
}

export const recipeCardSelect = {
  author: { select: { name: true, profile: { select: { handle: true } } } },
  coverImage: { select: { url: true } },
  description: true,
  id: true,
  publishedAt: true,
  servings: true,
  slug: true,
  sourceName: true,
  title: true,
  totalMinutes: true,
  visibility: true,
} satisfies Prisma.RecipeSelect;

type RecipeCardRow = Prisma.RecipeGetPayload<{
  select: typeof recipeCardSelect;
}>;

export function toRecipeCard(row: RecipeCardRow): RecipeCard {
  return {
    authorHandle: row.author.profile?.handle ?? null,
    authorName: row.author.name,
    coverImageUrl: row.coverImage?.url ?? null,
    description: row.description,
    id: row.id,
    publishedAt: row.publishedAt,
    servings: row.servings,
    slug: row.slug,
    sourceName: row.sourceName,
    title: row.title,
    totalMinutes: row.totalMinutes,
    visibility: row.visibility,
  };
}

const detailInclude = {
  author: {
    select: { id: true, name: true, profile: { select: { handle: true } } },
  },
  coverImage: { select: { url: true } },
  forkedFrom: {
    select: {
      author: { select: { name: true, profile: { select: { handle: true } } } },
      slug: true,
      title: true,
      visibility: true,
    },
  },
  ingredients: { orderBy: { position: "asc" } },
  steps: { orderBy: { position: "asc" } },
  tags: { include: { tag: true } },
} satisfies Prisma.RecipeInclude;

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

/** PRIVATE recipes are visible to their author only; callers 404 otherwise. */
export function canViewRecipe(
  recipe: {
    authorId?: string;
    author?: { id: string };
    visibility: Visibility;
  },
  viewerId: string | null | undefined
): boolean {
  const authorId = recipe.authorId ?? recipe.author?.id;
  return (
    recipe.visibility !== "PRIVATE" || (!!viewerId && viewerId === authorId)
  );
}

export async function getRecipeBySlug(
  slug: string
): Promise<RecipeDetail | null> {
  const row = await prisma.recipe.findUnique({
    include: detailInclude,
    where: { slug },
  });
  if (!row) {
    return null;
  }
  return {
    author: {
      handle: row.author.profile?.handle ?? null,
      id: row.author.id,
      name: row.author.name,
    },
    authorHandle: row.author.profile?.handle ?? null,
    authorName: row.author.name,
    cookMinutes: row.cookMinutes,
    coverImageUrl: row.coverImage?.url ?? null,
    createdAt: row.createdAt,
    description: row.description,
    forkedFrom: row.forkedFrom
      ? {
          authorHandle: row.forkedFrom.author.profile?.handle ?? null,
          authorName: row.forkedFrom.author.name,
          slug: row.forkedFrom.slug,
          title: row.forkedFrom.title,
          visibility: row.forkedFrom.visibility,
        }
      : null,
    id: row.id,
    ingredients: row.ingredients.map((line) => ({
      id: line.id,
      name: line.name,
      note: line.note,
      quantity: toNumber(line.quantity),
      quantityMax: toNumber(line.quantityMax),
      raw: line.raw,
      section: line.section,
      unit: line.unit,
    })),
    nutrition: row.nutrition,
    prepMinutes: row.prepMinutes,
    publishedAt: row.publishedAt,
    servings: row.servings,
    slug: row.slug,
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    steps: row.steps.map((step) => ({
      id: step.id,
      section: step.section,
      text: step.text,
    })),
    tags: row.tags.map(({ tag }) => ({
      kind: tag.kind,
      name: tag.name,
      slug: tag.slug,
    })),
    title: row.title,
    totalMinutes: row.totalMinutes,
    updatedAt: row.updatedAt,
    visibility: row.visibility,
    yieldText: row.yieldText,
  };
}

function ingredientsText(input: Pick<RecipeInput, "ingredients">): string {
  return input.ingredients.map((line) => line.name ?? line.raw).join("\n");
}

function childRows(input: RecipeInput) {
  return {
    ingredients: input.ingredients.map((line, position) => ({
      name: line.name,
      note: line.note,
      position,
      quantity: line.quantity ?? null,
      quantityMax: line.quantityMax ?? null,
      raw: line.raw,
      section: line.section,
      unit: line.unit,
    })),
    steps: input.steps.map((step, position) => ({
      position,
      section: step.section,
      text: step.text,
    })),
  };
}

function tagConnections(tags: RecipeInput["tags"]) {
  const seen = new Set<string>();
  const unique = tags.filter((tag) => {
    const slug = slugify(tag.name, 50);
    if (!slug || seen.has(slug)) {
      return false;
    }
    seen.add(slug);
    return true;
  });
  return unique.map((tag) => ({
    tag: {
      connectOrCreate: {
        create: { kind: tag.kind, name: tag.name, slug: slugify(tag.name, 50) },
        where: { slug: slugify(tag.name, 50) },
      },
    },
  }));
}

function scalarFields(input: RecipeInput) {
  return {
    cookMinutes: input.cookMinutes ?? null,
    description: input.description,
    ingredientsText: ingredientsText(input),
    prepMinutes: input.prepMinutes ?? null,
    servings: input.servings ?? null,
    title: input.title,
    totalMinutes: resolveTotalMinutes(input),
    visibility: input.visibility,
    yieldText: input.yieldText,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function withFreshSlug<T>(
  title: string,
  create: (slug: string) => Promise<T>
) {
  try {
    return await create(createRecipeSlug(title));
  } catch (error) {
    // A 6-character suffix collision is rare; one retry makes it negligible.
    if (isUniqueViolation(error)) {
      return create(createRecipeSlug(title));
    }
    throw error;
  }
}

export function createRecipe(
  authorId: string,
  input: RecipeInput,
  options: { forkedFromId?: string } = {}
): Promise<{ id: string; slug: string }> {
  const { ingredients, steps } = childRows(input);
  const nutrition = input.nutrition ?? Prisma.DbNull;
  const importedJsonLd =
    input.importedJsonLd === undefined || input.importedJsonLd === null
      ? Prisma.DbNull
      : (input.importedJsonLd as Prisma.InputJsonValue);
  return withFreshSlug(input.title, (slug) =>
    prisma.$transaction(async (tx) => {
      // Imported images stay EXTERNAL (hotlinked) until copied to our storage.
      const coverImage = input.imageUrl
        ? await tx.image.create({
            data: {
              ownerId: authorId,
              provider: "EXTERNAL",
              storageKey: `${authorId}:${input.imageUrl}`,
              url: input.imageUrl,
            },
            select: { id: true },
          })
        : null;
      const recipe = await tx.recipe.create({
        data: {
          ...scalarFields(input),
          authorId,
          coverImageId: coverImage?.id,
          forkedFromId: options.forkedFromId,
          importedJsonLd,
          ingredients: { create: ingredients },
          nutrition,
          publishedAt: input.visibility === "PUBLIC" ? new Date() : null,
          slug,
          sourceName: input.sourceName,
          sourceType: options.forkedFromId ? "FORK" : input.sourceType,
          sourceUrl: input.sourceUrl,
          steps: { create: steps },
          tags: { create: tagConnections(input.tags) },
        },
        select: { id: true, slug: true },
      });
      if (input.importId) {
        await tx.recipeImport.updateMany({
          data: { recipeId: recipe.id },
          where: { id: input.importId, userId: authorId },
        });
      }
      return recipe;
    })
  );
}

/** Rewrites the recipe and all child rows in one transaction. Null if not the owner. */
export function updateRecipe(
  recipeId: string,
  authorId: string,
  input: RecipeInput
): Promise<{ id: string; slug: string } | null> {
  const { ingredients, steps } = childRows(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.recipe.findFirst({
      select: { publishedAt: true },
      where: { authorId, id: recipeId },
    });
    if (!existing) {
      return null;
    }
    await tx.ingredientLine.deleteMany({ where: { recipeId } });
    await tx.instructionStep.deleteMany({ where: { recipeId } });
    await tx.recipeTag.deleteMany({ where: { recipeId } });
    return tx.recipe.update({
      data: {
        ...scalarFields(input),
        ingredients: { create: ingredients },
        publishedAt:
          existing.publishedAt ??
          (input.visibility === "PUBLIC" ? new Date() : null),
        steps: { create: steps },
        tags: { create: tagConnections(input.tags) },
      },
      select: { id: true, slug: true },
      where: { id: recipeId },
    });
  });
}

export async function deleteRecipe(
  recipeId: string,
  authorId: string
): Promise<boolean> {
  const { count } = await prisma.recipe.deleteMany({
    where: { authorId, id: recipeId },
  });
  return count > 0;
}

export async function setRecipeVisibility(
  recipeId: string,
  authorId: string,
  visibility: Visibility
): Promise<{ slug: string } | null> {
  const recipe = await prisma.recipe.findFirst({
    select: { publishedAt: true },
    where: { authorId, id: recipeId },
  });
  if (!recipe) {
    return null;
  }
  return prisma.recipe.update({
    data: {
      publishedAt:
        recipe.publishedAt ?? (visibility === "PUBLIC" ? new Date() : null),
      visibility,
    },
    select: { slug: true },
    where: { id: recipeId },
  });
}

/** Copies a viewable recipe into a new PRIVATE recipe owned by the viewer. */
export async function forkRecipe(
  recipeId: string,
  viewerId: string
): Promise<{ id: string; slug: string } | null> {
  const source = await prisma.recipe.findUnique({
    include: {
      ingredients: { orderBy: { position: "asc" } },
      steps: { orderBy: { position: "asc" } },
      tags: { include: { tag: true } },
    },
    where: { id: recipeId },
  });
  if (!(source && canViewRecipe(source, viewerId))) {
    return null;
  }
  return createRecipe(
    viewerId,
    {
      cookMinutes: source.cookMinutes,
      description: source.description,
      imageUrl: null,
      ingredients: source.ingredients.map((line) => ({
        name: line.name,
        note: line.note,
        quantity: toNumber(line.quantity),
        quantityMax: toNumber(line.quantityMax),
        raw: line.raw,
        section: line.section,
        unit: line.unit,
      })),
      prepMinutes: source.prepMinutes,
      servings: source.servings,
      sourceName: source.sourceName,
      sourceType: "FORK",
      sourceUrl: source.sourceUrl,
      steps: source.steps.map((step) => ({
        section: step.section,
        text: step.text,
      })),
      tags: source.tags.map(({ tag }) => ({ kind: tag.kind, name: tag.name })),
      title: source.title,
      totalMinutes: source.totalMinutes,
      visibility: "PRIVATE",
      yieldText: source.yieldText,
    },
    { forkedFromId: source.id }
  );
}

export async function listRecentPublicRecipes(
  limit = 12
): Promise<RecipeCard[]> {
  const rows = await prisma.recipe.findMany({
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: recipeCardSelect,
    take: limit,
    where: { visibility: "PUBLIC" },
  });
  return rows.map(toRecipeCard);
}

export async function listRecipesByAuthor(
  authorId: string,
  options: { publicOnly?: boolean } = {}
): Promise<RecipeCard[]> {
  const rows = await prisma.recipe.findMany({
    orderBy: { updatedAt: "desc" },
    select: recipeCardSelect,
    where: {
      authorId,
      ...(options.publicOnly ? { visibility: "PUBLIC" } : {}),
    },
  });
  return rows.map(toRecipeCard);
}

export function listTags() {
  return prisma.tag.findMany({
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: { kind: true, name: true, slug: true },
    where: { recipes: { some: { recipe: { visibility: "PUBLIC" } } } },
  });
}
