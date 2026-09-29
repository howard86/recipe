"use client";

import type { ExtractedRecipe } from "@workspace-template/data/recipe/jsonld";
import type { TagInput } from "@workspace-template/data/recipe/schema";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace-template/ui/components/alert";
import { Button } from "@workspace-template/ui/components/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@workspace-template/ui/components/field";
import { Input } from "@workspace-template/ui/components/input";
import type { Route } from "next";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { createRecipeAction } from "@/app/recipes/actions";
import { editorValueFrom } from "@/components/recipe-editor/payload";
import { RecipeEditor } from "@/components/recipe-editor/recipe-editor";
import { buttonClass } from "@/lib/button-class";
import type { ImportErrorCode } from "@/lib/import/errors";

type ImportState =
  | { status: "idle" }
  | { host: string; status: "submitting" }
  | { code: ImportErrorCode; retryAfter: number | null; status: "error" }
  | { duplicate: { slug: string; title: string }; status: "duplicate" }
  | { draft: ExtractedRecipe; importId: string; status: "preview" };

const ERROR_COPY: Record<ImportErrorCode, string> = {
  BLOCKED_HOST: "That address can't be imported.",
  FETCH_FAILED: "We couldn't load that page. Check the link and try again.",
  INVALID_URL: "That doesn't look like a web link.",
  NO_RECIPE_FOUND: "We couldn't find a recipe on that page.",
  NOT_FOUND: "That page doesn't exist anymore.",
  NOT_HTML: "That link isn't a web page.",
  PAYWALLED: "That page looks like it needs a login or subscription.",
  RATE_LIMITED: "You've imported a lot recently.",
  TIMEOUT: "The site took too long to respond.",
  TOO_LARGE: "That page is too large to read.",
  UNAUTHENTICATED: "Sign in again to import recipes.",
};

function hostOf(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.hostname
      : null;
  } catch {
    return null;
  }
}

function writeItPath(url: string): Route {
  return `/recipes/new?mode=write&sourceUrl=${encodeURIComponent(url)}` as Route;
}

export function ImportFlow({ tagSuggestions }: { tagSuggestions: TagInput[] }) {
  const [url, setUrl] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [state, setState] = useState<ImportState>({ status: "idle" });

  async function runImport(force = false) {
    const host = hostOf(url);
    if (!host) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setState({ host, status: "submitting" });
    const response = await fetch("/api/import", {
      body: JSON.stringify({ force, url }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!(response?.ok && data)) {
      const retryAfter = Number(response?.headers.get("Retry-After")) || null;
      setState({
        code: data?.code ?? "FETCH_FAILED",
        retryAfter,
        status: "error",
      });
      return;
    }
    setState(
      data.duplicate
        ? { duplicate: data.duplicate, status: "duplicate" }
        : { draft: data.draft, importId: data.importId, status: "preview" }
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runImport();
  }

  if (state.status === "preview") {
    const { draft, importId } = state;
    return (
      <div className="mt-8">
        <RecipeEditor
          action={createRecipeAction}
          initialValue={editorValueFrom({
            ...draft,
            source: {
              imageUrl: draft.imageUrl,
              importedJsonLd: draft.importedJsonLd,
              importId,
              sourceName: draft.sourceName,
              sourceType: "URL_IMPORT",
              sourceUrl: draft.sourceUrl,
            },
            visibility: "PRIVATE",
          })}
          submitLabel="Save privately"
          tagSuggestions={tagSuggestions}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-xl space-y-6">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        noValidate
        onSubmit={handleSubmit}
      >
        <Field className="flex-1" data-invalid={invalid}>
          <FieldLabel htmlFor="import-url">Recipe link</FieldLabel>
          <Input
            aria-invalid={invalid}
            id="import-url"
            inputMode="url"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/best-lasagna"
            type="url"
            value={url}
          />
          {invalid && (
            <FieldError>Paste a full link starting with https://</FieldError>
          )}
        </Field>
        <Button
          disabled={state.status === "submitting"}
          size="lg"
          type="submit"
        >
          {state.status === "submitting" ? `Reading ${state.host}…` : "Import"}
        </Button>
      </form>

      {state.status === "duplicate" && (
        <Alert>
          <AlertTitle>You already imported this</AlertTitle>
          <AlertDescription>
            <p>“{state.duplicate.title}” is in your recipes.</p>
            <div className="mt-3 flex gap-2">
              <Link
                className={buttonClass({ size: "sm" })}
                href={`/recipes/${state.duplicate.slug}`}
              >
                Open it
              </Link>
              <Button
                onClick={() => runImport(true)}
                size="sm"
                variant="outline"
              >
                Import again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {state.status === "error" && (
        <Alert
          variant={state.code === "NO_RECIPE_FOUND" ? "default" : "destructive"}
        >
          <AlertTitle>{ERROR_COPY[state.code]}</AlertTitle>
          <AlertDescription>
            {state.code === "RATE_LIMITED" && state.retryAfter && (
              <p>Try again in {Math.ceil(state.retryAfter / 60)} minutes.</p>
            )}
            {(state.code === "NO_RECIPE_FOUND" ||
              state.code === "PAYWALLED") && (
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href={writeItPath(url)}
              >
                Write it yourself?
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
