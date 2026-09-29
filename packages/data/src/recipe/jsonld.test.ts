import { describe, expect, test } from "bun:test";
import {
  extractRecipe,
  flattenInstructions,
  looksPaywalled,
  pickImage,
  recipeToJsonLd,
  serializeJsonLd,
} from "./jsonld";

const PAGE = "https://www.example.com/recipes/noodles";

function page(jsonLd: unknown): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
}

describe("extractRecipe", () => {
  test("finds a Recipe inside @graph with an array @type", () => {
    const html = page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "ignored" },
        {
          "@type": ["Recipe", "NewsArticle"],
          author: [{ "@type": "Person", name: "Ana Cook" }],
          cookTime: "PT20M",
          description: "Quick &amp; <b>garlicky</b>",
          image: [
            { "@type": "ImageObject", url: "/small.jpg", width: 300 },
            { "@type": "ImageObject", url: "/large.jpg", width: 1200 },
          ],
          keywords: "weeknight, noodles",
          name: "Garlic Noodles",
          prepTime: "PT10M",
          recipeCuisine: "Asian",
          recipeIngredient: ["8 oz noodles", "4 cloves garlic, minced"],
          recipeInstructions: [
            {
              "@type": "HowToSection",
              itemListElement: [
                { "@type": "HowToStep", text: "Step 1: Boil noodles." },
              ],
              name: "Noodles",
            },
            { "@type": "HowToStep", text: "Toss with garlic." },
          ],
          recipeYield: ["4", "4 servings"],
          suitableForDiet: "https://schema.org/VegetarianDiet",
        },
      ],
    });
    const recipe = extractRecipe(html, PAGE);
    expect(recipe).toMatchObject({
      cookMinutes: 20,
      description: "Quick & garlicky",
      imageUrl: "https://www.example.com/large.jpg",
      prepMinutes: 10,
      servings: 4,
      sourceName: "Ana Cook",
      title: "Garlic Noodles",
      totalMinutes: 30,
      yieldText: "4 servings",
    });
    expect(recipe?.steps).toEqual([
      { section: "Noodles", text: "Boil noodles." },
      { section: null, text: "Toss with garlic." },
    ]);
    expect(recipe?.ingredients[1]).toMatchObject({
      name: "garlic",
      note: "minced",
      quantity: 4,
      raw: "4 cloves garlic, minced",
      unit: "clove",
    });
    expect(recipe?.tags).toEqual([
      { kind: "CUISINE", name: "Asian" },
      { kind: "DIET", name: "Vegetarian" },
      { kind: "GENERAL", name: "weeknight" },
      { kind: "GENERAL", name: "noodles" },
    ]);
  });

  test("skips malformed blocks and falls back to the hostname", () => {
    const html = `<script type="application/ld+json">{oops</script>${page({
      "@type": "Recipe",
      name: "Toast",
      recipeInstructions: "1. Toast bread.\n2. Butter it.",
    })}`;
    const recipe = extractRecipe(html, PAGE);
    expect(recipe?.sourceName).toBe("example.com");
    expect(recipe?.steps.map((step) => step.text)).toEqual([
      "Toast bread.",
      "Butter it.",
    ]);
  });

  test("returns null without a recipe", () => {
    expect(
      extractRecipe(page({ "@type": "Article", name: "News" }), PAGE)
    ).toBeNull();
    expect(extractRecipe("<html></html>", PAGE)).toBeNull();
  });
});

describe("helpers", () => {
  test("pickImage handles strings and rejects non-http", () => {
    expect(pickImage("https://cdn.example.com/a.jpg", PAGE)).toBe(
      "https://cdn.example.com/a.jpg"
    );
    expect(pickImage("javascript:alert(1)", PAGE)).toBeNull();
  });

  test("flattenInstructions strips labels", () => {
    expect(flattenInstructions(["Directions", "Mix."])).toEqual([
      { section: null, text: "Mix." },
    ]);
  });

  test("keywords split on commas and semicolons", () => {
    const recipe = extractRecipe(
      page({
        "@type": "Recipe",
        keywords: "Bread;;Tangzhong, soft",
        name: "Loaf",
      }),
      PAGE
    );
    expect(recipe?.tags.map((tag) => tag.name)).toEqual([
      "Bread",
      "Tangzhong",
      "soft",
    ]);
  });

  test("looksPaywalled", () => {
    expect(looksPaywalled('<form><input type="password"></form>')).toBe(true);
    expect(looksPaywalled("<p>hello</p>")).toBe(false);
  });
});

describe("recipeToJsonLd", () => {
  test("emits HowToStep and HowToSection with ISO durations", () => {
    const jsonLd = recipeToJsonLd(
      {
        authorName: "Ana",
        cookMinutes: 20,
        description: null,
        ingredients: [{ raw: "8 oz noodles" }],
        prepMinutes: 10,
        publishedAt: new Date("2026-09-01T12:00:00Z"),
        servings: 4,
        steps: [
          { section: null, text: "Boil." },
          { section: "Sauce", text: "Fry garlic." },
          { section: "Sauce", text: "Add soy." },
        ],
        tags: [
          { kind: "DIET", name: "Vegetarian" },
          { kind: "GENERAL", name: "quick" },
        ],
        title: "Noodles",
        totalMinutes: 30,
        yieldText: null,
      },
      { url: "https://recipes.test/recipes/noodles-abc123" }
    );
    expect(jsonLd).toMatchObject({
      cookTime: "PT20M",
      datePublished: "2026-09-01",
      keywords: "quick",
      recipeInstructions: [
        { "@type": "HowToStep", text: "Boil." },
        {
          "@type": "HowToSection",
          itemListElement: [
            { "@type": "HowToStep", text: "Fry garlic." },
            { "@type": "HowToStep", text: "Add soy." },
          ],
          name: "Sauce",
        },
      ],
      recipeYield: "4",
      suitableForDiet: ["https://schema.org/VegetarianDiet"],
      totalTime: "PT30M",
    });
  });

  test("serializeJsonLd escapes script-closing markup", () => {
    expect(serializeJsonLd({ name: "</script>" })).not.toContain("</script>");
  });
});
