"use client";

import type { Visibility } from "@workspace-template/data/recipe/schema";
import {
  Alert,
  AlertDescription,
} from "@workspace-template/ui/components/alert";
import { Button } from "@workspace-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace-template/ui/components/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@workspace-template/ui/components/field";
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace-template/ui/components/radio-group";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setVisibilityAction } from "@/app/recipes/actions";

export const VISIBILITY_OPTIONS: {
  description: string;
  label: string;
  value: Visibility;
}[] = [
  { description: "Only you can see it.", label: "Private", value: "PRIVATE" },
  {
    description: "Anyone with the link; hidden from search engines and browse.",
    label: "Unlisted",
    value: "UNLISTED",
  },
  {
    description: "Listed in browse and search, and on your profile.",
    label: "Public",
    value: "PUBLIC",
  },
];

export function SharingDialog({
  imported,
  recipeId,
  visibility,
}: {
  imported: boolean;
  recipeId: string;
  visibility: Visibility;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Visibility>(visibility);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await setVisibilityAction(recipeId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sharing updated");
      setOpen(false);
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button variant="outline" />}>Share</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Who can see this recipe?</DialogTitle>
          <DialogDescription>
            Recipes start private. Sharing is always your choice.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          onValueChange={(next) => setValue(next as Visibility)}
          value={value}
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <FieldLabel
              htmlFor={`visibility-${option.value}`}
              key={option.value}
            >
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{option.label}</FieldTitle>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  id={`visibility-${option.value}`}
                  value={option.value}
                />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
        {imported && value === "PUBLIC" && (
          <Alert>
            <AlertDescription>
              This recipe was imported. Before sharing it publicly, rewrite the
              steps in your own words; the source stays credited on the page.
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button disabled={pending || value === visibility} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
