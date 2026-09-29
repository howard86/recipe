"use client";

import {
  Alert,
  AlertDescription,
} from "@workspace-template/ui/components/alert";
import { Button } from "@workspace-template/ui/components/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@workspace-template/ui/components/field";
import { Input } from "@workspace-template/ui/components/input";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function SignInForm({
  googleEnabled,
  next,
}: {
  googleEnabled: boolean;
  next: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            name:
              String(form.get("name") ?? "") || email.split("@")[0] || "Cook",
            password,
          });
    setPending(false);
    if (result.error) {
      setError(
        result.error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : (result.error.message ?? "Something went wrong. Try again.")
      );
      return;
    }
    router.replace(next as Route);
    router.refresh();
  }

  return (
    <form className="mt-8" onSubmit={handleSubmit}>
      <FieldGroup>
        {mode === "sign-up" && (
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input autoComplete="name" id="name" name="name" />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            id="password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button disabled={pending} size="lg" type="submit">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
        {googleEnabled && (
          <>
            <FieldSeparator>or</FieldSeparator>
            <Button
              onClick={() =>
                authClient.signIn.social({
                  callbackURL: next,
                  provider: "google",
                })
              }
              size="lg"
              type="button"
              variant="outline"
            >
              Continue with Google
            </Button>
          </>
        )}
        <Button
          onClick={() => {
            setError(null);
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          }}
          type="button"
          variant="link"
        >
          {mode === "sign-in"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
