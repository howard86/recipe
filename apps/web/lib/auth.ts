export function getAuthConfig() {
  return {
    baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    hasSecret: Boolean(process.env.BETTER_AUTH_SECRET),
  };
}
