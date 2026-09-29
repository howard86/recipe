const WORD_PATTERN = /[a-z]+/g;
const MIN_WORD_LENGTH = 3;
const STOP_WORDS = new Set([
  "and",
  "chopped",
  "cut",
  "diced",
  "fresh",
  "large",
  "minced",
  "or",
  "sliced",
  "small",
  "the",
  "with",
]);

function words(text: string): string[] {
  return (text.toLowerCase().match(WORD_PATTERN) ?? []).filter(
    (word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word)
  );
}

function stem(word: string): string {
  if (word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith("es") && word.length > 4) {
    return word.slice(0, -2);
  }
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * Indexes of ingredients whose name shares a word with the step text
 * ("tomatoes" matches "tomato"). Empty when nothing matches, so callers show
 * the full list instead.
 */
export function ingredientsForStep(
  step: string,
  ingredients: readonly { name?: string | null; raw: string }[]
): number[] {
  const stepWords = new Set(words(step).map(stem));
  const matches: number[] = [];
  ingredients.forEach((ingredient, index) => {
    const nameWords = words(ingredient.name ?? ingredient.raw).map(stem);
    if (nameWords.some((word) => stepWords.has(word))) {
      matches.push(index);
    }
  });
  return matches;
}
