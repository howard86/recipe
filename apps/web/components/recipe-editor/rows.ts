/**
 * List-editor rows: items plus section-heading rows. Consecutive items after a
 * heading belong to that section, which round-trips the `section` column.
 */
export interface EditorRow {
  key: string;
  kind: "item" | "section";
  text: string;
}

const LINE_BREAK_PATTERN = /\r?\n/;

let counter = 0;

export function newRow(kind: EditorRow["kind"] = "item", text = ""): EditorRow {
  counter += 1;
  return {
    key: `row-${counter}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    text,
  };
}

export function toRows<T extends { section?: string | null }>(
  items: readonly T[],
  getText: (item: T) => string
): EditorRow[] {
  const rows: EditorRow[] = [];
  let section: string | null = null;
  for (const item of items) {
    const next = item.section || null;
    if (next !== section && next) {
      rows.push(newRow("section", next));
    }
    section = next;
    rows.push(newRow("item", getText(item)));
  }
  return rows;
}

/** Items with their section; blank rows and empty trailing sections drop out. */
export function fromRows(
  rows: readonly EditorRow[]
): { section: string | null; text: string }[] {
  const items: { section: string | null; text: string }[] = [];
  let section: string | null = null;
  for (const row of rows) {
    const text = row.text.trim();
    if (row.kind === "section") {
      section = text || null;
    } else if (text) {
      items.push({ section, text });
    }
  }
  return items;
}

/** A pasted block becomes one row per non-empty line. */
export function splitPastedLines(text: string): string[] {
  return text
    .split(LINE_BREAK_PATTERN)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function moveRow(
  rows: readonly EditorRow[],
  from: number,
  to: number
): EditorRow[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= rows.length ||
    to >= rows.length
  ) {
    return [...rows];
  }
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  if (moved) {
    next.splice(to, 0, moved);
  }
  return next;
}
