"use server";

import {
  RecipeInputSchema,
  VISIBILITIES,
} from "@workspace-template/data/recipe/schema";
import {
  createRecipe,
  deleteRecipe,
  forkRecipe,
  setRecipeVisibility,
  updateRecipe,
} from "@workspace-template/database/recipes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  type EditorPayload,
  toRecipeFormValue,
} from "@/components/recipe-editor/payload";
import { requireUser } from "@/lib/session";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

const VisibilitySchema = z.enum(VISIBILITIES);

export interface EditorState {
  fieldErrors?: Record<string, string[] | undefined>;
  formError?: string;
}

/** Imported JSON-LD above this size is dropped rather than stored. */
const MAX_JSON_LD_BYTES = 200_000;

function parseEditorForm(formData: FormData) {
  let payload: EditorPayload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return {
      error: { formError: "The form could not be read. Reload and try again." },
    };
  }
  const value = toRecipeFormValue(payload);
  if (JSON.stringify(value.importedJsonLd ?? null).length > MAX_JSON_LD_BYTES) {
    value.importedJsonLd = undefined;
  }
  const parsed = RecipeInputSchema.safeParse(value);
  if (!parsed.success) {
    const { fieldErrors, formErrors } = z.flattenError(parsed.error);
    return {
      error: {
        fieldErrors,
        formError: formErrors[0] ?? "Some fields need attention.",
      } satisfies EditorState,
    };
  }
  return { data: parsed.data };
}

export async function createRecipeAction(
  _state: EditorState,
  formData: FormData
): Promise<EditorState> {
  const user = await requireUser("/recipes/new");
  const { data, error } = parseEditorForm(formData);
  if (!data) {
    return error;
  }
  const recipe = await createRecipe(user.id, data);
  redirect(`/recipes/${recipe.slug}?saved=${data.visibility.toLowerCase()}`);
}

export async function updateRecipeAction(
  recipeId: string,
  _state: EditorState,
  formData: FormData
): Promise<EditorState> {
  const user = await requireUser();
  const { data, error } = parseEditorForm(formData);
  if (!data) {
    return error;
  }
  const recipe = await updateRecipe(recipeId, user.id, data);
  if (!recipe) {
    return { formError: "Recipe not found." };
  }
  revalidatePath(`/recipes/${recipe.slug}`);
  redirect(`/recipes/${recipe.slug}?saved=updated`);
}

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
