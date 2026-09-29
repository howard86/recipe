import { describe, expect, test } from "bun:test";
import { isEmailAllowed, resolveAuthMode } from "./auth-mode";

describe("resolveAuthMode", () => {
  test("production is Google-only and limited to the allowlist", () => {
    const mode = resolveAuthMode({
      AUTH_ALLOWED_EMAILS: " Me@Example.com , other@example.com",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      NODE_ENV: "production",
    });
    expect(mode.emailPassword).toBe(false);
    expect(mode.google).toEqual({ clientId: "id", clientSecret: "secret" });
    expect(isEmailAllowed(mode, "me@example.com")).toBe(true);
    expect(isEmailAllowed(mode, "stranger@example.com")).toBe(false);
    expect(isEmailAllowed(mode, null)).toBe(false);
  });

  test("production without an allowlist admits nobody", () => {
    const mode = resolveAuthMode({ NODE_ENV: "production" });
    expect(mode.google).toBeNull();
    expect(isEmailAllowed(mode, "me@example.com")).toBe(false);
  });

  test("development without an allowlist admits anyone", () => {
    const mode = resolveAuthMode({ NODE_ENV: "development" });
    expect(mode.emailPassword).toBe(true);
    expect(isEmailAllowed(mode, "anyone@example.com")).toBe(true);
  });

  test("development with an allowlist enforces it", () => {
    const mode = resolveAuthMode({
      AUTH_ALLOWED_EMAILS: "me@example.com",
      NODE_ENV: "development",
    });
    expect(isEmailAllowed(mode, "anyone@example.com")).toBe(false);
  });

  test("half-configured Google counts as off", () => {
    expect(
      resolveAuthMode({ GOOGLE_CLIENT_ID: "id", NODE_ENV: "development" })
        .google
    ).toBeNull();
  });
});
