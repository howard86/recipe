import {
  extractRecipe,
  looksPaywalled,
} from "@workspace-template/data/recipe/jsonld";
import {
  findImportedRecipe,
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
import { fetchRecipePage } from "@/lib/import/safe-fetch";
import { normalizeUrl, validateImportUrl } from "@/lib/import/url";

const BodySchema = z.object({
  force: z.boolean().optional(),
  url: z.string().trim().min(1).max(2048),
});

function errorResponse(code: ImportErrorCode, message: string = code) {
  return Response.json(
    { code, message },
    { status: IMPORT_ERROR_STATUS[code] }
  );
}

/**
 * Fetches a recipe page server-side and returns a normalised draft. Nothing is
 * saved to Recipe here: the user reviews the draft and saves via createRecipe.
 * Every attempt past validation lands in the RecipeImport ledger, which backs
 * the duplicate check. No rate limit: only allowlisted accounts can sign in.
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
      ? errorResponse(error.code, error.message)
      : errorResponse("INVALID_URL");
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
