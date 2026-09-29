import {
  recipeToJsonLd,
  serializeJsonLd,
} from "@workspace-template/data/recipe/jsonld";
import { groupBySection } from "@workspace-template/data/recipe/sections";
import {
  canViewRecipe,
  getRecipeBySlug,
  type RecipeDetail,
} from "@workspace-template/database/recipes";
import {
  getViewerRecipeState,
  type ViewerRecipeState,
} from "@workspace-template/database/tracking";
import { Badge } from "@workspace-template/ui/components/badge";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DeleteRecipeButton } from "@/components/recipe/delete-recipe-button";
import { IngredientsCard } from "@/components/recipe/ingredients-card";
import { RecipeTimes, VisibilityBadge } from "@/components/recipe/recipe-meta";
import { RemixButton } from "@/components/recipe/remix-button";
import { SavedToast } from "@/components/recipe/saved-toast";
import { SharingDialog } from "@/components/recipe/sharing-dialog";
import { CookLogDialog } from "@/components/tracking/cook-log-dialog";
import { FavoriteButton } from "@/components/tracking/favorite-button";
import { IntentReplay } from "@/components/tracking/intent-replay";
import { RecipeNote } from "@/components/tracking/recipe-note";
import { Stars } from "@/components/tracking/stars";
import { buttonClass } from "@/lib/button-class";
import { getViewerId, signInPath } from "@/lib/session";
import { absoluteUrl } from "@/lib/site";

const loadRecipe = cache(getRecipeBySlug);

/** The recipe when the viewer may see it; PRIVATE recipes 404 for non-owners. */
async function loadViewable(slug: string) {
  const [recipe, viewerId] = await Promise.all([
    loadRecipe(slug),
    getViewerId(),
  ]);
  if (!(recipe && canViewRecipe(recipe, viewerId))) {
    notFound();
  }
  return { recipe, viewerId };
}

export async function generateMetadata({
  params,
}: PageProps<"/recipes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { recipe } = await loadViewable(slug);
  return {
    alternates: { canonical: `/recipes/${recipe.slug}` },
    description: recipe.description ?? undefined,
    robots:
      recipe.visibility === "PUBLIC"
        ? undefined
        : { follow: false, index: false },
    title: recipe.title,
  };
}

function RecipeJsonLd({ recipe }: { recipe: RecipeDetail }) {
  const jsonLd = recipeToJsonLd(
    {
      ...recipe,
      authorName: recipe.author.name ?? recipe.author.handle,
    },
    {
      imageUrl: recipe.coverImageUrl,
      url: absoluteUrl(`/recipes/${recipe.slug}`),
    }
  );
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built from our own data; `<` is escaped by serializeJsonLd.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      type="application/ld+json"
    />
  );
}

function Attribution({ recipe }: { recipe: RecipeDetail }) {
  const author = recipe.author.handle
    ? `@${recipe.author.handle}`
    : recipe.author.name;
  return (
    <p className="text-muted-foreground">
      {author && <>Saved by {author}</>}
      {recipe.sourceName && (
        <>
          {author && " · "}
          Imported from{" "}
          {recipe.sourceUrl ? (
            <a
              className="text-link underline-offset-4 hover:underline"
              href={recipe.sourceUrl}
              rel="noopener nofollow noreferrer"
              target="_blank"
            >
              {recipe.sourceName}
            </a>
          ) : (
            recipe.sourceName
          )}
        </>
      )}
    </p>
  );
}

function RemixBanner({ recipe }: { recipe: RecipeDetail }) {
  const source = recipe.forkedFrom;
  if (!source) {
    return null;
  }
  const by = source.authorHandle
    ? `@${source.authorHandle}`
    : source.authorName;
  return (
    <p className="mb-6 rounded-2xl bg-muted px-4 py-3 text-muted-foreground text-sm">
      Remixed from{" "}
      {source.visibility === "PRIVATE" ? (
        source.title
      ) : (
        <Link
          className="text-link hover:underline"
          href={`/recipes/${source.slug}`}
        >
          {source.title}
        </Link>
      )}
      {by && <> by {by}</>}
    </p>
  );
}

