"use client";

import { Button } from "@workspace-template/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace-template/ui/components/dialog";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteRecipeAction } from "@/app/recipes/actions";

export function DeleteRecipeButton({
  recipeId,
  title,
}: {
  recipeId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" />}>Delete</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>
            This removes the recipe, its cook logs and notes for everyone.
            Remixes of it keep working.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteRecipeAction(recipeId);
                if (result.error) {
                  toast.error(result.error);
                }
              })
            }
            variant="destructive"
          >
            Delete recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
