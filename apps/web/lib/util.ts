export function getBackendUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_EXCHANGE_API_URL?.replace(/\/api\/v1\/?$/, "");

  return configuredUrl?.replace(/\/$/, "") ?? "http://localhost:3001";
}
