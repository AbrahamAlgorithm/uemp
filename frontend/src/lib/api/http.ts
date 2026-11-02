export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(messageFrom(data) ?? `Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

function messageFrom(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if ("detail" in data && typeof data.detail === "string") return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function csrfToken(): string | null {
  return document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? null;
}

type RequestOptions = Omit<RequestInit, "body"> & { json?: unknown };

export async function request<T>(path: string, { json, ...init }: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const method = init.method ?? "GET";
  // django session auth rejects unsafe methods without it
  if (method !== "GET") {
    const token = csrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }

  const response = await fetch(`/api/${path.replace(/^\/+/, "")}`, {
    ...init,
    method,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    credentials: "include",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data: unknown = isJson ? await response.json() : null;

  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}
