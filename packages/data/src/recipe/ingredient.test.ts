import { describe, expect, test } from "bun:test";
import {
  formatLine,
  formatQuantity,
  parseIngredient,
  parseQuantity,
  scaleLine,
} from "./ingredient";

describe("parseIngredient", () => {
  test("mixed number, unit, parenthetical and note", () => {
    expect(parseIngredient("1 1/2 cups (190g) flour, sifted")).toEqual({
      confidence: "high",
      name: "flour",
      note: "190g, sifted",
      quantity: 1.5,
      quantityMax: null,
      unit: "cup",
    });
  });

  test("unicode fractions and attached units", () => {
    expect(parseIngredient("1½ tsp salt")).toMatchObject({
      quantity: 1.5,
      unit: "tsp",
    });
    expect(parseIngredient("200g butter")).toMatchObject({
      name: "butter",
      quantity: 200,
      unit: "g",
    });
  });

  test("ranges", () => {
    expect(parseIngredient("2 to 3 cloves garlic")).toMatchObject({
      name: "garlic",
      quantity: 2,
      quantityMax: 3,
      unit: "clove",
    });
    expect(parseIngredient("1-2 tbsp olive oil")).toMatchObject({
      quantity: 1,
      quantityMax: 2,
    });
  });

  test("articles and 'of'", () => {
    expect(parseIngredient("a pinch of salt")).toMatchObject({
      name: "salt",
      quantity: 1,
      unit: "pinch",
    });
  });

  test("two-word units", () => {
    expect(parseIngredient("4 fl oz cream")).toMatchObject({
      name: "cream",
      unit: "fl oz",
    });
  });

  test("unquantified lines stay high confidence; stray numbers are low", () => {
    expect(parseIngredient("Salt to taste")).toMatchObject({
      confidence: "high",
      quantity: null,
    });
    expect(parseIngredient("Juice of 2 lemons").confidence).toBe("low");
  });
});

describe("quantities", () => {
  test("parseQuantity", () => {
    expect(parseQuantity("3/4")).toBe(0.75);
    expect(parseQuantity("2,5")).toBe(2.5);
    expect(parseQuantity("1/0")).toBeNull();
  });

  test("formatQuantity renders vulgar fractions", () => {
    expect(formatQuantity(1.5)).toBe("1½");
    expect(formatQuantity(0.333)).toBe("⅓");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(2.4)).toBe("2.4");
    expect(formatQuantity(0.99)).toBe("1");
  });

  test("scaleLine", () => {
    const line = {
      name: "flour",
      note: "sifted",
      quantity: 1,
      raw: "1 cup flour, sifted",
      unit: "cup",
    };
    expect(scaleLine(line, 1)).toEqual({
      scaled: true,
      text: "1 cup flour, sifted",
    });
    expect(scaleLine(line, 1.5)).toEqual({
      scaled: true,
      text: "1½ cups flour, sifted",
    });
    expect(scaleLine({ raw: "Salt to taste" }, 2)).toEqual({
      scaled: false,
      text: "Salt to taste",
    });
  });

  test("formatLine rebuilds the parse", () => {
    const parsed = parseIngredient("2-3 cloves garlic, minced");
    expect(
      formatLine({ ...parsed, quantity: parsed.quantity ?? 0, raw: "" })
    ).toBe("2–3 cloves garlic, minced");
  });
});
