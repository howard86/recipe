import { prisma } from "@workspace-template/database";
import { ensureProfile } from "@workspace-template/database/profiles";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { isEmailAllowed, resolveAuthMode } from "./auth-mode";

export const authMode = resolveAuthMode(process.env);

const NOT_ALLOWED = "This account isn't allowed to sign in here.";

function assertAllowed(email: string | null | undefined) {
  if (!isEmailAllowed(authMode, email)) {
    throw new APIError("FORBIDDEN", { message: NOT_ALLOWED });
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    // The allowlist is checked when an account would be created and again on
    // every sign-in, so removing an address locks out an existing account.
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            select: { email: true },
            where: { id: session.userId },
          });
          assertAllowed(user?.email);
        },
      },
    },
    user: {
      create: {
        // Every user gets a Profile with a generated handle; /me prompts them
        // to pick their own before anything is shared.
        after: async (user) => {
          await ensureProfile(user.id, user.email || user.name || "cook");
        },
        before: (user) => {
          assertAllowed(user.email);
          return Promise.resolve();
        },
      },
    },
  },
  // Outside production only (see auth-mode.ts). No session until the email is
  // verified, matching what a real sender would enforce.
  emailAndPassword: {
    enabled: authMode.emailPassword,
    minPasswordLength: 8,
    requireEmailVerification: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignIn: true,
    sendOnSignUp: true,
    // Dev stand-in for an email sender: the link goes to the server console.
    // Unreachable in production, where email and password are disabled.
    sendVerificationEmail: ({ user, url }) => {
      console.info(`[auth] verify ${user.email}: ${url}`);
      return Promise.resolve();
    },
  },
  // OAuth failures (e.g. an address outside the allowlist) land back on /sign-in?error=…
  onAPIError: { errorURL: "/sign-in" },
  // nextCookies must stay last so Server Actions can set auth cookies.
  plugins: [nextCookies()],
  // Sign-in is limited to AUTH_ALLOWED_EMAILS, so no rate limiting for now (ADR 0006).
  rateLimit: { enabled: false },
  secret: process.env.BETTER_AUTH_SECRET,
  session: {
    // Every page reads the session; a signed 5-minute cookie cache saves a
    // database round trip per request. A revoked session can linger that long.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  socialProviders: authMode.google ? { google: authMode.google } : undefined,
});

export type Session = typeof auth.$Infer.Session;
