export interface ParsedIngredient {
  confidence: "high" | "low";
  name: string | null;
  note: string | null;
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
}

const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
  "⅑": "1/9",
  "⅒": "1/10",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

/** Canonical unit keyed by every spelling we accept (lowercase). */
const UNIT_ALIASES: Record<string, string> = {
  c: "cup",
  can: "can",
  cans: "can",
  clove: "clove",
  cloves: "clove",
  cup: "cup",
  cups: "cup",
  dash: "dash",
  dashes: "dash",
  "fl oz": "fl oz",
  "fl. oz.": "fl oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  g: "g",
  gallon: "gallon",
  gallons: "gallon",
  gram: "g",
  grams: "g",
  handful: "handful",
  handfuls: "handful",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  l: "l",
  lb: "lb",
  lbs: "lb",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  mg: "mg",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  ml: "ml",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  package: "package",
  packages: "package",
  pinch: "pinch",
  pinches: "pinch",
  pint: "pint",
  pints: "pint",
  pkg: "package",
  pound: "lb",
  pounds: "lb",
  pt: "pint",
  qt: "quart",
  quart: "quart",
  quarts: "quart",
  slice: "slice",
  slices: "slice",
  sprig: "sprig",
  sprigs: "sprig",
  stick: "stick",
  sticks: "stick",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbs: "tbsp",
  tbsp: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
};

const PLURAL_UNITS: Record<string, string> = {
  can: "cans",
  clove: "cloves",
  cup: "cups",
  dash: "dashes",
  gallon: "gallons",
  handful: "handfuls",
  package: "packages",
  pinch: "pinches",
  pint: "pints",
  quart: "quarts",
  slice: "slices",
  sprig: "sprigs",
  stick: "sticks",
};

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const QUANTITY = String.raw`(?:\d+\s+\d+/\d+|\d+/\d+|${NUMBER})`;
const QUANTITY_PATTERN = new RegExp(
  String.raw`^(${QUANTITY})(?:\s*(?:-|–|—|to|or)\s*(${QUANTITY}))?`,
  "i"
);
const ARTICLE_PATTERN = /^(a|an|one)\s+/i;
const TWO_WORD_UNIT_PATTERN = /^(fl\.?\s*oz\.?|fluid\s+ounces?)(?=[\s,(]|$)/i;
const UNIT_WORD_PATTERN = /^([a-z]+)\.?(?=[\s,(]|$)/i;
const LEADING_PAREN_PATTERN = /^\(([^)]*)\)\s*/;
const LEADING_OF_PATTERN = /^of\s+/i;
const DIGIT_PATTERN = /\d/;
const WHITESPACE_PATTERN = /\s+/g;
const MIXED_FRACTION_PATTERN = /(\d)([⅐-⅞¼½¾])/g;
const UNICODE_FRACTION_PATTERN = /[⅐-⅞¼½¾]/g;
const FRACTION_SLASH_PATTERN = /⁄/g;

function normaliseFractions(text: string): string {
  return text
    .replace(FRACTION_SLASH_PATTERN, "/")
    .replace(MIXED_FRACTION_PATTERN, "$1 $2")
    .replace(
      UNICODE_FRACTION_PATTERN,
      (char) => UNICODE_FRACTIONS[char] ?? char
    );
}

export function parseQuantity(text: string): number | null {
  const parts = text.trim().split(WHITESPACE_PATTERN);
  let total = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [numerator, denominator] = part.split("/").map(Number);
      if (!(numerator !== undefined && denominator)) {
        return null;
      }
      total += numerator / denominator;
    } else {
      const value = Number(part.replace(",", "."));
      if (!Number.isFinite(value)) {
        return null;
      }
      total += value;
    }
  }
  return total > 0 ? Math.round(total * 1000) / 1000 : null;
}

function readQuantity(text: string) {
  const match = text.match(QUANTITY_PATTERN);
  if (match) {
    return {
      quantity: parseQuantity(match[1] ?? ""),
      quantityMax: match[2] ? parseQuantity(match[2]) : null,
      rest: text.slice(match[0].length).trim(),
    };
  }
  const article = text.match(ARTICLE_PATTERN);
  if (article) {
    return {
      quantity: 1,
      quantityMax: null,
      rest: text.slice(article[0].length).trim(),
    };
  }
  return { quantity: null, quantityMax: null, rest: text };
}

