"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/app/me/actions";

/**
 * Replays "Save" after the sign-in round trip (`?intent=save`), then drops the
 * param. "I cooked this" replays by opening its dialog (see the detail page).
 */
export function IntentReplay({
  favorited,
  intent,
  recipeId,
}: {
  favorited: boolean;
  intent: string | undefined;
  recipeId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);
  useEffect(() => {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: false positive; the ref stops Strict Mode's second effect run from toggling the favourite back.
    if (done.current || intent !== "save") {
      return;
    }
    done.current = true;
    const replay = async () => {
      if (!favorited) {
        const result = await toggleFavoriteAction(recipeId);
        if (result.ok) {
          toast.success("Saved to your recipes");
        }
      }
      router.replace(pathname as never, { scroll: false });
    };
    replay();
  }, [favorited, intent, pathname, recipeId, router]);
  return null;
}
