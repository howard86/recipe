"use client";

import { HeartIcon } from "@phosphor-icons/react";
import { Button } from "@workspace-template/ui/components/button";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/app/me/actions";

export function FavoriteButton({
  favorited,
  recipeId,
}: {
  favorited: boolean;
  recipeId: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(favorited);
  const [, startTransition] = useTransition();
  return (
    <Button
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          const result = await toggleFavoriteAction(recipeId);
          if (result.error) {
            toast.error(result.error);
          }
        })
      }
      variant="outline"
    >
      <HeartIcon
        className={optimistic ? "text-link" : undefined}
        data-icon="inline-start"
        weight={optimistic ? "fill" : "regular"}
      />
      {optimistic ? "Saved" : "Save"}
    </Button>
  );
}
