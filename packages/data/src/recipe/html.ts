const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  deg: "°",
  eacute: "é",
  egrave: "è",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
  times: "×",
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi;
const BLOCK_TAG_PATTERN = /<\s*(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi;
const TAG_PATTERN = /<[^>]*>/g;
const INLINE_SPACE_PATTERN = /[^\S\n]+/g;
const BLANK_LINES_PATTERN = /\s*\n\s*/g;
const ANY_SPACE_PATTERN = /\s+/g;

function decodeEntity(match: string, entity: string): string {
  if (entity.startsWith("#x") || entity.startsWith("#X")) {
    const code = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  }
  if (entity.startsWith("#")) {
    const code = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  }
  return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
}

export function decodeEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, decodeEntity);
}

/**
 * Turns an untrusted JSON-LD text value into plain text: tags stripped (before
 * and after decoding, so `&lt;b&gt;` cannot smuggle markup), entities decoded,
 * whitespace collapsed. Non-strings become "".
 */
export function cleanText(
  value: unknown,
  options: { multiline?: boolean } = {}
): string {
  if (typeof value !== "string") {
    return "";
  }
  const withBreaks = options.multiline
    ? value.replace(BLOCK_TAG_PATTERN, "\n")
    : value;
  const decoded = decodeEntities(withBreaks.replace(TAG_PATTERN, " ")).replace(
    TAG_PATTERN,
    " "
  );
  if (options.multiline) {
    return decoded
      .replace(INLINE_SPACE_PATTERN, " ")
      .replace(BLANK_LINES_PATTERN, "\n")
      .trim();
  }
  return decoded.replace(ANY_SPACE_PATTERN, " ").trim();
}
