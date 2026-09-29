import { parseIngredient } from "@workspace-template/data/recipe/ingredient";
import type {
  RecipeFormValue,
  TagInput,
  Visibility,
} from "@workspace-template/data/recipe/schema";
import { type EditorRow, fromRows, newRow, toRows } from "./rows";

export interface EditorSource {
  imageUrl?: string | null;
  importedJsonLd?: unknown;
  importId?: string | null;
  sourceName?: string | null;
  sourceType: "MANUAL" | "URL_IMPORT" | "FORK";
  sourceUrl?: string | null;
}

/** Client-side editor state: numbers stay strings until submit. */
export interface EditorValue {
  cookMinutes: string;
  description: string;
  ingredients: EditorRow[];
  prepMinutes: string;
  servings: string;
  source: EditorSource;
  steps: EditorRow[];
  tags: TagInput[];
  title: string;
  totalMinutes: string;
  visibility: Visibility;
  yieldText: string;
}

/** What the form posts as JSON in its `payload` field. */
export interface EditorPayload
  extends Omit<EditorValue, "ingredients" | "steps"> {
  ingredients: { section: string | null; text: string }[];
  steps: { section: string | null; text: string }[];
}

export interface EditorSeed {
  cookMinutes?: number | null;
  description?: string | null;
  ingredients: { raw: string; section?: string | null }[];
  prepMinutes?: number | null;
  servings?: number | null;
  source?: EditorSource;
  steps: { section?: string | null; text: string }[];
  tags: TagInput[];
  title: string;
  totalMinutes?: number | null;
  visibility?: Visibility;
  yieldText?: string | null;
}

function numberText(value: number | null | undefined): string {
  return value ? String(value) : "";
}

function withBlankRow(rows: EditorRow[]): EditorRow[] {
  return rows.length ? rows : [newRow("item")];
}

export function editorValueFrom(seed: EditorSeed): EditorValue {
  return {
    cookMinutes: numberText(seed.cookMinutes),
    description: seed.description ?? "",
    ingredients: withBlankRow(toRows(seed.ingredients, (line) => line.raw)),
    prepMinutes: numberText(seed.prepMinutes),
    servings: numberText(seed.servings),
    source: seed.source ?? { sourceType: "MANUAL" },
    steps: withBlankRow(toRows(seed.steps, (step) => step.text)),
    tags: seed.tags,
    title: seed.title,
    totalMinutes: numberText(seed.totalMinutes),
    visibility: seed.visibility ?? "PRIVATE",
    yieldText: seed.yieldText ?? "",
  };
}

export function toPayload(value: EditorValue): EditorPayload {
  return {
    ...value,
    ingredients: fromRows(value.ingredients),
    steps: fromRows(value.steps),
  };
}

function toNumber(text: string): number | null {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : null;
}

/** Maps the posted payload onto RecipeInput; zod validates the result. */
export function toRecipeFormValue(payload: EditorPayload): RecipeFormValue {
  return {
    cookMinutes: toNumber(payload.cookMinutes),
    description: payload.description,
    imageUrl: payload.source.imageUrl,
    importedJsonLd: payload.source.importedJsonLd,
    importId: payload.source.importId,
    ingredients: payload.ingredients.map((line) => {
      const { confidence: _confidence, ...parsed } = parseIngredient(line.text);
      return { ...parsed, raw: line.text, section: line.section };
    }),
    prepMinutes: toNumber(payload.prepMinutes),
    servings: toNumber(payload.servings),
    sourceName: payload.source.sourceName,
    sourceType:
      payload.source.sourceType === "URL_IMPORT" ? "URL_IMPORT" : "MANUAL",
    sourceUrl: payload.source.sourceUrl,
    steps: payload.steps.map((step) => ({
      section: step.section,
      text: step.text,
    })),
    tags: payload.tags,
    title: payload.title,
    totalMinutes: toNumber(payload.totalMinutes),
    visibility: payload.visibility,
    yieldText: payload.yieldText,
  };
}
