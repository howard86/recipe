"use client";

import { resolveTotalMinutes } from "@workspace-template/data/recipe/duration";
import {
  formatLine,
  parseIngredient,
} from "@workspace-template/data/recipe/ingredient";
import {
  LIMITS,
  type TagInput,
  type Visibility,
} from "@workspace-template/data/recipe/schema";
import {
  Alert,
  AlertDescription,
} from "@workspace-template/ui/components/alert";
import { Badge } from "@workspace-template/ui/components/badge";
import { Button } from "@workspace-template/ui/components/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@workspace-template/ui/components/field";
import { Input } from "@workspace-template/ui/components/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace-template/ui/components/radio-group";
import { Textarea } from "@workspace-template/ui/components/textarea";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { EditorState } from "@/app/recipes/actions";
import { VISIBILITY_OPTIONS } from "@/components/recipe/sharing-dialog";
import { LineListEditor } from "./line-list-editor";
import { type EditorValue, toPayload } from "./payload";
import type { EditorRow } from "./rows";
import { TagEditor } from "./tag-editor";

type EditorAction = (
  state: EditorState,
  formData: FormData
) => Promise<EditorState>;

function IngredientPreview({ row }: { row: EditorRow }) {
  const parsed = parseIngredient(row.text);
  if (!row.text.trim()) {
    return null;
  }
  if (parsed.confidence === "low") {
    return (
      <p className="px-3 text-muted-foreground text-xs">
        Check this line: we could not read a clear amount and ingredient.
      </p>
    );
  }
  const { quantity } = parsed;
  if (!quantity) {
    return (
      <p className="px-3 text-muted-foreground text-xs">
        Not scaled: {parsed.name}
      </p>
    );
  }
  return (
    <p className="px-3 text-muted-foreground text-xs">
      {formatLine({ ...parsed, quantity, raw: row.text })}
    </p>
  );
}

function NumberField({
  hint,
  id,
  label,
  onChange,
  value,
}: {
  hint?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="numeric"
        max={10_080}
        min={0}
        onChange={(event) => onChange(event.target.value)}
        placeholder={hint}
        type="number"
        value={value}
      />
    </Field>
  );
}

export function RecipeEditor({
  action,
  initialValue,
  submitLabel,
  tagSuggestions,
}: {
  action: EditorAction;
  initialValue: EditorValue;
  submitLabel: string;
  tagSuggestions: TagInput[];
}) {
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});
  const payload = useMemo(() => JSON.stringify(toPayload(value)), [value]);
  const computedTotal = resolveTotalMinutes({
    cookMinutes: Number.parseInt(value.cookMinutes, 10) || null,
    prepMinutes: Number.parseInt(value.prepMinutes, 10) || null,
  });

  useEffect(() => {
    if (!dirty || pending) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  function set<K extends keyof EditorValue>(key: K, next: EditorValue[K]) {
    setDirty(true);
    setValue((current) => ({ ...current, [key]: next }));
  }

  const errors = state.fieldErrors ?? {};
  const { source } = value;

  return (
    <form action={formAction} className="space-y-10">
      <input name="payload" type="hidden" value={payload} />
      {source.sourceType === "URL_IMPORT" && source.sourceName && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Imported from {source.sourceName}</Badge>
          <span className="text-muted-foreground text-sm">
            Review everything below, then save. It stays private until you share
            it.
          </span>
        </div>
      )}
      <FieldGroup>
        <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                aria-invalid={!!errors.title}
                id="title"
                maxLength={LIMITS.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Garlic butter noodles"
                required
                value={value.title}
              />
              <FieldError>{errors.title?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                maxLength={LIMITS.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="What makes it good, when you make it"
                value={value.description}
              />
            </Field>
          </FieldGroup>
          {source.imageUrl && (
            // biome-ignore lint/correctness/useImageSize: source image dimensions are unknown until it is copied.
            <img
              alt=""
              className="aspect-4/3 w-full rounded-3xl object-cover"
              referrerPolicy="no-referrer"
              src={source.imageUrl}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <NumberField
            id="servings"
            label="Servings"
            onChange={(next) => set("servings", next)}
            value={value.servings}
          />
          <Field>
            <FieldLabel htmlFor="yieldText">Yield</FieldLabel>
            <Input
              id="yieldText"
              maxLength={100}
              onChange={(event) => set("yieldText", event.target.value)}
              placeholder="12 cookies"
              value={value.yieldText}
            />
          </Field>
          <NumberField
            id="prepMinutes"
            label="Prep (min)"
            onChange={(next) => set("prepMinutes", next)}
            value={value.prepMinutes}
          />
          <NumberField
            id="cookMinutes"
            label="Cook (min)"
            onChange={(next) => set("cookMinutes", next)}
            value={value.cookMinutes}
          />
          <NumberField
            hint={computedTotal ? String(computedTotal) : undefined}
            id="totalMinutes"
            label="Total (min)"
            onChange={(next) => set("totalMinutes", next)}
            value={value.totalMinutes}
          />
        </div>
      </FieldGroup>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-2">
          <LineListEditor
            addLabel="Add ingredient"
            itemPlaceholder="1 1/2 cups flour, sifted"
            label="Ingredients"
            maxLength={LIMITS.ingredientLine}
            onChange={(rows) => set("ingredients", rows)}
            renderDetail={(row) => <IngredientPreview row={row} />}
            rowClassName={(row) =>
              row.kind === "item" &&
              row.text.trim() &&
              parseIngredient(row.text).confidence === "low"
                ? "bg-star/10"
                : undefined
            }
            rows={value.ingredients}
          />
          <p className="text-muted-foreground text-xs">
            Paste a whole list to split it into lines. Enter adds a line.
          </p>
          <FieldError>{errors.ingredients?.[0]}</FieldError>
        </div>
        <div className="space-y-2">
          <LineListEditor
            addLabel="Add step"
            itemPlaceholder="Describe this step"
            label="Steps"
            maxLength={LIMITS.step}
            multiline
            onChange={(rows) => set("steps", rows)}
            rows={value.steps}
          />
          <p className="text-muted-foreground text-xs">
            Shift + Enter for a new line inside a step.
          </p>
          <FieldError>{errors.steps?.[0]}</FieldError>
        </div>
      </div>

      <TagEditor
        onChange={(tags) => set("tags", tags)}
        suggestions={tagSuggestions}
        tags={value.tags}
      />

      <fieldset>
        <legend className="mb-3 font-heading text-2xl">Who can see it</legend>
        <RadioGroup
          className="grid gap-3 md:grid-cols-3"
          onValueChange={(next) => set("visibility", next as Visibility)}
          value={value.visibility}
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <FieldLabel
              htmlFor={`editor-visibility-${option.value}`}
              key={option.value}
            >
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{option.label}</FieldTitle>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
                <RadioGroupItem
                  id={`editor-visibility-${option.value}`}
                  value={option.value}
                />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </fieldset>

      {state.formError && (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-3">
        <Button
          disabled={pending}
          onClick={() => setDirty(false)}
          size="lg"
          type="submit"
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
