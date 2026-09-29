"use client";

import type { IngredientLineView } from "@workspace-template/database/recipes";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/lib/button-class";
import { IngredientList, ServingsStepper } from "./ingredient-panel";

/** The detail page's ingredient column: servings stepper plus scaled list. */
export function IngredientsCard({
  baseServings,
  ingredients,
  slug,
}: {
  baseServings: number | null;
  ingredients: IngredientLineView[];
  slug: string;
}) {
  const [servings, setServings] = useState(baseServings);
  return (
    <section aria-labelledby="ingredients-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-3xl" id="ingredients-heading">
          Ingredients
        </h2>
        {servings !== null && (
          <ServingsStepper onChange={setServings} servings={servings} />
        )}
      </div>
      {ingredients.length ? (
        <IngredientList
          baseServings={baseServings}
          ingredients={ingredients}
          servings={servings}
        />
      ) : (
        <p className="text-muted-foreground">No ingredients listed.</p>
      )}
      <Link
        className={buttonClass({ className: "w-full", size: "lg" })}
        href={
          `/recipes/${slug}/cook${servings ? `?servings=${servings}` : ""}` as Route
        }
      >
        Start cooking
      </Link>
    </section>
  );
}
