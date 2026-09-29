import {
  type CookLogEntry,
  listCookedRecipes,
  listCookLogs,
} from "@workspace-template/database/tracking";
import { Button } from "@workspace-template/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace-template/ui/components/empty";
import type { Metadata } from "next";
import Link from "next/link";
import { CookLogEntryActions } from "@/components/tracking/cook-log-entry-actions";
import { Stars } from "@/components/tracking/stars";
import { buttonClass } from "@/lib/button-class";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Cook log" };

const MONTH_FORMAT = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const DAY_FORMAT = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  weekday: "short",
});
const SELECT_CLASS =
  "h-8 rounded-2xl border border-input bg-transparent px-3 text-sm";

function groupByMonth(logs: CookLogEntry[]) {
  const groups = new Map<string, CookLogEntry[]>();
  for (const log of logs) {
    const key = MONTH_FORMAT.format(log.cookedAt);
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }
  return [...groups];
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function Entry({ log }: { log: CookLogEntry }) {
  return (
    <li className="flex gap-4 py-4">
      {log.recipe.coverImageUrl ? (
        // biome-ignore lint/correctness/useImageSize: imported covers are hotlinked from arbitrary hosts with unknown dimensions.
        <img
          alt=""
          className="size-16 shrink-0 rounded-2xl object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={log.recipe.coverImageUrl}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted font-heading text-2xl text-muted-foreground/50"
        >
          {log.recipe.title.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            className="font-medium hover:underline"
            href={`/recipes/${log.recipe.slug}`}
          >
            {log.recipe.title}
          </Link>
          <Stars rating={log.rating} />
        </div>
        <p className="text-muted-foreground text-sm">
          {DAY_FORMAT.format(log.cookedAt)}
          {log.servingsMade && ` · ${log.servingsMade} servings`}
        </p>
        {log.notes && <p className="line-clamp-2 text-sm">{log.notes}</p>}
      </div>
      <CookLogEntryActions
        log={{
          cookedAt: log.cookedAt.toISOString().slice(0, 10),
          id: log.id,
          notes: log.notes ?? "",
          rating: log.rating,
          servingsMade: log.servingsMade,
        }}
        recipeId={log.recipe.id}
      />
    </li>
  );
}

export default async function CookedPage({
  searchParams,
}: PageProps<"/me/cooked">) {
  const user = await requireUser("/me/cooked");
  const params = await searchParams;
  const recipeId = one(params.recipe) || undefined;
  const minRating = Number.parseInt(one(params.rating) ?? "", 10) || undefined;
  const [logs, recipes] = await Promise.all([
    listCookLogs(user.id, { minRating, recipeId }),
    listCookedRecipes(user.id),
  ]);
  const filtered = Boolean(recipeId || minRating);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <div>
        <h1 className="font-heading text-5xl">Cook log</h1>
        <p className="mt-1 text-muted-foreground">
          Everything you&apos;ve made, newest first.
        </p>
      </div>
      {recipes.length > 0 && (
        <form className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Recipe"
            className={SELECT_CLASS}
            defaultValue={recipeId ?? ""}
            name="recipe"
          >
            <option value="">All recipes</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Rating"
            className={SELECT_CLASS}
            defaultValue={minRating ?? ""}
            name="rating"
          >
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((stars) => (
              <option key={stars} value={stars}>
                {stars === 5 ? "5 stars" : `${stars}+ stars`}
              </option>
            ))}
          </select>
          <Button size="sm" type="submit" variant="outline">
            Filter
          </Button>
          {filtered && (
            <Link
              className={buttonClass({ size: "sm", variant: "ghost" })}
              href="/me/cooked"
            >
              Clear
            </Link>
          )}
        </form>
      )}
      {logs.length ? (
        groupByMonth(logs).map(([month, entries]) => (
          <section aria-label={month} key={month}>
            <h2 className="border-b pb-2 font-heading text-2xl">{month}</h2>
            <ul className="divide-y">
              {entries.map((log) => (
                <Entry key={log.id} log={log} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle className="font-heading text-2xl">
              {filtered ? "No cooks match" : "No cooks logged yet"}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try another recipe or rating."
                : "Pick something you saved and tap “I cooked this” when you're done."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link className={buttonClass()} href="/me?tab=saved">
              Go to saved recipes
            </Link>
          </EmptyContent>
        </Empty>
      )}
    </main>
  );
}
