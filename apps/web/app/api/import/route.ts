import {
  extractRecipe,
  looksPaywalled,
} from "@workspace-template/data/recipe/jsonld";
import {
  countImportsSince,
  findImportedRecipe,
  oldestImportSince,
  recordImport,
} from "@workspace-template/database/imports";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  IMPORT_ERROR_STATUS,
  ImportError,
  type ImportErrorCode,
} from "@/lib/import/errors";
import { takeIpToken } from "@/lib/import/rate-limit";
import { fetchRecipePage } from "@/lib/import/safe-fetch";
import { normalizeUrl, validateImportUrl } from "@/lib/import/url";

const USER_LIMIT_PER_HOUR = 20;
const IP_LIMIT_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

const BodySchema = z.object({
  force: z.boolean().optional(),
  url: z.string().trim().min(1).max(2048),
});

function errorResponse(
  code: ImportErrorCode,
  init: { message?: string; retryAfter?: number } = {}
) {
  return Response.json(
    { code, message: init.message ?? code },
    {
      headers: init.retryAfter
        ? { "Retry-After": String(init.retryAfter) }
        : undefined,
      status: IMPORT_ERROR_STATUS[code],
    }
  );
}

function clientIp(requestHeaders: Headers): string {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

async function userRetryAfter(userId: string): Promise<number | null> {
  const since = new Date(Date.now() - HOUR_MS);
  if ((await countImportsSince(userId, since)) < USER_LIMIT_PER_HOUR) {
    return null;
  }
  const oldest = await oldestImportSince(userId, since);
  const resetAt = (oldest?.createdAt.getTime() ?? Date.now()) + HOUR_MS;
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

/**
 * Fetches a recipe page server-side and returns a normalised draft. Nothing is
 * saved to Recipe here: the user reviews the draft and saves via createRecipe.
 * Every attempt past validation lands in the RecipeImport ledger, which is
 * both the per-user rate limit and the duplicate check.
 */
export async function POST(request: Request) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return errorResponse("UNAUTHENTICATED");
  }
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse("INVALID_URL");
  }

  let url: URL;
  try {
    url = validateImportUrl(body.data.url);
  } catch (error) {
    return error instanceof ImportError
      ? errorResponse(error.code, { message: error.message })
      : errorResponse("INVALID_URL");
  }

  const ipToken = takeIpToken(clientIp(requestHeaders), IP_LIMIT_PER_HOUR);
  if (!ipToken.ok) {
    return errorResponse("RATE_LIMITED", {
      retryAfter: ipToken.retryAfterSeconds,
    });
  }
  const retryAfter = await userRetryAfter(session.user.id);
  if (retryAfter) {
    return errorResponse("RATE_LIMITED", { retryAfter });
  }

  const normalizedUrl = normalizeUrl(url);
  if (!body.data.force) {
    const duplicate = await findImportedRecipe(session.user.id, normalizedUrl);
    if (duplicate) {
      return Response.json({ duplicate });
    }
  }

  const ledger = {
    normalizedUrl,
    url: url.toString(),
    userId: session.user.id,
  };
  try {
    const page = await fetchRecipePage(url.toString());
    const draft = extractRecipe(page.html, page.finalUrl);
    if (!draft) {
      throw new ImportError(
        looksPaywalled(page.html) ? "PAYWALLED" : "NO_RECIPE_FOUND"
      );
    }
    const { id } = await recordImport({ ...ledger, status: "SUCCEEDED" });
    return Response.json({ draft, importId: id });
  } catch (error) {
    const code = error instanceof ImportError ? error.code : "FETCH_FAILED";
    await recordImport({ ...ledger, errorCode: code, status: "FAILED" });
    return errorResponse(code);
  }
}
