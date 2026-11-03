export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(messageFrom(data) ?? `Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

// drf nests field errors per list item and per key, so the first readable message can sit a few levels down
function messageFrom(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return null;
  if ("detail" in data && typeof data.detail === "string") return data.detail;
  for (const value of Object.values(data)) {
    const message = messageFrom(value);
    if (message) return message;
  }
  return null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfToken(): string | null {
  return document.cookie.match(/(?:^|; )csrftoken=([^;]*)/)?.[1] ?? null;
}

let csrfCookie: Promise<unknown> | null = null;

function ensureCsrfCookie() {
  if (csrfToken()) return Promise.resolve();
  csrfCookie ??= fetch("/api/auth/csrf/", { credentials: "include" });
  return csrfCookie;
}

type SendOptions = Omit<RequestInit, "body"> & { json?: unknown; form?: FormData };

async function send(path: string, { json, form, ...init }: SendOptions = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const method = (init.method ?? "GET").toUpperCase();
  // the auth cookies go out on their own, so django wants proof the request came from our pages
  if (!SAFE_METHODS.has(method)) {
    await ensureCsrfCookie();
    const token = csrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }

  return fetch(`/api/${path.replace(/^\/+/, "")}`, {
    ...init,
    method,
    headers,
    // a FormData body sets its own multipart boundary header
    body: json === undefined ? form : JSON.stringify(json),
    credentials: "include",
  });
}

let refreshing: Promise<boolean> | null = null;

// concurrent 401s share one refresh, a second call would present an already rotated token
function refreshSession() {
  refreshing ??= send("auth/refresh/", { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RequestOptions = SendOptions & {
  refresh?: boolean;
  redirectToLogin?: boolean;
};

async function respond(path: string, { refresh = true, redirectToLogin = true, ...options }: RequestOptions) {
  let response = await send(path, options);
  if (response.status === 401 && refresh && (await refreshSession())) {
    response = await send(path, options);
  }
  if (response.status === 401 && redirectToLogin && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
  return response;
}

async function readJson(response: Response): Promise<unknown> {
  return response.headers.get("content-type")?.includes("application/json") ? response.json() : null;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await respond(path, options);
  const data = await readJson(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export async function requestFile(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await respond(path, {});
  if (!response.ok) throw new ApiError(response.status, await readJson(response));
  const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "download";
  return { blob: await response.blob(), filename };
}
