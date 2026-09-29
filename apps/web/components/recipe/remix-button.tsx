"use client";

import { Button } from "@workspace-template/ui/components/button";
import { useTransition } from "react";
import { toast } from "sonner";
import { forkRecipeAction } from "@/app/recipes/actions";

/** Copies the recipe into a new private one the viewer owns. */
export function RemixButton({
  recipeId,
  slug,
}: {
  recipeId: string;
  slug: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await forkRecipeAction(recipeId, slug);
          if (result?.error) {
            toast.error(result.error);
          }
        })
      }
      variant="outline"
    >
      Remix
    </Button>
  );
}
