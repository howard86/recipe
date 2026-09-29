"use client";

import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { scaleLine } from "@workspace-template/data/recipe/ingredient";
import { groupBySection } from "@workspace-template/data/recipe/sections";
import type { IngredientLineView } from "@workspace-template/database/recipes";
import { Button } from "@workspace-template/ui/components/button";

export function ServingsStepper({
  onChange,
  servings,
}: {
  onChange: (servings: number) => void;
  servings: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label="Fewer servings"
        disabled={servings <= 1}
        onClick={() => onChange(servings - 1)}
        size="icon-sm"
        variant="outline"
      >
        <MinusIcon />
      </Button>
      <span aria-live="polite" className="min-w-20 text-center text-sm">
        {servings} {servings === 1 ? "serving" : "servings"}
      </span>
      <Button
        aria-label="More servings"
        disabled={servings >= 100}
        onClick={() => onChange(servings + 1)}
        size="icon-sm"
        variant="outline"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

/**
 * Ingredients grouped by section, scaled linearly by `servings / baseServings`.
 * Lines without a parsed quantity stay as written and get a "not scaled" mark.
 */
export function IngredientList({
  baseServings,
  ingredients,
  servings,
}: {
  baseServings: number | null;
  ingredients: IngredientLineView[];
  servings: number | null;
}) {
  const factor = baseServings && servings ? servings / baseServings : 1;
  return (
    <div className="space-y-5">
      {groupBySection(ingredients).map((group, index) => (
        <div key={`${group.section ?? "main"}-${index}`}>
          {group.section && (
            <h3 className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              {group.section}
            </h3>
          )}
          <ul className="space-y-2">
            {group.items.map((line) => {
              const { scaled, text } = scaleLine(line, factor);
              return (
                <li className="leading-snug" key={line.id}>
                  {text}
                  {!scaled && factor !== 1 && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      not scaled
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
