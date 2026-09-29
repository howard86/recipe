export type ImportErrorCode =
  | "BLOCKED_HOST"
  | "FETCH_FAILED"
  | "INVALID_URL"
  | "NO_RECIPE_FOUND"
  | "NOT_FOUND"
  | "NOT_HTML"
  | "PAYWALLED"
  | "TIMEOUT"
  | "TOO_LARGE"
  | "UNAUTHENTICATED";

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(
    code: ImportErrorCode,
    options: { cause?: unknown; message?: string } = {}
  ) {
    super(options.message ?? code, { cause: options.cause });
    this.code = code;
    this.name = "ImportError";
  }
}

export const IMPORT_ERROR_STATUS: Record<ImportErrorCode, number> = {
  BLOCKED_HOST: 400,
  FETCH_FAILED: 502,
  INVALID_URL: 400,
  NO_RECIPE_FOUND: 422,
  NOT_FOUND: 422,
  NOT_HTML: 422,
  PAYWALLED: 422,
  TIMEOUT: 504,
  TOO_LARGE: 422,
  UNAUTHENTICATED: 401,
};
