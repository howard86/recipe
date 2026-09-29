"use client";

import { Textarea } from "@workspace-template/ui/components/textarea";
import { useRef, useState, useTransition } from "react";
import { saveRecipeNoteAction } from "@/app/me/actions";

/** One private note per recipe, saved when the field loses focus. */
export function RecipeNote({
  initial,
  recipeId,
}: {
  initial: string;
  recipeId: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initial);

  function save(body: string) {
    if (body === lastSaved.current) {
      return;
    }
    setStatus("saving");
    startTransition(async () => {
      const result = await saveRecipeNoteAction(recipeId, body);
      if (result.error) {
        setStatus("error");
        return;
      }
      lastSaved.current = body;
      setStatus("saved");
    });
  }

  return (
    <div className="space-y-1">
      <Textarea
        aria-label="Your private notes"
        className="min-h-28"
        defaultValue={initial}
        maxLength={5000}
        onBlur={(event) => save(event.target.value)}
        placeholder="Only you see this. Swaps, timings, what to try next time."
      />
      <p aria-live="polite" className="h-4 text-muted-foreground text-xs">
        {status === "saving" && "Saving…"}
        {status === "saved" && "Saved"}
        {status === "error" && "Couldn't save. Try again."}
      </p>
    </div>
  );
}
