"use client";

import { StarIcon } from "@phosphor-icons/react";
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
  FieldGroup,
  FieldLabel,
} from "@workspace-template/ui/components/field";
import { Input } from "@workspace-template/ui/components/input";
import { Textarea } from "@workspace-template/ui/components/textarea";
import { cn } from "@workspace-template/ui/lib/utils";
import {
  type ComponentProps,
  type SubmitEvent,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { logCookAction, updateCookLogAction } from "@/app/me/actions";

export interface CookLogValue {
  cookedAt: string;
  id?: string;
  notes: string;
  rating: number | null;
  servingsMade: number | null;
}

/** Today in the viewer's time zone, as YYYY-MM-DD. */
export function localToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function RatingInput({
  onChange,
  value,
}: {
  onChange: (value: number | null) => void;
  value: number | null;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          className="cursor-pointer rounded-full p-1 text-star hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring"
          key={star}
        >
          <input
            checked={value === star}
            className="sr-only"
            name="rating"
            onChange={() => onChange(star)}
            type="radio"
            value={star}
          />
          <span className="sr-only">
            {star} star{star > 1 ? "s" : ""}
          </span>
          <StarIcon
            aria-hidden="true"
            className={cn("size-7", !(value && star <= value) && "opacity-30")}
            weight={value && star <= value ? "fill" : "regular"}
          />
        </label>
      ))}
      {value && (
        <Button onClick={() => onChange(null)} size="sm" variant="ghost">
          Clear
        </Button>
      )}
    </div>
  );
}

/** "I cooked this": date (backdating allowed), optional rating, notes and servings. */
export function CookLogDialog({
  defaultOpen = false,
  initial,
  recipeId,
  servings,
  triggerLabel,
  triggerSize,
  triggerVariant = "outline",
}: {
  defaultOpen?: boolean;
  initial?: CookLogValue;
  recipeId: string;
  servings?: number | null;
  triggerLabel: string;
  triggerSize?: ComponentProps<typeof Button>["size"];
  triggerVariant?: ComponentProps<typeof Button>["variant"];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(initial?.id);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const servingsMade = Number.parseInt(
      String(form.get("servingsMade") ?? ""),
      10
    );
    const input = {
      cookedAt: String(form.get("cookedAt") ?? ""),
      notes: String(form.get("notes") ?? ""),
      rating,
      recipeId,
      servingsMade: Number.isFinite(servingsMade) ? servingsMade : null,
    };
    startTransition(async () => {
      const result = initial?.id
        ? await updateCookLogAction(initial.id, input)
        : await logCookAction(input);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Cook log updated" : "Logged. Nice cooking!");
      setOpen(false);
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={<Button size={triggerSize} variant={triggerVariant} />}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit cook log" : "I cooked this"}
            </DialogTitle>
            <DialogDescription>
              Only you can see your cook log.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="cookedAt">Date</FieldLabel>
                <Input
                  defaultValue={initial?.cookedAt ?? localToday()}
                  id="cookedAt"
                  max={localToday()}
                  name="cookedAt"
                  required
                  type="date"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="servingsMade">Servings made</FieldLabel>
                <Input
                  defaultValue={initial?.servingsMade ?? servings ?? ""}
                  id="servingsMade"
                  inputMode="numeric"
                  max={1000}
                  min={1}
                  name="servingsMade"
                  type="number"
                />
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="font-medium text-sm">How was it?</legend>
              <RatingInput onChange={setRating} value={rating} />
            </fieldset>
            <Field>
              <FieldLabel htmlFor="cook-notes">Notes</FieldLabel>
              <Textarea
                defaultValue={initial?.notes ?? ""}
                id="cook-notes"
                maxLength={2000}
                name="notes"
                placeholder="Less salt next time, doubled the garlic…"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {editing ? "Save" : "Log it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
