import { appConfig } from "@workspace-template/data";
import { listRecentPublicRecipes } from "@workspace-template/database/recipes";
import { Button } from "@workspace-template/ui/components/button";
import { Input } from "@workspace-template/ui/components/input";
import Link from "next/link";
import { RecipeGrid } from "@/components/recipe/recipe-card";
import { buttonClass } from "@/lib/button-class";

export default async function HomePage() {
  const recipes = await listRecentPublicRecipes(6);
  return (
    <main className="mx-auto w-full max-w-5xl space-y-14 px-4 py-16">
      <section className="max-w-2xl space-y-6">
        <h1 className="font-heading text-6xl leading-none">{appConfig.name}</h1>
        <p className="text-muted-foreground text-xl">{appConfig.description}</p>
        <search>
          <form action="/recipes" className="flex gap-2">
            <Input
              aria-label="Search recipes"
              name="q"
              placeholder="Search recipes"
              type="search"
            />
            <Button type="submit">Search</Button>
          </form>
        </search>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonClass({ size: "lg" })} href="/recipes/new">
            Add a recipe
          </Link>
          <Link
            className={buttonClass({ size: "lg", variant: "outline" })}
            href="/recipes"
          >
            Browse recipes
          </Link>
        </div>
      </section>
      {recipes.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-5">
          <div className="flex items-end justify-between">
            <h2 className="font-heading text-3xl" id="recent-heading">
              Recently shared
            </h2>
            <Link className="text-primary hover:underline" href="/recipes">
              See all
            </Link>
          </div>
          <RecipeGrid recipes={recipes} />
        </section>
      )}
    </main>
  );
}
