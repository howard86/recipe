"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
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
import { type SubmitEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

interface ErrorLike {
  code?: string;
  message?: string;
  status: number;
}

function describeError(error: ErrorLike): string {
  if (error.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (error.code === "EMAIL_NOT_VERIFIED") {
    return "Verify your email first. We just sent you a new link.";
  }
  return error.message ?? "Something went wrong. Try again.";
}

function GoogleButton({ next }: { next: string }) {
  return (
    <Button
      onClick={() =>
        authClient.signIn.social({
          callbackURL: next,
          errorCallbackURL: `/sign-in?next=${encodeURIComponent(next)}`,
          provider: "google",
        })
      }
      size="lg"
      type="button"
      variant="outline"
    >
      Continue with Google
    </Button>
  );
}

function EmailPasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ callbackURL: next, email, password })
        : await authClient.signUp.email({
            callbackURL: next,
            email,
            name:
              String(form.get("name") ?? "") || email.split("@")[0] || "Cook",
            password,
          });
    setPending(false);
    if (result.error) {
      setError(describeError(result.error));
      return;
    }
    if (mode === "sign-up") {
      // Verification is required: no session until the emailed link is used.
      setSentTo(email);
      return;
    }
    router.replace(next as Route);
    router.refresh();
  }

  if (sentTo) {
    return (
      <Alert>
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          We sent a verification link to {sentTo}. Open it to finish signing in.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
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

/** Shows only the sign-in methods that are on (production is Google-only). */
export function SignInForm({
  emailPassword,
  googleEnabled,
  next,
}: {
  emailPassword: boolean;
  googleEnabled: boolean;
  next: string;
}) {
  if (!(emailPassword || googleEnabled)) {
    return (
      <Alert className="mt-8" variant="destructive">
        <AlertTitle>Sign-in isn&apos;t available</AlertTitle>
        <AlertDescription>
          No sign-in method is configured. Set GOOGLE_CLIENT_ID and
          GOOGLE_CLIENT_SECRET.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="mt-8 grid gap-6">
      {googleEnabled && <GoogleButton next={next} />}
      {googleEnabled && emailPassword && <FieldSeparator>or</FieldSeparator>}
      {emailPassword && <EmailPasswordForm next={next} />}
    </div>
  );
}
