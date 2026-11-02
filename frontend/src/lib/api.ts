/**
 * Fetch wrapper for the Django API.
 *
 * Requests go to same-origin /api/* paths, which Next.js proxies to the API
 * service (see next.config.ts), so session cookies work without CORS.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

/** Call the API, e.g. `api<Health>("health/")` requests `/api/health/`. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const response = await fetch(`/api/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data: unknown = isJson ? await response.json() : null;

  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}
