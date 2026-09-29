const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const DIACRITICS_PATTERN = /[̀-ͯ]/g;
const NON_ALPHANUMERIC_PATTERN = /[^a-z0-9]+/g;
const EDGE_DASHES_PATTERN = /^-+|-+$/g;
const MAX_SLUG_BASE = 60;

export function randomId(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = "";
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length];
  }
  return id;
}

export function slugify(text: string, maxLength = MAX_SLUG_BASE): string {
  return text
    .normalize("NFKD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_PATTERN, "-")
    .replace(EDGE_DASHES_PATTERN, "")
    .slice(0, maxLength)
    .replace(EDGE_DASHES_PATTERN, "");
}

/** `garlic-noodles-k3j9x2`: globally unique and stable across renames. */
export function createRecipeSlug(title: string): string {
  return `${slugify(title) || "recipe"}-${randomId()}`;
}

/** A generated handle the user is prompted to replace before sharing. */
export function createHandle(seed: string): string {
  const base = slugify(seed.split("@")[0] ?? "", 20) || "cook";
  return `${base}-${randomId(4)}`;
}

export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;
