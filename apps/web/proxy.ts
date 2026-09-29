import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic redirect only: checks that a session cookie exists. Pages and
 * Server Actions still verify the session themselves.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }
  const url = new URL("/sign-in", request.url);
  url.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/me/:path*", "/recipes/new/:path*"],
};
