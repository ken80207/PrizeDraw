/**
 * Customer Service API client.
 *
 * Wraps fetch with automatic JSON handling, bearer token injection
 * from sessionStorage, and auto-redirect to /login on 401.
 *
 * Usage:
 *   const tickets = await apiClient.get<Ticket[]>("/api/v1/support/tickets");
 *   await apiClient.post("/api/v1/support/tickets/123/reply", { ticketId: "123", body: "..." });
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`${status}: ${message}`);
    this.name = "ApiError";
  }
}

function getCsToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("csAccessToken");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getCsToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      window.location.href = "/login";
    }
    throw new ApiError(401, "未授權，請重新登入");
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = err?.error ?? err?.message ?? message;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, body);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PUT", path, body);
  },
  delete<T>(path: string): Promise<T> {
    return request<T>("DELETE", path);
  },
};
