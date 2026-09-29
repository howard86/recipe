"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ListNumbersIcon,
  SunIcon,
  XIcon,
} from "@phosphor-icons/react";
import { scaleLine } from "@workspace-template/data/recipe/ingredient";
import { ingredientsForStep } from "@workspace-template/data/recipe/match";
import type { RecipeDetail } from "@workspace-template/database/recipes";
import { Button } from "@workspace-template/ui/components/button";
import { cn } from "@workspace-template/ui/lib/utils";
import Link from "next/link";
import { type TouchEvent, useEffect, useRef, useState } from "react";
import { useWakeLock } from "./use-wake-lock";

export interface CookRecipe {
  id: string;
  ingredients: RecipeDetail["ingredients"];
  servings: number | null;
  slug: string;
  steps: RecipeDetail["steps"];
  title: string;
}

interface CookProgress {
  checked: string[];
  step: number;
}

const SWIPE_THRESHOLD = 50;

function storageKey(recipeId: string) {
  return `cook:${recipeId}`;
}

function readProgress(recipeId: string): CookProgress | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(recipeId));
    return raw ? (JSON.parse(raw) as CookProgress) : null;
  } catch {
    return null;
  }
}

function writeProgress(recipeId: string, progress: CookProgress) {
  try {
    window.sessionStorage.setItem(
      storageKey(recipeId),
      JSON.stringify(progress)
    );
  } catch {
    // Storage can be unavailable (private mode); progress just won't survive a refresh.
  }
}

function WakeLockNote() {
  const status = useWakeLock();
  if (status === "pending") {
    return null;
  }
  return (
    <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
      <SunIcon className="size-4" />
      {status === "active"
        ? "Screen will stay on"
        : "Your screen may dim; this browser can't keep it awake"}
    </p>
  );
}

