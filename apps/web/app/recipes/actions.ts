"use server";

import { VISIBILITIES } from "@workspace-template/data/recipe/schema";
import {
  deleteRecipe,
  forkRecipe,
  setRecipeVisibility,
} from "@workspace-template/database/recipes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

const VisibilitySchema = z.enum(VISIBILITIES);

export async function setVisibilityAction(
  recipeId: string,
  visibility: string
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = VisibilitySchema.safeParse(visibility);
  if (!parsed.success) {
    return { error: "Pick private, unlisted or public." };
  }
  const recipe = await setRecipeVisibility(recipeId, user.id, parsed.data);
  if (!recipe) {
    return { error: "Recipe not found." };
  }
  revalidatePath(`/recipes/${recipe.slug}`);
  return { ok: true };
}

export async function deleteRecipeAction(
  recipeId: string
): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await deleteRecipe(recipeId, user.id))) {
    return { error: "Recipe not found." };
  }
  redirect("/");
}

export async function forkRecipeAction(recipeId: string, slug: string) {
  const user = await requireUser(`/recipes/${slug}`);
  const fork = await forkRecipe(recipeId, user.id);
  if (!fork) {
    return { error: "Recipe not found." } satisfies ActionResult;
  }
  redirect(`/recipes/${fork.slug}`);
}
