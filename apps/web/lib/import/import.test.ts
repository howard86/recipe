import { describe, expect, test } from "bun:test";
import { isBlockedAddress } from "./address";
import { normalizeUrl, validateImportUrl } from "./url";

describe("isBlockedAddress", () => {
  test.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  test.each([
    "93.184.216.34",
    "2606:2800:220:1:248:1893:25c8:1946",
    "::ffff:93.184.216.34",
  ])("allows %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe("validateImportUrl", () => {
  test("accepts ordinary recipe links and drops the hash", () => {
    expect(validateImportUrl("https://example.com/r/1#jump").toString()).toBe(
      "https://example.com/r/1"
    );
  });

  test.each([
    ["ftp://example.com/x", "INVALID_URL"],
    ["https://user:pw@example.com/", "INVALID_URL"],
    ["not a url", "INVALID_URL"],
    ["https://example.com:8080/", "BLOCKED_HOST"],
    ["http://localhost/", "BLOCKED_HOST"],
    ["http://127.0.0.1/", "BLOCKED_HOST"],
    ["http://[::1]/", "BLOCKED_HOST"],
    ["http://169.254.169.254/latest/meta-data", "BLOCKED_HOST"],
    [`https://example.com/${"a".repeat(2100)}`, "INVALID_URL"],
  ])("rejects %s", (raw, code) => {
    expect(() => validateImportUrl(raw)).toThrow(
      expect.objectContaining({ code })
    );
  });

  test("normalizeUrl ignores www, tracking params and trailing slashes", () => {
    expect(
      normalizeUrl(new URL("http://WWW.Example.com/r/1/?utm_source=x&b=2&a=1"))
    ).toBe("https://example.com/r/1?a=1&b=2");
  });
});
