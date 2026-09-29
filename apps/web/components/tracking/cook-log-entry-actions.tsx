"use client";

import { Button } from "@workspace-template/ui/components/button";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteCookLogAction } from "@/app/me/actions";
import { CookLogDialog, type CookLogValue } from "./cook-log-dialog";

export function CookLogEntryActions({
  log,
  recipeId,
}: {
  log: CookLogValue & { id: string };
  recipeId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-1">
      <CookLogDialog
        initial={log}
        recipeId={recipeId}
        triggerLabel="Edit"
        triggerSize="sm"
        triggerVariant="ghost"
      />
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteCookLogAction(log.id);
            if (result.error) {
              toast.error(result.error);
            }
          })
        }
        size="sm"
        variant="ghost"
      >
        Delete
      </Button>
    </div>
  );
}