function IngredientChecklist({
  checked,
  factor,
  ingredients,
  onToggle,
  relevant,
}: {
  checked: Set<string>;
  factor: number;
  ingredients: CookRecipe["ingredients"];
  onToggle: (id: string) => void;
  relevant: number[];
}) {
  const [showAll, setShowAll] = useState(false);
  const filtered = relevant.length > 0 && !showAll;
  const visible = filtered
    ? relevant.map((index) => ingredients[index])
    : ingredients;
  return (
    <section aria-label="Ingredients" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-2xl">
          {filtered ? "For this step" : "Ingredients"}
        </h2>
        {relevant.length > 0 && (
          <Button
            onClick={() => setShowAll(!showAll)}
            size="sm"
            variant="ghost"
          >
            {showAll ? "This step only" : "Show all"}
          </Button>
        )}
      </div>
      <ul className="space-y-1">
        {visible.map((line) => {
          if (!line) {
            return null;
          }
          const done = checked.has(line.id);
          return (
            <li key={line.id}>
              <button
                aria-pressed={done}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left text-lg hover:bg-muted",
                  done && "text-muted-foreground line-through"
                )}
                onClick={() => onToggle(line.id)}
                type="button"
              >
                <span
                  className={cn(
                    "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    done && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {done && <CheckIcon className="size-3" />}
                </span>
                {scaleLine(line, factor).text}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StepDrawer({
  current,
  onClose,
  onSelect,
  steps,
}: {
  current: number;
  onClose: () => void;
  onSelect: (index: number) => void;
  steps: CookRecipe["steps"];
}) {
  return (
    <nav aria-label="All steps" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl">All steps</h2>
        <Button
          aria-label="Close step list"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>
      <ol className="space-y-1">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              aria-current={index === current ? "step" : undefined}
              className={cn(
                "w-full rounded-2xl px-3 py-2 text-left hover:bg-muted",
                index === current && "bg-muted font-medium"
              )}
              onClick={() => onSelect(index)}
              type="button"
            >
              <span className="mr-2 text-muted-foreground">{index + 1}.</span>
              <span className="line-clamp-2">{step.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function CookMode({
  recipe,
  servings,
}: {
  recipe: CookRecipe;
  servings: number | null;
}) {
  const total = recipe.steps.length;
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const touchStart = useRef<number | null>(null);
  const factor = recipe.servings && servings ? servings / recipe.servings : 1;
  const finished = step >= total;
  const current = recipe.steps[step];

  useEffect(() => {
    const saved = readProgress(recipe.id);
    if (saved) {
      setStep(Math.min(Math.max(saved.step, 0), total));
      setChecked(new Set(saved.checked));
    }
    setRestored(true);
  }, [recipe.id, total]);

  useEffect(() => {
    if (restored) {
      writeProgress(recipe.id, { checked: [...checked], step });
    }
  }, [checked, recipe.id, restored, step]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=dialog]")) {
        return;
      }
      if (event.key === "ArrowRight") {
        setStep((value) => Math.min(value + 1, total));
      } else if (event.key === "ArrowLeft") {
        setStep((value) => Math.max(value - 1, 0));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total]);

  function toggle(id: string) {
    setChecked((currentSet) => {
      const next = new Set(currentSet);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function onTouchStart(event: TouchEvent) {
    touchStart.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchStart.current;
    const end = event.changedTouches[0]?.clientX;
    touchStart.current = null;
    if (
      start === null ||
      end === undefined ||
      Math.abs(end - start) < SWIPE_THRESHOLD
    ) {
      return;
    }
    setStep((value) =>
      end < start ? Math.min(value + 1, total) : Math.max(value - 1, 0)
    );
  }

  const relevant = current
    ? ingredientsForStep(current.text, recipe.ingredients)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Link
          aria-label="Exit cook mode"
          className="rounded-full p-2 hover:bg-muted"
          href={`/recipes/${recipe.slug}`}
        >
          <XIcon className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl">{recipe.title}</p>
          <WakeLockNote />
        </div>
        {total > 0 && (
          <Button onClick={() => setDrawerOpen(!drawerOpen)} variant="outline">
            <ListNumbersIcon data-icon="inline-start" />
            Steps
          </Button>
        )}
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_24rem]">
        <main
          className="flex flex-col justify-center gap-6 px-6 py-10 md:px-16"
          onTouchEnd={onTouchEnd}
          onTouchStart={onTouchStart}
        >
          {finished || !current ? (
            <div className="space-y-6 text-center">
              <p className="font-heading text-5xl">
                {total ? "That's everything." : "No steps yet."}
              </p>
              <p className="text-lg text-muted-foreground">Enjoy your meal.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  href={`/recipes/${recipe.slug}`}
                >
                  Back to the recipe
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground">
                Step {step + 1} of {total}
                {current.section && ` · ${current.section}`}
              </p>
              <p
                aria-live="polite"
                className="whitespace-pre-line text-3xl leading-snug md:text-4xl"
              >
                {current.text}
              </p>
            </>
          )}
        </main>
        <aside className="space-y-6 border-t p-4 lg:border-t-0 lg:border-l">
          {drawerOpen ? (
            <StepDrawer
              current={step}
              onClose={() => setDrawerOpen(false)}
              onSelect={(index) => {
                setStep(index);
                setDrawerOpen(false);
              }}
              steps={recipe.steps}
            />
          ) : (
            <IngredientChecklist
              checked={checked}
              factor={factor}
              ingredients={recipe.ingredients}
              onToggle={toggle}
              relevant={finished ? [] : relevant}
            />
          )}
        </aside>
      </div>

      <footer className="flex items-center gap-3 border-t px-4 py-3">
        <Button
          className="flex-1"
          disabled={step === 0}
          onClick={() => setStep(Math.max(step - 1, 0))}
          size="lg"
          variant="outline"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <Button
          className="flex-1"
          disabled={finished}
          onClick={() => setStep(Math.min(step + 1, total))}
          size="lg"
        >
          {step === total - 1 ? "Finish" : "Next"}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </footer>
    </div>
  );
}
