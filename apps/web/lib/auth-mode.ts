/**
 * Which sign-in methods are on. Production is Google-only (no email sender
 * exists, so there would be no verification or password reset); email and
 * password stay available outside production for local work.
 */
export interface AuthMode {
  emailPassword: boolean;
  google: { clientId: string; clientSecret: string } | null;
}

export function resolveAuthMode(
  env: Record<string, string | undefined>
): AuthMode {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  return {
    emailPassword: env.NODE_ENV !== "production",
    google: clientId && clientSecret ? { clientId, clientSecret } : null,
  };
}
