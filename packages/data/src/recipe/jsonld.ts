import type {
  HowToSection,
  HowToStep,
  Recipe,
  RestrictedDiet,
  WithContext,
} from "schema-dts";
import { parseDuration, toIsoDuration } from "./duration";
import { cleanText } from "./html";
import { type ParsedIngredient, parseIngredient } from "./ingredient";
import {
  type IngredientLineInput,
  type InstructionStepInput,
  LIMITS,
  type TagInput,
  type TagKind,
} from "./schema";
import { groupBySection } from "./sections";

export interface ExtractedIngredient extends IngredientLineInput {
  confidence: ParsedIngredient["confidence"];
}

/** A normalised draft for the preview/confirm step. Nothing is saved yet. */
export interface ExtractedRecipe {
  cookMinutes: number | null;
  description: string | null;
  imageUrl: string | null;
  importedJsonLd: Record<string, unknown>;
  ingredients: ExtractedIngredient[];
  nutrition: Record<string, string | number> | null;
  prepMinutes: number | null;
  servings: number | null;
  sourceName: string | null;
  sourceUrl: string;
  steps: InstructionStepInput[];
  tags: TagInput[];
  title: string;
  totalMinutes: number | null;
  yieldText: string | null;
}

type JsonObject = Record<string, unknown>;

const JSON_LD_SCRIPT_PATTERN =
  /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
const HTML_COMMENT_PATTERN =
  /^\s*(?:<!--|\/\/\s*<!\[CDATA\[)|(?:-->|\/\/\s*\]\]>)\s*$/g;
const STEP_PREFIX_PATTERN = /^(?:step\s*\d+\s*[:.)-]?|\d+\s*[.)]|\d+\s*:)\s*/i;
const STEP_LABEL_PATTERN = /^(?:directions|instructions|method|steps?)\s*:?$/i;
const FIRST_INTEGER_PATTERN = /\d+/;
const PASSWORD_INPUT_PATTERN = /<input[^>]+type\s*=\s*["']?password/i;
const PAYWALL_COPY_PATTERN =
  /(?:subscribe|sign in|log in)\s+(?:to|for)\s+(?:continue|keep reading|read|access|unlock)/i;
const SCHEMA_PREFIX_PATTERN = /^(?:https?:\/\/schema\.org\/|schema:)/i;
const DIET_SUFFIX_PATTERN = /Diet$/;
const CAMEL_BOUNDARY_PATTERN = /([a-z])([A-Z])/g;
const WWW_PREFIX_PATTERN = /^www\./;
const DIET_SEPARATOR_PATTERN = /[\s-]+/g;
const LESS_THAN_PATTERN = /</g;
const MAX_SEARCH_DEPTH = 6;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function hasType(node: JsonObject, type: string): boolean {
  return toArray(node["@type"]).some(
    (entry) =>
      typeof entry === "string" &&
      (entry === type ||
        entry.endsWith(`/${type}`) ||
        entry === `schema:${type}`)
  );
}

export function findJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of html.matchAll(JSON_LD_SCRIPT_PATTERN)) {
    const body = (match[1] ?? "").replace(HTML_COMMENT_PATTERN, "").trim();
    if (!body) {
      continue;
    }
    try {
      blocks.push(JSON.parse(body));
    } catch {
      // Malformed blocks are common; skip them and keep looking.
    }
  }
  return blocks;
}

