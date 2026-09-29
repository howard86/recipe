import { listTags } from "@workspace-template/database/recipes";
import type { Metadata } from "next";
import { createRecipeAction } from "@/app/recipes/actions";
import { editorValueFrom } from "@/components/recipe-editor/payload";
import { RecipeEditor } from "@/components/recipe-editor/recipe-editor";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Add a recipe" };

export default async function NewRecipePage({
  searchParams,
}: PageProps<"/recipes/new">) {
  await requireUser("/recipes/new");
  const { sourceUrl } = await searchParams;
  const tags = await listTags();
  const url = typeof sourceUrl === "string" ? sourceUrl : null;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="mb-8 font-heading text-5xl">Write a recipe</h1>
      <RecipeEditor
        action={createRecipeAction}
        initialValue={editorValueFrom({
          ingredients: [],
          source: { sourceType: "MANUAL", sourceUrl: url },
          steps: [],
          tags: [],
          title: "",
        })}
        submitLabel="Save recipe"
        tagSuggestions={tags}
      />
    </main>
  );
}
