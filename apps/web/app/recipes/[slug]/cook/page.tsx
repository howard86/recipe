import {
  canViewRecipe,
  getRecipeBySlug,
} from "@workspace-template/database/recipes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewerId } from "@/lib/session";
import { CookMode } from "./cook-mode";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Cook mode",
};

export default async function CookPage({
  params,
  searchParams,
}: PageProps<"/recipes/[slug]/cook">) {
  const { slug } = await params;
  const { servings } = await searchParams;
  const [recipe, viewerId] = await Promise.all([
    getRecipeBySlug(slug),
    getViewerId(),
  ]);
  if (!(recipe && canViewRecipe(recipe, viewerId))) {
    notFound();
  }
  const requested = Number.parseInt(
    typeof servings === "string" ? servings : "",
    10
  );
  return (
    <CookMode
      recipe={{
        id: recipe.id,
        ingredients: recipe.ingredients,
        servings: recipe.servings,
        slug: recipe.slug,
        steps: recipe.steps,
        title: recipe.title,
      }}
      servings={requested > 0 && requested <= 100 ? requested : recipe.servings}
    />
  );
}
