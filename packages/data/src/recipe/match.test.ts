import { expect, test } from "bun:test";
import { ingredientsForStep } from "./match";

const ingredients = [
  { name: "olive oil", raw: "2 tbsp olive oil" },
  { name: "onion", raw: "1 onion, diced" },
  { name: "canned tomatoes", raw: "28 oz canned tomatoes" },
  { name: null, raw: "Salt to taste" },
];

test("matches ingredient names in the step, including plurals", () => {
  expect(
    ingredientsForStep("Soften the onions in the oil.", ingredients)
  ).toEqual([0, 1]);
  expect(
    ingredientsForStep("Add the tomato and season with salt.", ingredients)
  ).toEqual([2, 3]);
});

test("returns nothing when no name matches", () => {
  expect(ingredientsForStep("Preheat the oven.", ingredients)).toEqual([]);
});
