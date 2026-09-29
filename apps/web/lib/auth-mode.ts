/**
 * Which sign-in methods are on and who may use them. Production is
 * Google-only (no email sender exists, so there would be no verification or
 * password reset) and limited to AUTH_ALLOWED_EMAILS; outside production
 * email and password stay available and an empty allowlist admits anyone.
 */
export interface AuthMode {
  /** `null` means anyone may sign in (development without an allowlist). */
  allowedEmails: ReadonlySet<string> | null;
  emailPassword: boolean;
  google: { clientId: string; clientSecret: string } | null;
}

function parseEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function resolveAuthMode(
  env: Record<string, string | undefined>
): AuthMode {
  const production = env.NODE_ENV === "production";
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const allowed = parseEmails(env.AUTH_ALLOWED_EMAILS);
  return {
    // Fail closed: production with no allowlist admits nobody.
    allowedEmails: allowed.size > 0 || production ? allowed : null,
    emailPassword: !production,
    google: clientId && clientSecret ? { clientId, clientSecret } : null,
  };
}

export function isEmailAllowed(
  mode: AuthMode,
  email: string | null | undefined
): boolean {
  if (!mode.allowedEmails) {
    return true;
  }
  return Boolean(email) && mode.allowedEmails.has(String(email).toLowerCase());
}