export function findRecipeNode(value: unknown, depth = 0): JsonObject | null {
  if (depth > MAX_SEARCH_DEPTH) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!isObject(value)) {
    return null;
  }
  if (hasType(value, "Recipe")) {
    return value;
  }
  for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) {
    const found = findRecipeNode(value[key], depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
}

function resolveUrl(value: unknown, baseUrl: string): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  try {
    const url = new URL(value.trim(), baseUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function readWidth(value: unknown): number {
  if (isObject(value)) {
    return readWidth(value.value);
  }
  const width = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(width) ? width : 0;
}

/** Largest declared width wins; otherwise the first usable image. */
export function pickImage(value: unknown, baseUrl: string): string | null {
  let best: { url: string; width: number } | null = null;
  for (const entry of toArray(value)) {
    const candidate = isObject(entry)
      ? {
          url: resolveUrl(
            entry.url ?? entry.contentUrl ?? entry["@id"],
            baseUrl
          ),
          width: readWidth(entry.width),
        }
      : { url: resolveUrl(entry, baseUrl), width: 0 };
    if (candidate.url && (!best || candidate.width > best.width)) {
      best = { url: candidate.url, width: candidate.width };
    }
  }
  return best?.url ?? null;
}

function cleanStep(text: string): string {
  return text.replace(STEP_PREFIX_PATTERN, "").trim();
}

function stepsFromText(text: string, section: string | null) {
  return cleanText(text, { multiline: true })
    .split("\n")
    .map(cleanStep)
    .filter((line) => line && !STEP_LABEL_PATTERN.test(line))
    .map((line) => ({ section, text: line.slice(0, LIMITS.step) }));
}

/**
 * Flattens every permitted `recipeInstructions` shape (text, text[],
 * HowToStep[], HowToSection[], ItemList) into ordered steps that carry their
 * section name.
 */
export function flattenInstructions(
  value: unknown,
  section: string | null = null
): InstructionStepInput[] {
  if (typeof value === "string") {
    return stepsFromText(value, section);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenInstructions(item, section));
  }
  if (!isObject(value)) {
    return [];
  }
  if (hasType(value, "HowToSection") || value.itemListElement) {
    const name = cleanText(value.name) || section;
    return flattenInstructions(value.itemListElement, name);
  }
  const text = value.text ?? value.description ?? value.name;
  return typeof text === "string" ? stepsFromText(text, section) : [];
}

function readYield(value: unknown) {
  const texts = toArray(value)
    .map((entry) =>
      cleanText(typeof entry === "number" ? String(entry) : entry)
    )
    .filter(Boolean);
  const yieldText =
    texts.reduce<string | null>(
      (longest, text) =>
        !longest || text.length > longest.length ? text : longest,
      null
    ) ?? null;
  const servingsText = texts
    .map((text) => text.match(FIRST_INTEGER_PATTERN)?.[0])
    .find(Boolean);
  const servings = servingsText ? Number.parseInt(servingsText, 10) : null;
  return {
    servings: servings && servings > 0 && servings <= 1000 ? servings : null,
    yieldText: yieldText ? yieldText.slice(0, 100) : null,
  };
}

function readTagNames(value: unknown): string[] {
  return toArray(value)
    .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
    .map((entry) => cleanText(entry))
    .filter(Boolean);
}

function dietName(value: string): string {
  return value
    .replace(SCHEMA_PREFIX_PATTERN, "")
    .replace(DIET_SUFFIX_PATTERN, "")
    .replace(CAMEL_BOUNDARY_PATTERN, "$1 $2");
}

function readTags(node: JsonObject): TagInput[] {
  const tags: TagInput[] = [];
  const seen = new Set<string>();
  const add = (names: string[], kind: TagKind) => {
    for (const name of names) {
      const key = name.toLowerCase();
      if (!seen.has(key) && name.length <= LIMITS.tagName) {
        seen.add(key);
        tags.push({ kind, name });
      }
    }
  };
  add(readTagNames(node.recipeCuisine), "CUISINE");
  add(readTagNames(node.recipeCategory), "COURSE");
  add(readTagNames(node.suitableForDiet).map(dietName), "DIET");
  add(readTagNames(node.keywords), "GENERAL");
  return tags.slice(0, LIMITS.tags);
}

function readName(value: unknown): string | null {
  for (const entry of toArray(value)) {
    const name = cleanText(isObject(entry) ? entry.name : entry);
    if (name) {
      return name.slice(0, 200);
    }
  }
  return null;
}

function readNutrition(value: unknown): Record<string, string | number> | null {
  if (!isObject(value)) {
    return null;
  }
  const nutrition: Record<string, string | number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key.startsWith("@")) {
      continue;
    }
    if (typeof entry === "number") {
      nutrition[key] = entry;
    } else if (typeof entry === "string" && cleanText(entry)) {
      nutrition[key] = cleanText(entry).slice(0, 100);
    }
  }
  return Object.keys(nutrition).length ? nutrition : null;
}

function readIngredients(node: JsonObject): ExtractedIngredient[] {
  return toArray(node.recipeIngredient ?? node.ingredients)
    .map((entry) => cleanText(entry).slice(0, LIMITS.ingredientLine))
    .filter(Boolean)
    .slice(0, LIMITS.lines)
    .map((raw) => ({ raw, section: null, ...parseIngredient(raw) }));
}

export function normaliseRecipeNode(
  node: JsonObject,
  pageUrl: string
): ExtractedRecipe | null {
  const title = cleanText(node.name).slice(0, LIMITS.title);
  if (!title) {
    return null;
  }
  const prepMinutes = parseDuration(node.prepTime);
  const cookMinutes = parseDuration(node.cookTime);
  const hostname = new URL(pageUrl).hostname.replace(WWW_PREFIX_PATTERN, "");
  return {
    cookMinutes,
    description:
      cleanText(node.description).slice(0, LIMITS.description) || null,
    imageUrl: pickImage(node.image, pageUrl),
    importedJsonLd: node,
    ingredients: readIngredients(node),
    nutrition: readNutrition(node.nutrition),
    prepMinutes,
    ...readYield(node.recipeYield),
    sourceName: readName(node.author) ?? readName(node.publisher) ?? hostname,
    sourceUrl: pageUrl,
    steps: flattenInstructions(node.recipeInstructions).slice(0, LIMITS.lines),
    tags: readTags(node),
    title,
    totalMinutes:
      parseDuration(node.totalTime) ??
      (prepMinutes || cookMinutes
        ? (prepMinutes ?? 0) + (cookMinutes ?? 0)
        : null),
  };
}

