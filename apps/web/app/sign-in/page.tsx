import {
  Alert,
  AlertDescription,
} from "@workspace-template/ui/components/alert";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authMode } from "@/lib/auth";
import { getSession, safeNextPath } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { error, next } = await searchParams;
  const target = safeNextPath(next);
  if (await getSession()) {
    redirect(target as never);
  }
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-heading text-4xl">Welcome to the kitchen</h1>
      <p className="mt-2 text-muted-foreground">
        Sign in to save recipes, log what you cook, and keep private notes.
      </p>
      {error && (
        <Alert className="mt-6" variant="destructive">
          <AlertDescription>
            That account can&apos;t sign in here. Sign-in is limited to approved
            accounts.
          </AlertDescription>
        </Alert>
      )}
      <SignInForm
        emailPassword={authMode.emailPassword}
        googleEnabled={Boolean(authMode.google)}
        next={target}
      />
    </main>
  );
}
