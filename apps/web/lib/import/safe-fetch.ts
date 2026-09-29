import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { Agent, request } from "undici";
import { isBlockedAddress } from "./address";
import { ImportError } from "./errors";
import { validateImportUrl } from "./url";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "RecipeBoxImporter/1.0 (+recipe import; contact site owner)";
const HTML_TYPE_PATTERN = /^(text\/html|application\/xhtml\+xml)\b/i;
const CHARSET_PATTERN = /charset=["']?([\w-]+)/i;

export interface SafeFetchOptions {
  /** Test seam: which resolved addresses may be connected to. */
  isAllowedAddress?: (address: string) => boolean;
  maxBytes?: number;
  timeoutMs?: number;
  /** Test seam: per-hop URL validation (defaults to validateImportUrl). */
  validateUrl?: (raw: string) => URL;
}

/**
 * DNS resolution happens here, inside the socket connect: every resolved
 * address is checked and the connection goes to exactly the addresses that
 * passed, so a second (rebinding) resolution never happens.
 */
function guardedLookup(
  isAllowed: (address: string) => boolean
): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(
      hostname,
      { all: true, family: options.family ?? 0 },
      (error, addresses) => {
        if (error) {
          callback(error, "", 0);
          return;
        }
        const list = addresses as LookupAddress[];
        if (!list.length || list.some((entry) => !isAllowed(entry.address))) {
          callback(new ImportError("BLOCKED_HOST"), "", 0);
          return;
        }
        if (options.all) {
          (callback as unknown as (err: null, all: LookupAddress[]) => void)(
            null,
            list
          );
          return;
        }
        const [first] = list;
        callback(null, first?.address ?? "", first?.family ?? 4);
      }
    );
  };
}

function decode(buffer: Uint8Array, contentType: string): string {
  const charset = contentType.match(CHARSET_PATTERN)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function readCapped(body: AsyncIterable<Uint8Array>, maxBytes: number) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      // Leaving the loop closes the stream without reading the rest.
      break;
    }
    chunks.push(chunk);
  }
  if (total > maxBytes) {
    throw new ImportError("TOO_LARGE");
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function headerValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function mapStatus(status: number): ImportError {
  if (status === 404 || status === 410) {
    return new ImportError("NOT_FOUND");
  }
  if (status === 401 || status === 402) {
    return new ImportError("PAYWALLED");
  }
  return new ImportError("FETCH_FAILED", {
    message: `Upstream responded ${status}`,
  });
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      error.name === "HeadersTimeoutError")
  );
}

type Hop = { redirect: URL } | { finalUrl: string; html: string };

async function requestOnce(
  url: URL,
  context: {
    dispatcher: Agent;
    maxBytes: number;
    signal: AbortSignal;
    validate: (raw: string) => URL;
  }
): Promise<Hop> {
  const { body, headers, statusCode } = await request(url, {
    dispatcher: context.dispatcher,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": USER_AGENT,
    },
    method: "GET",
    signal: context.signal,
  });
  if (statusCode >= 300 && statusCode < 400) {
    await body.dump();
    const location = headerValue(headers.location);
    if (!location) {
      throw new ImportError("FETCH_FAILED", {
        message: "Redirect without a location",
      });
    }
    return { redirect: context.validate(new URL(location, url).toString()) };
  }
  if (statusCode < 200 || statusCode >= 300) {
    await body.dump();
    throw mapStatus(statusCode);
  }
  const contentType = headerValue(headers["content-type"]);
  if (!HTML_TYPE_PATTERN.test(contentType)) {
    await body.dump();
    throw new ImportError("NOT_HTML");
  }
  if (Number(headerValue(headers["content-length"])) > context.maxBytes) {
    await body.dump();
    throw new ImportError("TOO_LARGE");
  }
  const buffer = await readCapped(body, context.maxBytes);
  return { finalUrl: url.toString(), html: decode(buffer, contentType) };
}

function toImportError(error: unknown, signal: AbortSignal): ImportError {
  if (error instanceof ImportError) {
    return error;
  }
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof ImportError) {
    return cause;
  }
  if (isAbort(error) || signal.aborted) {
    return new ImportError("TIMEOUT", {
      cause: error,
      message: "The site took too long to respond",
    });
  }
  return new ImportError("FETCH_FAILED", {
    cause: error,
    message: "Could not reach the site",
  });
}

/**
 * Fetches an HTML page for import with SSRF controls: validated URL, guarded
 * DNS with pinned addresses, manual redirects re-validated per hop (max 3),
 * one overall timeout, a streamed size cap and an HTML content-type check.
 */
export async function fetchRecipePage(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<{ finalUrl: string; html: string }> {
  const isAllowed =
    options.isAllowedAddress ?? ((address) => !isBlockedAddress(address));
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const dispatcher = new Agent({
    connect: { lookup: guardedLookup(isAllowed) },
    connectTimeout: timeoutMs,
  });
  const signal = AbortSignal.timeout(timeoutMs);
  const validate = options.validateUrl ?? validateImportUrl;
  const context = {
    dispatcher,
    maxBytes: options.maxBytes ?? MAX_BYTES,
    signal,
    validate,
  };
  try {
    let url = validate(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: each redirect hop depends on the previous response.
      const result = await requestOnce(url, context);
      if (!("redirect" in result)) {
        return result;
      }
      url = result.redirect;
    }
    throw new ImportError("FETCH_FAILED", { message: "Too many redirects" });
  } catch (error) {
    throw toImportError(error, signal);
  } finally {
    await dispatcher.close().catch(() => undefined);
  }
}
