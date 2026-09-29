"use server";

import {
  CookLogInputSchema,
  HandleSchema,
  RecipeNoteInputSchema,
} from "@workspace-template/data/recipe/schema";
import { updateHandle } from "@workspace-template/database/profiles";
import {
  deleteCookLog,
  logCook,
  saveRecipeNote,
  toggleFavorite,
  updateCookLog,
} from "@workspace-template/database/tracking";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { z } from "zod";
import { HANDLE_BANNER_COOKIE } from "@/lib/handle-banner";
import { requireUser } from "@/lib/session";

export interface TrackingResult {
  error?: string;
  favorited?: boolean;
  ok?: boolean;
}

export async function toggleFavoriteAction(
  recipeId: string
): Promise<TrackingResult> {
  const user = await requireUser();
  const favorited = await toggleFavorite(user.id, recipeId);
  if (favorited === null) {
    return { error: "Recipe not found." };
  }
  revalidatePath("/me");
  return { favorited, ok: true };
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function logCookAction(input: unknown): Promise<TrackingResult> {
  const user = await requireUser();
  const parsed = CookLogInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  if (!(await logCook(user.id, parsed.data))) {
    return { error: "Recipe not found." };
  }
  revalidatePath("/me", "layout");
  return { ok: true };
}

export async function updateCookLogAction(
  id: string,
  input: unknown
): Promise<TrackingResult> {
  const user = await requireUser();
  const parsed = CookLogInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  if (!(await updateCookLog(id, user.id, parsed.data))) {
    return { error: "Cook log not found." };
  }
  revalidatePath("/me", "layout");
  return { ok: true };
}

export async function deleteCookLogAction(id: string): Promise<TrackingResult> {
  const user = await requireUser();
  if (!(await deleteCookLog(id, user.id))) {
    return { error: "Cook log not found." };
  }
  revalidatePath("/me", "layout");
  return { ok: true };
}

export async function saveRecipeNoteAction(
  recipeId: string,
  body: string
): Promise<TrackingResult> {
  const user = await requireUser();
  const parsed = RecipeNoteInputSchema.safeParse({ body, recipeId });
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  if (!(await saveRecipeNote(user.id, recipeId, parsed.data.body))) {
    return { error: "Recipe not found." };
  }
  return { ok: true };
}

async function dismissBanner() {
  (await cookies()).set(HANDLE_BANNER_COOKIE, "1", {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}

export async function updateHandleAction(
  _state: TrackingResult,
  formData: FormData
): Promise<TrackingResult> {
  const user = await requireUser();
  const parsed = HandleSchema.safeParse(formData.get("handle"));
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  if (!(await updateHandle(user.id, parsed.data))) {
    return { error: "That handle is taken." };
  }
  await dismissBanner();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function dismissHandleBannerAction() {
  await requireUser();
  await dismissBanner();
  revalidatePath("/me");
}