function readUnit(text: string) {
  const twoWord = text.match(TWO_WORD_UNIT_PATTERN);
  if (twoWord) {
    return { rest: text.slice(twoWord[0].length).trim(), unit: "fl oz" };
  }
  const word = text.match(UNIT_WORD_PATTERN);
  const unit = word ? UNIT_ALIASES[(word[1] ?? "").toLowerCase()] : undefined;
  if (word && unit) {
    return { rest: text.slice(word[0].length).trim(), unit };
  }
  return { rest: text, unit: null };
}

function splitNameAndNote(text: string, notes: string[]) {
  let rest = text;
  const paren = rest.match(LEADING_PAREN_PATTERN);
  if (paren) {
    notes.push(paren[1]?.trim() ?? "");
    rest = rest.slice(paren[0].length);
  }
  rest = rest.replace(LEADING_OF_PATTERN, "");
  const commaIndex = rest.indexOf(",");
  if (commaIndex >= 0) {
    notes.push(rest.slice(commaIndex + 1).trim());
    rest = rest.slice(0, commaIndex);
  }
  return rest.trim();
}

/**
 * Best-effort parse of an ingredient line such as
 * `1 1/2 cups (190g) flour, sifted`. The caller always keeps the raw string;
 * this only adds optional structure for scaling and display.
 */
export function parseIngredient(raw: string): ParsedIngredient {
  const text = normaliseFractions(raw.trim()).replace(WHITESPACE_PATTERN, " ");
  const { quantity, quantityMax, rest: afterQuantity } = readQuantity(text);
  const { unit, rest: afterUnit } =
    quantity === null
      ? { rest: afterQuantity, unit: null }
      : readUnit(afterQuantity);
  const notes: string[] = [];
  const name = splitNameAndNote(afterUnit, notes);
  const note = notes.filter(Boolean).join(", ") || null;
  const hasStrayNumber = quantity === null && DIGIT_PATTERN.test(text);
  return {
    confidence: name && !hasStrayNumber ? "high" : "low",
    name: name || null,
    note,
    quantity,
    quantityMax,
    unit,
  };
}

const FRACTION_GLYPHS: [number, string][] = [
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
];
const FRACTION_TOLERANCE = 0.04;

/** 1.5 → "1½", 0.333 → "⅓", 2.4 → "2.4". */
export function formatQuantity(value: number): string {
  let whole = Math.floor(value);
  const fraction = value - whole;
  if (fraction < FRACTION_TOLERANCE) {
    return String(whole);
  }
  if (fraction > 1 - FRACTION_TOLERANCE) {
    whole += 1;
    return String(whole);
  }
  const glyph = FRACTION_GLYPHS.find(
    ([target]) => Math.abs(fraction - target) < FRACTION_TOLERANCE
  )?.[1];
  if (glyph) {
    return whole ? `${whole}${glyph}` : glyph;
  }
  return String(Math.round(value * 100) / 100);
}

export function formatUnit(unit: string, quantity: number): string {
  return quantity > 1 ? (PLURAL_UNITS[unit] ?? unit) : unit;
}

export interface ScalableLine {
  name?: string | null;
  note?: string | null;
  quantity?: number | null;
  quantityMax?: number | null;
  raw: string;
  unit?: string | null;
}

/**
 * Renders a line for `factor` × the recipe's servings. Lines without a parsed
 * quantity come back unchanged with `scaled: false`, so the UI can mark them.
 */
export function scaleLine(
  line: ScalableLine,
  factor: number
): { scaled: boolean; text: string } {
  if (!line.quantity) {
    return { scaled: false, text: line.raw };
  }
  if (factor === 1) {
    return { scaled: true, text: line.raw };
  }
  const quantity = line.quantity * factor;
  const max = line.quantityMax ? line.quantityMax * factor : null;
  const amount = max
    ? `${formatQuantity(quantity)}–${formatQuantity(max)}`
    : formatQuantity(quantity);
  const unit = line.unit ? ` ${formatUnit(line.unit, max ?? quantity)}` : "";
  const name = line.name ? ` ${line.name}` : "";
  const note = line.note ? `, ${line.note}` : "";
  return { scaled: true, text: `${amount}${unit}${name}${note}` };
}
