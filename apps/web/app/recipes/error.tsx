"use client";

import { Button } from "@workspace-template/ui/components/button";

export default function RecipesError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
      <h1 className="font-heading text-4xl">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn&apos;t load recipes. Try again in a moment.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
