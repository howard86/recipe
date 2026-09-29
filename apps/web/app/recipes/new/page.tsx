import { listTags } from "@workspace-template/database/recipes";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace-template/ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";
import { createRecipeAction } from "@/app/recipes/actions";
import { editorValueFrom } from "@/components/recipe-editor/payload";
import { RecipeEditor } from "@/components/recipe-editor/recipe-editor";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Add a recipe" };

function ChooseEntry() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <h1 className="font-heading text-5xl">Add a recipe</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          className="rounded-3xl focus-visible:outline-2 focus-visible:outline-ring"
          href="/recipes/new/import"
        >
          <Card className="h-full transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle className="font-heading text-3xl">
                Paste a link
              </CardTitle>
              <CardDescription>
                Import from a recipe site. You review it before it is saved.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link
          className="rounded-3xl focus-visible:outline-2 focus-visible:outline-ring"
          href="/recipes/new?mode=write"
        >
          <Card className="h-full transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle className="font-heading text-3xl">
                Write it myself
              </CardTitle>
              <CardDescription>
                Type or paste ingredients and steps. Private until you share it.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </main>
  );
}

export default async function NewRecipePage({
  searchParams,
}: PageProps<"/recipes/new">) {
  await requireUser("/recipes/new");
  const { mode, sourceUrl } = await searchParams;
  const url = typeof sourceUrl === "string" ? sourceUrl : null;
  if (mode !== "write" && !url) {
    return <ChooseEntry />;
  }
  const tags = await listTags();
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
