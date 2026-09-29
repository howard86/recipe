import { formatMinutes } from "@workspace-template/data/recipe/duration";
import type { Visibility } from "@workspace-template/data/recipe/schema";
import { Badge } from "@workspace-template/ui/components/badge";

const VISIBILITY_LABELS: Record<Visibility, string> = {
  PRIVATE: "Private",
  PUBLIC: "Public",
  UNLISTED: "Unlisted",
};

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return <Badge variant="secondary">{VISIBILITY_LABELS[visibility]}</Badge>;
}

export function RecipeTimes({
  cookMinutes,
  prepMinutes,
  servings,
  totalMinutes,
  yieldText,
}: {
  cookMinutes: number | null;
  prepMinutes: number | null;
  servings: number | null;
  totalMinutes: number | null;
  yieldText: string | null;
}) {
  const items = [
    { label: "Prep", value: formatMinutes(prepMinutes) },
    { label: "Cook", value: formatMinutes(cookMinutes) },
    { label: "Total", value: formatMinutes(totalMinutes) },
    {
      label: "Makes",
      value: yieldText ?? (servings ? `${servings} servings` : ""),
    },
  ].filter((item) => item.value);
  if (!items.length) {
    return null;
  }
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">
            {item.label}
          </dt>
          <dd className="font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
