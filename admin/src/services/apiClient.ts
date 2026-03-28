/**
 * Admin API client.
 *
 * Wraps fetch with automatic JSON handling and bearer token injection
 * from the admin session store.
 *
 * Usage:
 *   const orders = await apiClient.get<ShippingOrderDetail[]>("/api/v1/admin/shipping/orders");
 *   await apiClient.patch("/api/v1/admin/shipping/orders/{id}/ship", body);
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`${status}: ${message}`);
    this.name = "ApiError";
  }
}

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("adminAccessToken");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = await res.json();
      message = err?.error ?? err?.message ?? message;
    } catch {
      // ignore
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
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PUT", path, body);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },
  delete<T>(path: string): Promise<T> {
    return request<T>("DELETE", path);
  },
};

export { ApiError };
