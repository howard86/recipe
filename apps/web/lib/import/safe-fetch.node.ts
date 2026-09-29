// Node-only tests (`tsx --test`): Bun ships a stub for undici, so the guarded
// dispatcher cannot run under `bun test`.
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { fetchRecipePage } from "./safe-fetch";

const lenient = (raw: string) => new URL(raw);
const allowAll = { isAllowedAddress: () => true, validateUrl: lenient };

function respond(
  pathname: string,
  response: import("node:http").ServerResponse
) {
  if (pathname === "/recipe") {
    response
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end("<html>ok</html>");
  } else if (pathname === "/redirect") {
    response.writeHead(302, { location: "/recipe" }).end();
  } else if (pathname === "/loop") {
    response.writeHead(302, { location: "/loop" }).end();
  } else if (pathname === "/json") {
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
  } else if (pathname === "/big") {
    response
      .writeHead(200, { "content-type": "text/html" })
      .end("x".repeat(2048));
  } else if (pathname === "/slow") {
    setTimeout(
      () =>
        response.writeHead(200, { "content-type": "text/html" }).end("late"),
      500
    );
  } else {
    response.writeHead(404).end("nope");
  }
}

describe("fetchRecipePage", () => {
  let server: Server;
  let base = "";

  before(async () => {
    server = createServer((request, response) =>
      respond(new URL(request.url ?? "/", "http://x").pathname, response)
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  test("follows redirects and returns HTML", async () => {
    const page = await fetchRecipePage(`${base}/redirect`, allowAll);
    assert.equal(page.html, "<html>ok</html>");
    assert.equal(page.finalUrl, `${base}/recipe`);
  });

  test("guarded DNS refuses loopback even when the URL passes validation", async () => {
    await assert.rejects(
      fetchRecipePage(`${base}/recipe`, { validateUrl: lenient }),
      {
        code: "BLOCKED_HOST",
      }
    );
  });

  test("maps failures to error codes", async () => {
    await assert.rejects(fetchRecipePage(`${base}/loop`, allowAll), {
      code: "FETCH_FAILED",
    });
    await assert.rejects(fetchRecipePage(`${base}/json`, allowAll), {
      code: "NOT_HTML",
    });
    await assert.rejects(fetchRecipePage(`${base}/missing`, allowAll), {
      code: "NOT_FOUND",
    });
    await assert.rejects(
      fetchRecipePage(`${base}/big`, { ...allowAll, maxBytes: 1024 }),
      {
        code: "TOO_LARGE",
      }
    );
    await assert.rejects(
      fetchRecipePage(`${base}/slow`, { ...allowAll, timeoutMs: 100 }),
      {
        code: "TIMEOUT",
      }
    );
  });
});
