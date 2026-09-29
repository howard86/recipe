import { describe, expect, test } from "bun:test";
import {
  createHandle,
  createRecipeSlug,
  HANDLE_PATTERN,
  slugify,
} from "./slug";

const GARLIC_SLUG = /^garlic-noodles-[a-z0-9]{6}$/;
const FALLBACK_SLUG = /^recipe-[a-z0-9]{6}$/;

describe("slugs", () => {
  test("slugify strips diacritics and punctuation", () => {
    expect(slugify("  Crème Brûlée!! (Easy) ")).toBe("creme-brulee-easy");
  });

  test("recipe slugs carry a 6 character suffix", () => {
    expect(createRecipeSlug("Garlic Noodles")).toMatch(GARLIC_SLUG);
    expect(createRecipeSlug("!!!")).toMatch(FALLBACK_SLUG);
  });

  test("generated handles are valid handles", () => {
    expect(createHandle("jane.doe@example.com")).toMatch(HANDLE_PATTERN);
    expect(createHandle("")).toMatch(HANDLE_PATTERN);
  });
});
