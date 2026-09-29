import { prisma } from "@workspace-template/database";
import { ensureProfile } from "@workspace-template/database/profiles";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const googleEnabled = Boolean(googleClientId && googleClientSecret);

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
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // nextCookies must stay last so Server Actions can set auth cookies.
  plugins: [nextCookies()],
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : undefined,
});

export type Session = typeof auth.$Infer.Session;
