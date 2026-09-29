import { getProfile } from "@workspace-template/database/profiles";
import { listRecipesByAuthor } from "@workspace-template/database/recipes";
import {
  listCookLogs,
  listFavorites,
} from "@workspace-template/database/tracking";
import { Button } from "@workspace-template/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace-template/ui/components/empty";
import { Input } from "@workspace-template/ui/components/input";
import { Skeleton } from "@workspace-template/ui/components/skeleton";
import { cn } from "@workspace-template/ui/lib/utils";
import type { Metadata, Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { RecipeGrid } from "@/components/recipe/recipe-card";
import { Stars } from "@/components/tracking/stars";
import { buttonClass } from "@/lib/button-class";
import { HANDLE_BANNER_COOKIE } from "@/lib/handle-banner";
import { requireUser } from "@/lib/session";
import { HandleBanner } from "./handle-banner";

export const metadata: Metadata = { title: "My kitchen" };

const TABS = [
  { label: "My recipes", value: "recipes" },
  { label: "Saved", value: "saved" },
  { label: "Recently cooked", value: "cooked" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function EmptyState({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle className="font-heading text-2xl">{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

async function MyRecipes({ userId }: { userId: string }) {
  const recipes = await listRecipesByAuthor(userId);
  if (!recipes.length) {
    return (
      <EmptyState
        action={
          <Link className={buttonClass()} href="/recipes/new">
            Add a recipe
          </Link>
        }
        title="No recipes yet"
      >
        Paste a link or write one down. It stays private until you share it.
      </EmptyState>
    );
  }
  return <RecipeGrid recipes={recipes} showVisibility />;
}

async function SavedRecipes({ userId }: { userId: string }) {
  const recipes = await listFavorites(userId);
  if (!recipes.length) {
    return (
      <EmptyState title="Nothing saved yet">
        Tap Save on any recipe to keep it here.
      </EmptyState>
    );
  }
  return <RecipeGrid recipes={recipes} />;
}

async function RecentlyCooked({ userId }: { userId: string }) {
  const logs = await listCookLogs(userId, { limit: 12 });
  if (!logs.length) {
    return (
      <EmptyState title="No cooks logged">
        Use “I cooked this” on a recipe to start your cook log.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-3xl border">
        {logs.map((log) => (
          <li className="flex items-center gap-4 px-5 py-3" key={log.id}>
            <span className="w-16 shrink-0 text-muted-foreground text-sm">
              {DATE_FORMAT.format(log.cookedAt)}
            </span>
            <Link
              className="min-w-0 flex-1 truncate font-medium hover:underline"
              href={`/recipes/${log.recipe.slug}`}
            >
              {log.recipe.title}
            </Link>
            <Stars rating={log.rating} />
          </li>
        ))}
      </ul>
      <Link className="text-primary hover:underline" href="/me/cooked">
        See your full cook log
      </Link>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((key) => (
        <Skeleton className="aspect-4/3 rounded-3xl" key={key} />
      ))}
    </div>
  );
}

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const user = await requireUser("/me");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((item) => item.value === tabParam)
    ? (tabParam as Tab)
    : "recipes";
  const [profile, cookieStore] = await Promise.all([
    getProfile(user.id),
    cookies(),
  ]);
  const showBanner = profile && !cookieStore.get(HANDLE_BANNER_COOKIE);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <div>
        <h1 className="font-heading text-5xl">My kitchen</h1>
        {profile && (
          <p className="mt-1 text-muted-foreground">@{profile.handle}</p>
        )}
      </div>
      {showBanner && <HandleBanner handle={profile.handle} />}
      <search>
        <form action="/recipes" className="flex max-w-xl gap-2">
          <input name="mine" type="hidden" value="1" />
          <Input
            aria-label="Search my recipes"
            name="q"
            placeholder="Search my recipes"
            type="search"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </search>
      <nav aria-label="My kitchen sections" className="flex gap-1 border-b">
        {TABS.map((item) => (
          <Link
            aria-current={item.value === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-transparent border-b-2 px-4 py-2 text-muted-foreground hover:text-foreground",
              item.value === tab && "border-primary text-foreground"
            )}
            href={`/me?tab=${item.value}` as Route}
            key={item.value}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<GridSkeleton />} key={tab}>
        {tab === "recipes" && <MyRecipes userId={user.id} />}
        {tab === "saved" && <SavedRecipes userId={user.id} />}
        {tab === "cooked" && <RecentlyCooked userId={user.id} />}
      </Suspense>
    </main>
  );
}
