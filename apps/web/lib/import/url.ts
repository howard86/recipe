import { isIP } from "node:net";
import { isBlockedAddress } from "./address";
import { ImportError } from "./errors";

const MAX_URL_LENGTH = 2048;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const IPV6_BRACKETS_PATTERN = /^\[|\]$/g;
const TRACKING_PARAM_PATTERN = /^(utm_|fbclid$|gclid$|mc_(cid|eid)$)/i;
const TRAILING_SLASH_PATTERN = /\/+$/;
const WWW_PREFIX_PATTERN = /^www\./;

export function hostnameOf(url: URL): string {
  return url.hostname.replace(IPV6_BRACKETS_PATTERN, "");
}

/**
 * Syntactic checks before any network access: http(s) only, no credentials,
 * default ports only, bounded length, and IP-literal hosts screened directly
 * (the DNS lookup hook never sees those).
 */
export function validateImportUrl(raw: string): URL {
  if (raw.length > MAX_URL_LENGTH) {
    throw new ImportError("INVALID_URL", { message: "URL is too long" });
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch (error) {
    throw new ImportError("INVALID_URL", {
      cause: error,
      message: "Not a valid URL",
    });
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ImportError("INVALID_URL", {
      message: "Only http and https links can be imported",
    });
  }
  if (url.username || url.password) {
    throw new ImportError("INVALID_URL", {
      message: "Links with credentials are not allowed",
    });
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new ImportError("BLOCKED_HOST", {
      message: "Only standard ports are allowed",
    });
  }
  const host = hostnameOf(url);
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    throw new ImportError("BLOCKED_HOST");
  }
  if (isIP(host) && isBlockedAddress(host)) {
    throw new ImportError("BLOCKED_HOST");
  }
  url.hash = "";
  return url;
}

/** Key for duplicate detection: lowercase host, no www, tracking params or trailing slash. */
export function normalizeUrl(url: URL): string {
  const copy = new URL(url);
  copy.hash = "";
  copy.hostname = copy.hostname.toLowerCase().replace(WWW_PREFIX_PATTERN, "");
  copy.protocol = "https:";
  for (const key of [...copy.searchParams.keys()]) {
    if (TRACKING_PARAM_PATTERN.test(key)) {
      copy.searchParams.delete(key);
    }
  }
  copy.searchParams.sort();
  copy.pathname = copy.pathname.replace(TRAILING_SLASH_PATTERN, "") || "/";
  return copy.toString();
}
