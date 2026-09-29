/** Absolute URL for canonical links and JSON-LD. */
export function absoluteUrl(path: string): string {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}
