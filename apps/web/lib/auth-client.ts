import { createAuthClient } from "better-auth/react";

// Same-origin by default; set NEXT_PUBLIC_BETTER_AUTH_URL when auth lives elsewhere.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});