/** Finds and normalises the first schema.org Recipe in a page's JSON-LD. */
export function extractRecipe(
  html: string,
  pageUrl: string
): ExtractedRecipe | null {
  const node = findRecipeNode(findJsonLdBlocks(html));
  return node ? normaliseRecipeNode(node, pageUrl) : null;
}

/** Heuristic for `PAYWALLED`: no recipe markup and a login wall. */
export function looksPaywalled(html: string): boolean {
  return PASSWORD_INPUT_PATTERN.test(html) || PAYWALL_COPY_PATTERN.test(html);
}

/** schema.org RestrictedDiet members keyed by compacted lowercase name. */
const RESTRICTED_DIETS: Record<string, RestrictedDiet> = {
  diabetic: "https://schema.org/DiabeticDiet",
  glutenfree: "https://schema.org/GlutenFreeDiet",
  halal: "https://schema.org/HalalDiet",
  hindu: "https://schema.org/HinduDiet",
  kosher: "https://schema.org/KosherDiet",
  lowcalorie: "https://schema.org/LowCalorieDiet",
  lowfat: "https://schema.org/LowFatDiet",
  lowlactose: "https://schema.org/LowLactoseDiet",
  lowsalt: "https://schema.org/LowSaltDiet",
  vegan: "https://schema.org/VeganDiet",
  vegetarian: "https://schema.org/VegetarianDiet",
};

export interface ExportableRecipe {
  authorName: string | null;
  cookMinutes: number | null;
  description: string | null;
  ingredients: { raw: string; section?: string | null }[];
  nutrition?: unknown;
  prepMinutes: number | null;
  publishedAt: Date | null;
  servings: number | null;
  steps: { section?: string | null; text: string }[];
  tags: { kind: TagKind; name: string }[];
  title: string;
  totalMinutes: number | null;
  yieldText: string | null;
}

function toHowToSteps(steps: { text: string }[]): HowToStep[] {
  return steps.map((step) => ({ "@type": "HowToStep", text: step.text }));
}

function buildInstructions(
  steps: ExportableRecipe["steps"]
): (HowToStep | HowToSection)[] {
  return groupBySection(steps).flatMap((group): (HowToStep | HowToSection)[] =>
    group.section
      ? [
          {
            "@type": "HowToSection",
            itemListElement: toHowToSteps(group.items),
            name: group.section,
          },
        ]
      : toHowToSteps(group.items)
  );
}

function tagNames(tags: ExportableRecipe["tags"], kind: TagKind): string[] {
  return tags.filter((tag) => tag.kind === kind).map((tag) => tag.name);
}

function dietIri(name: string): RestrictedDiet | null {
  return (
    RESTRICTED_DIETS[name.replace(DIET_SEPARATOR_PATTERN, "").toLowerCase()] ??
    null
  );
}

function exportNutrition(value: unknown): Recipe["nutrition"] {
  if (!isObject(value)) {
    return;
  }
  return { "@type": "NutritionInformation", ...value } as Recipe["nutrition"];
}

/**
 * Serialises a stored recipe to schema.org JSON-LD for Google Recipe rich
 * results: `HowToStep`/`HowToSection` instructions, ISO 8601 durations.
 */
export function recipeToJsonLd(
  recipe: ExportableRecipe,
  options: { imageUrl?: string | null; url: string }
): WithContext<Recipe> {
  const diets = tagNames(recipe.tags, "DIET")
    .map(dietIri)
    .filter((iri) => iri !== null);
  const keywords = tagNames(recipe.tags, "GENERAL").join(", ");
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    author: recipe.authorName
      ? { "@type": "Person", name: recipe.authorName }
      : undefined,
    cookTime: toIsoDuration(recipe.cookMinutes),
    datePublished: recipe.publishedAt?.toISOString().slice(0, 10),
    description: recipe.description ?? undefined,
    image: options.imageUrl ?? undefined,
    keywords: keywords || undefined,
    name: recipe.title,
    nutrition: exportNutrition(recipe.nutrition),
    prepTime: toIsoDuration(recipe.prepMinutes),
    recipeCategory: tagNames(recipe.tags, "COURSE"),
    recipeCuisine: tagNames(recipe.tags, "CUISINE"),
    recipeIngredient: recipe.ingredients.map((line) => line.raw),
    recipeInstructions: buildInstructions(recipe.steps),
    recipeYield:
      recipe.yieldText ??
      (recipe.servings ? String(recipe.servings) : undefined),
    suitableForDiet: diets.length ? diets : undefined,
    totalTime: toIsoDuration(recipe.totalMinutes),
    url: options.url,
  };
}

/** `JSON.stringify` with `<` escaped so the payload cannot close its script tag. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(LESS_THAN_PATTERN, "\\u003c");
}
