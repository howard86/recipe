import { listTags } from "@workspace-template/database/recipes";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { ImportFlow } from "./import-flow";

export const metadata: Metadata = { title: "Import a recipe" };

export default async function ImportRecipePage() {
  await requireUser("/recipes/new/import");
  const tags = await listTags();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="font-heading text-5xl">Paste a link</h1>
      <p className="mt-2 text-muted-foreground">
        We read the recipe from the page and show it to you before anything is
        saved.
      </p>
      <ImportFlow tagSuggestions={tags} />
    </main>
  );
}
