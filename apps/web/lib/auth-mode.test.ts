import { describe, expect, test } from "bun:test";
import { resolveAuthMode } from "./auth-mode";

describe("resolveAuthMode", () => {
  test("production is Google-only", () => {
    expect(
      resolveAuthMode({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        NODE_ENV: "production",
      })
    ).toEqual({
      emailPassword: false,
      google: { clientId: "id", clientSecret: "secret" },
    });
  });

  test("production without Google credentials has no sign-in method", () => {
    expect(resolveAuthMode({ NODE_ENV: "production" })).toEqual({
      emailPassword: false,
      google: null,
    });
  });

  test("development keeps email and password", () => {
    expect(resolveAuthMode({ NODE_ENV: "development" })).toEqual({
      emailPassword: true,
      google: null,
    });
  });

  test("half-configured Google counts as off", () => {
    expect(
      resolveAuthMode({ GOOGLE_CLIENT_ID: "id", NODE_ENV: "development" })
        .google
    ).toBeNull();
  });
});
