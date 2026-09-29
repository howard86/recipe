import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { fetchRecipePage } from "./safe-fetch";

const lenient = (raw: string) => new URL(raw);
const allowAll = { isAllowedAddress: () => true, validateUrl: lenient };

function respond(pathname: string, response: ServerResponse) {
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

  beforeAll(async () => {
    server = createServer((request, response) =>
      respond(new URL(request.url ?? "/", "http://x").pathname, response)
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  test("follows redirects and returns HTML", async () => {
    const page = await fetchRecipePage(`${base}/redirect`, allowAll);
    expect(page.html).toBe("<html>ok</html>");
    expect(page.finalUrl).toBe(`${base}/recipe`);
  });

  test("guarded DNS refuses loopback even when the URL passes validation", async () => {
    await expect(
      fetchRecipePage(`${base}/recipe`, { validateUrl: lenient })
    ).rejects.toMatchObject({
      code: "BLOCKED_HOST",
    });
  });

  test("maps failures to error codes", async () => {
    await expect(
      fetchRecipePage(`${base}/loop`, allowAll)
    ).rejects.toMatchObject({ code: "FETCH_FAILED" });
    await expect(
      fetchRecipePage(`${base}/json`, allowAll)
    ).rejects.toMatchObject({ code: "NOT_HTML" });
    await expect(
      fetchRecipePage(`${base}/missing`, allowAll)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      fetchRecipePage(`${base}/big`, { ...allowAll, maxBytes: 1024 })
    ).rejects.toMatchObject({
      code: "TOO_LARGE",
    });
    await expect(
      fetchRecipePage(`${base}/slow`, { ...allowAll, timeoutMs: 100 })
    ).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});
