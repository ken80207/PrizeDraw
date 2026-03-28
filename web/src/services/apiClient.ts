/**
 * Fetch wrapper providing:
 * - Automatic `Authorization: Bearer {accessToken}` header injection from `authStore`.
 * - Automatic token refresh on 401 responses (single retry).
 * - JSON serialisation / deserialisation helpers.
 *
 * Usage:
 *   const player = await apiClient.get<PlayerDto>("/api/v1/players/me");
 *   const intent = await apiClient.post<PaymentIntentDto>("/api/v1/payment/orders", body);
 */

import { authStore } from "@/stores/authStore";

// Base URL for all API calls. Override via NEXT_PUBLIC_API_BASE_URL env var.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const accessToken = authStore.accessToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options.signal,
    });
  } catch (networkError) {
    // Network error (server unreachable, CORS, DNS failure, etc.)
    throw new ApiError(0, "無法連線至伺服器，請確認網路連線後再試");
  }

  // Auto-refresh on 401 (only retry once)
  if (res.status === 401 && !isRetry) {
    const refreshed = await authStore.refreshToken_();
    if (refreshed) {
      return request<T>(method, path, body, options, true);
    }
    // Refresh failed — clear session so the UI can redirect to login
    authStore.clearSession();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const errorBody = await res.json();
      errorMessage = errorBody?.error ?? errorBody?.message ?? errorMessage;
    } catch {
      // Ignore JSON parse errors for error bodies
    }
    if (res.status === 502 || res.status === 503) {
      errorMessage = "伺服器暫時無法提供服務，請稍後再試";
    }
    throw new ApiError(res.status, errorMessage);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  /**
   * Performs a GET request and returns the parsed JSON response.
   *
   * @param path API path (relative to base URL).
   * @param options Optional fetch options.
   * @returns Parsed response body.
   */
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },

  /**
   * Performs a POST request with a JSON body and returns the parsed JSON response.
   *
   * @param path API path.
   * @param body Request body (will be JSON-serialised).
   * @param options Optional fetch options.
   * @returns Parsed response body.
   */
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, body, options);
  },

  /**
   * Performs a PATCH request with a JSON body and returns the parsed JSON response.
   *
   * @param path API path.
   * @param body Partial update body (will be JSON-serialised).
   * @param options Optional fetch options.
   * @returns Parsed response body.
   */
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },

  /**
   * Performs a PUT request with an optional JSON body and returns the parsed JSON response (if any).
   *
   * @param path API path.
   * @param body Optional request body (will be JSON-serialised).
   * @param options Optional fetch options.
   * @returns Parsed response body, or undefined for 204 responses.
   */
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PUT", path, body, options);
  },

  /**
   * Performs a DELETE request and returns the parsed JSON response (if any).
   *
   * @param path API path.
   * @param options Optional fetch options.
   * @returns Parsed response body, or undefined for 204 responses.
   */
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },
};

export { ApiError };
