import { z } from "zod";
import { HANDLE_PATTERN } from "./slug";

export const VISIBILITIES = ["PRIVATE", "UNLISTED", "PUBLIC"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const TAG_KINDS = ["GENERAL", "CUISINE", "COURSE", "DIET"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

export const SOURCE_TYPES = ["MANUAL", "URL_IMPORT", "FORK"] as const;

export const LIMITS = {
  description: 2000,
  ingredientLine: 500,
  lines: 200,
  noteBody: 5000,
  section: 100,
  step: 5000,
  tagName: 50,
  tags: 30,
  title: 200,
  url: 2048,
} as const;

/** Trimmed optional text; empty strings become `null`. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);
}

const minutes = z.number().int().min(0).max(10_080).nullish();
const httpUrl = z
  .url({ protocol: /^https?$/ })
  .max(LIMITS.url)
  .nullish()
  .transform((value) => value || null);

export const IngredientLineInputSchema = z.object({
  name: optionalText(200),
  note: optionalText(300),
  quantity: z.number().positive().max(1_000_000).nullish(),
  quantityMax: z.number().positive().max(1_000_000).nullish(),
  raw: z.string().trim().min(1).max(LIMITS.ingredientLine),
  section: optionalText(LIMITS.section),
  unit: optionalText(30),
});
export type IngredientLineInput = z.infer<typeof IngredientLineInputSchema>;

export const InstructionStepInputSchema = z.object({
  section: optionalText(LIMITS.section),
  text: z.string().trim().min(1).max(LIMITS.step),
});
export type InstructionStepInput = z.infer<typeof InstructionStepInputSchema>;

export const TagInputSchema = z.object({
  kind: z.enum(TAG_KINDS).default("GENERAL"),
  name: z.string().trim().min(1).max(LIMITS.tagName),
});
export type TagInput = z.infer<typeof TagInputSchema>;

export const RecipeInputSchema = z.object({
  cookMinutes: minutes,
  description: optionalText(LIMITS.description),
  imageUrl: httpUrl,
  importedJsonLd: z.unknown().optional(),
  importId: z.string().max(40).nullish(),
  ingredients: z.array(IngredientLineInputSchema).max(LIMITS.lines),
  nutrition: z.record(z.string(), z.union([z.string(), z.number()])).nullish(),
  prepMinutes: minutes,
  servings: z.number().int().min(1).max(1000).nullish(),
  sourceName: optionalText(200),
  sourceType: z.enum(SOURCE_TYPES).default("MANUAL"),
  sourceUrl: httpUrl,
  steps: z.array(InstructionStepInputSchema).max(LIMITS.lines),
  tags: z.array(TagInputSchema).max(LIMITS.tags),
  title: z.string().trim().min(1, "Give the recipe a title").max(LIMITS.title),
  totalMinutes: minutes,
  visibility: z.enum(VISIBILITIES).default("PRIVATE"),
  yieldText: optionalText(100),
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;
/** What a form or importer sends before validation fills defaults. */
export type RecipeFormValue = z.input<typeof RecipeInputSchema>;

export const CookLogInputSchema = z.object({
  cookedAt: z.iso.date(),
  notes: optionalText(2000),
  rating: z.number().int().min(1).max(5).nullish(),
  recipeId: z.string().min(1),
  servingsMade: z.number().int().min(1).max(1000).nullish(),
});
export type CookLogInput = z.infer<typeof CookLogInputSchema>;

export const RecipeNoteInputSchema = z.object({
  body: z.string().max(LIMITS.noteBody),
  recipeId: z.string().min(1),
});

export const HandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    HANDLE_PATTERN,
    "3 to 30 characters: lowercase letters, numbers and dashes"
  );

export const SEARCH_SORTS = ["relevance", "newest", "quickest"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
