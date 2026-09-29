import {
  getRecipeBySlug,
  listTags,
} from "@workspace-template/database/recipes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateRecipeAction } from "@/app/recipes/actions";
import { editorValueFrom } from "@/components/recipe-editor/payload";
import { RecipeEditor } from "@/components/recipe-editor/recipe-editor";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({
  params,
}: PageProps<"/recipes/[slug]/edit">) {
  const { slug } = await params;
  const user = await requireUser(`/recipes/${slug}/edit`);
  const [recipe, tags] = await Promise.all([getRecipeBySlug(slug), listTags()]);
  if (recipe?.author.id !== user.id) {
    notFound();
  }
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="mb-8 font-heading text-5xl">Edit recipe</h1>
      <RecipeEditor
        action={updateRecipeAction.bind(null, recipe.id)}
        initialValue={editorValueFrom({
          ...recipe,
          source: {
            sourceName: recipe.sourceName,
            sourceType: recipe.sourceType,
            sourceUrl: recipe.sourceUrl,
          },
          tags: recipe.tags.map((tag) => ({ kind: tag.kind, name: tag.name })),
        })}
        submitLabel="Save changes"
        tagSuggestions={tags}
      />
    </main>
  );
}
