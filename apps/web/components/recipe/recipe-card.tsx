import { formatMinutes } from "@workspace-template/data/recipe/duration";
import type { RecipeCard as RecipeCardData } from "@workspace-template/database/recipes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace-template/ui/components/card";
import Link from "next/link";
import { VisibilityBadge } from "./recipe-meta";

export function RecipeCard({
  recipe,
  showVisibility = false,
}: {
  recipe: RecipeCardData;
  showVisibility?: boolean;
}) {
  const byline = recipe.authorHandle
    ? `@${recipe.authorHandle}`
    : recipe.authorName;
  const meta = [
    formatMinutes(recipe.totalMinutes),
    recipe.servings ? `Serves ${recipe.servings}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      className="group block rounded-3xl focus-visible:outline-2 focus-visible:outline-ring"
      href={`/recipes/${recipe.slug}`}
    >
      <Card className="h-full overflow-hidden pt-0 transition-shadow group-hover:shadow-md">
        {recipe.coverImageUrl ? (
          // biome-ignore lint/correctness/useImageSize: imported covers are hotlinked from arbitrary hosts with unknown dimensions.
          <img
            alt=""
            className="aspect-4/3 w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={recipe.coverImageUrl}
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-4/3 w-full items-center justify-center bg-muted font-heading text-6xl text-muted-foreground/40"
          >
            {recipe.title.charAt(0)}
          </div>
        )}
        <CardHeader>
          {showVisibility && (
            <div>
              <VisibilityBadge visibility={recipe.visibility} />
            </div>
          )}
          <CardTitle className="font-heading text-2xl leading-tight">
            {recipe.title}
          </CardTitle>
          {recipe.description && (
            <CardDescription className="line-clamp-2">
              {recipe.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="mt-auto text-muted-foreground text-sm">
          {[meta, byline ?? recipe.sourceName].filter(Boolean).join(" · ")}
        </CardContent>
      </Card>
    </Link>
  );
}

export function RecipeGrid({
  recipes,
  showVisibility,
}: {
  recipes: RecipeCardData[];
  showVisibility?: boolean;
}) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <RecipeCard recipe={recipe} showVisibility={showVisibility} />
        </li>
      ))}
    </ul>
  );
}
