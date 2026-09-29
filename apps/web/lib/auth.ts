import { prisma } from "@workspace-template/database";
import { ensureProfile } from "@workspace-template/database/profiles";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { resolveAuthMode } from "./auth-mode";

export const authMode = resolveAuthMode(process.env);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    user: {
      create: {
        // Every user gets a Profile with a generated handle; /me prompts them
        // to pick their own before anything is shared.
        after: async (user) => {
          await ensureProfile(user.id, user.email || user.name || "cook");
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
  // nextCookies must stay last so Server Actions can set auth cookies.
  plugins: [nextCookies()],
  // Serverless instances don't share memory, so counters live in Postgres.
  // Better Auth's default rules already throttle sign-in and sign-up paths.
  rateLimit: { storage: "database" },
  secret: process.env.BETTER_AUTH_SECRET,
  session: {
    // Every page reads the session; a signed 5-minute cookie cache saves a
    // database round trip per request. A revoked session can linger that long.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  socialProviders: authMode.google ? { google: authMode.google } : undefined,
});

export type Session = typeof auth.$Infer.Session;
