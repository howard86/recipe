"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace-template/ui/components/alert";
import { Button } from "@workspace-template/ui/components/button";
import { Input } from "@workspace-template/ui/components/input";
import { useActionState } from "react";
import { dismissHandleBannerAction, updateHandleAction } from "./actions";

/** Asks new users to pick a handle before anything they share shows their generated one. */
export function HandleBanner({ handle }: { handle: string }) {
  const [state, formAction, pending] = useActionState(updateHandleAction, {});
  return (
    <Alert>
      <AlertTitle>Pick your handle</AlertTitle>
      <AlertDescription>
        <p>
          Recipes you share show your handle. You&apos;re{" "}
          <strong>@{handle}</strong> for now.
        </p>
        <form
          action={formAction}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <span aria-hidden="true">@</span>
          <Input
            aria-label="Handle"
            className="max-w-48"
            defaultValue={handle}
            maxLength={30}
            name="handle"
            pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]"
            required
          />
          <Button disabled={pending} size="sm" type="submit">
            Save handle
          </Button>
          <Button
            formAction={dismissHandleBannerAction}
            formNoValidate
            size="sm"
            type="submit"
            variant="ghost"
          >
            Keep this one
          </Button>
        </form>
        {state.error && <p className="mt-2 text-destructive">{state.error}</p>}
      </AlertDescription>
    </Alert>
  );
}
