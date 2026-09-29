/**
 * Minimal composable SQL builder for search. Prisma's `Prisma.sql` fragments
 * rely on `instanceof`, which fails when the Next.js bundle ends up with two
 * copies of Prisma's runtime: nested fragments then get bound as text
 * parameters. Fragments here are branded with a plain property, and every
 * interpolated value still becomes a numbered bind parameter (never inlined).
 */
export interface SqlFragment {
  readonly __sqlFragment: true;
  readonly parts: readonly (string | { value: unknown })[];
}

function isFragment(value: unknown): value is SqlFragment {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as SqlFragment).__sqlFragment === true
  );
}

export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SqlFragment {
  const parts: (string | { value: unknown })[] = [];
  for (const [index, text] of strings.entries()) {
    parts.push(text);
    if (index < values.length) {
      const value = values[index];
      if (isFragment(value)) {
        parts.push(...value.parts);
      } else {
        parts.push({ value });
      }
    }
  }
  return { __sqlFragment: true, parts };
}

export function join(
  fragments: readonly SqlFragment[],
  separator: string
): SqlFragment {
  const parts: (string | { value: unknown })[] = [];
  const nonEmpty = fragments.filter((fragment) =>
    fragment.parts.some((part) => part !== "")
  );
  for (const [index, fragment] of nonEmpty.entries()) {
    if (index > 0) {
      parts.push(separator);
    }
    parts.push(...fragment.parts);
  }
  return { __sqlFragment: true, parts };
}

export const empty: SqlFragment = { __sqlFragment: true, parts: [] };

/** Renders `$1, $2, …` placeholders for `$queryRawUnsafe(text, ...values)`. */
export function render(fragment: SqlFragment): {
  text: string;
  values: unknown[];
} {
  const values: unknown[] = [];
  const text = fragment.parts
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      values.push(part.value);
      return `$${values.length}`;
    })
    .join("");
  return { text, values };
}
