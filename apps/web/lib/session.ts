import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

/** The current session, deduplicated per request. Null when signed out. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

export async function getViewerId(): Promise<string | null> {
  return (await getSession())?.user.id ?? null;
}

export function signInPath(next?: string): Route {
  return (
    next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"
  ) as Route;
}

/**
 * For pages and actions that need a user: redirects to sign-in and back.
 * Every Server Action calls this (or getSession) itself rather than relying on
 * the proxy, whose matcher can silently stop covering a route.
 */
export async function requireUser(next = "/me") {
  const session = await getSession();
  if (!session) {
    redirect(signInPath(next));
  }
  return session.user;
}

/** Only same-site relative paths survive as a post-sign-in target. */
export function safeNextPath(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (
    !next?.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return "/me";
  }
  return next;
}
