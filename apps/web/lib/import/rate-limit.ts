/**
 * Best-effort per-IP cap for abuse on top of the per-user ledger in
 * RecipeImport. In-memory, so it is per server instance; that is acceptable
 * for a coarse abuse brake, not for billing-grade limits.
 */
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

export function takeIpToken(
  ip: string,
  limit: number,
  now = Date.now()
): { ok: boolean; retryAfterSeconds: number } {
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    const oldest = recent[0] ?? now;
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((oldest + WINDOW_MS - now) / 1000),
    };
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) {
    const first = hits.keys().next().value;
    if (first !== undefined) {
      hits.delete(first);
    }
  }
  return { ok: true, retryAfterSeconds: 0 };
}