function Steps({ steps }: { steps: RecipeDetail["steps"] }) {
  if (!steps.length) {
    return <p className="text-muted-foreground">No steps yet.</p>;
  }
  let number = 0;
  return (
    <div className="space-y-8">
      {groupBySection(steps).map((group, index) => (
        <div key={`${group.section ?? "main"}-${index}`}>
          {group.section && (
            <h3 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              {group.section}
            </h3>
          )}
          <ol className="space-y-5">
            {group.items.map((step) => {
              number += 1;
              return (
                <li className="flex gap-4" key={step.id}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
                    {number}
                  </span>
                  <p className="whitespace-pre-line pt-1 leading-relaxed">
                    {step.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function TrackingActions({
  intent,
  recipe,
  state,
}: {
  intent: string | undefined;
  recipe: RecipeDetail;
  state: ViewerRecipeState | null;
}) {
  const here = `/recipes/${recipe.slug}`;
  if (!state) {
    return (
      <>
        <Link
          className={buttonClass({ variant: "outline" })}
          href={signInPath(`${here}?intent=save`)}
        >
          Save
        </Link>
        <Link
          className={buttonClass({ variant: "outline" })}
          href={signInPath(`${here}?intent=cooked`)}
        >
          I cooked this
        </Link>
      </>
    );
  }
  return (
    <>
      <FavoriteButton favorited={state.favorited} recipeId={recipe.id} />
      <CookLogDialog
        defaultOpen={intent === "cooked"}
        recipeId={recipe.id}
        servings={recipe.servings}
        triggerLabel="I cooked this"
      />
    </>
  );
}

function YourKitchen({
  recipe,
  state,
}: {
  recipe: RecipeDetail;
  state: ViewerRecipeState;
}) {
  return (
    <section
      aria-labelledby="your-kitchen-heading"
      className="space-y-4 rounded-3xl bg-muted/50 p-5"
    >
      <h2 className="font-heading text-2xl" id="your-kitchen-heading">
        Your notes
      </h2>
      <RecipeNote initial={state.note} recipeId={recipe.id} />
      <div className="space-y-1 text-sm">
        <h3 className="font-medium">Your history</h3>
        {state.cookCount ? (
          <>
            <p className="text-muted-foreground">
              Cooked {state.cookCount}{" "}
              {state.cookCount === 1 ? "time" : "times"}, last on{" "}
              {state.lastCookedAt
                ? DATE_FORMAT.format(state.lastCookedAt)
                : "unknown"}
            </p>
            {state.latestRating && (
              <p className="flex items-center gap-2 text-muted-foreground">
                Your latest rating <Stars rating={state.latestRating} />
              </p>
            )}
            <Link
              className="text-link hover:underline"
              href={`/me/cooked?recipe=${recipe.id}`}
            >
              See all your logs
            </Link>
          </>
        ) : (
          <p className="text-muted-foreground">
            You haven&apos;t logged this one yet.
          </p>
        )}
      </div>
    </section>
  );
}

export default async function RecipePage({
  params,
  searchParams,
}: PageProps<"/recipes/[slug]">) {
  const { slug } = await params;
  const { intent, saved } = await searchParams;
  const { recipe, viewerId } = await loadViewable(slug);
  const isOwner = viewerId === recipe.author.id;
  const state = viewerId
    ? await getViewerRecipeState(viewerId, recipe.id)
    : null;
  const intentValue = typeof intent === "string" ? intent : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      {recipe.visibility === "PUBLIC" && <RecipeJsonLd recipe={recipe} />}
      {isOwner && (
        <SavedToast saved={typeof saved === "string" ? saved : undefined} />
      )}
      {state && (
        <IntentReplay
          favorited={state.favorited}
          intent={intentValue}
          recipeId={recipe.id}
        />
      )}
      <RemixBanner recipe={recipe} />
      <header className="grid gap-8 md:grid-cols-[1fr_minmax(0,22rem)]">
        <div className="space-y-5">
          {isOwner && <VisibilityBadge visibility={recipe.visibility} />}
          <h1 className="font-heading text-5xl leading-tight">
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="text-lg text-muted-foreground">
              {recipe.description}
            </p>
          )}
          <Attribution recipe={recipe} />
          <RecipeTimes {...recipe} />
          {recipe.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <li key={tag.slug}>
                  <Badge variant="secondary">{tag.name}</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <TrackingActions
              intent={intentValue}
              recipe={recipe}
              state={state}
            />
            {isOwner ? (
              <>
                <Link
                  className={buttonClass({ variant: "outline" })}
                  href={`/recipes/${recipe.slug}/edit`}
                >
                  Edit
                </Link>
                <SharingDialog
                  imported={recipe.sourceType === "URL_IMPORT"}
                  recipeId={recipe.id}
                  visibility={recipe.visibility}
                />
                <DeleteRecipeButton recipeId={recipe.id} title={recipe.title} />
              </>
            ) : (
              viewerId && (
                <RemixButton recipeId={recipe.id} slug={recipe.slug} />
              )
            )}
          </div>
        </div>
        {recipe.coverImageUrl && (
          // biome-ignore lint/correctness/useImageSize: imported covers are hotlinked from arbitrary hosts with unknown dimensions.
          <img
            alt=""
            className="aspect-4/3 w-full rounded-3xl object-cover"
            referrerPolicy="no-referrer"
            src={recipe.coverImageUrl}
          />
        )}
      </header>
      <div className="mt-12 grid gap-12 md:grid-cols-[minmax(0,20rem)_1fr]">
        <div className="space-y-8">
          <IngredientsCard
            baseServings={recipe.servings}
            ingredients={recipe.ingredients}
            slug={recipe.slug}
          />
          {state && <YourKitchen recipe={recipe} state={state} />}
        </div>
        <section aria-labelledby="steps-heading" className="space-y-4">
          <h2 className="font-heading text-3xl" id="steps-heading">
            Steps
          </h2>
          <Steps steps={recipe.steps} />
        </section>
      </div>
    </main>
  );
}
