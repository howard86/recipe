export interface SectionGroup<T> {
  items: T[];
  section: string | null;
}

/** Consecutive items with the same `section` form one group, in order. */
export function groupBySection<T extends { section?: string | null }>(
  items: readonly T[]
): SectionGroup<T>[] {
  const groups: SectionGroup<T>[] = [];
  for (const item of items) {
    const section = item.section || null;
    const last = groups.at(-1);
    if (last && last.section === section) {
      last.items.push(item);
    } else {
      groups.push({ items: [item], section });
    }
  }
  return groups;
}
