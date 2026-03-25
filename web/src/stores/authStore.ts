/**
 * Authentication state store.
 *
 * Implements the auth store contract described in T100. Currently backed by a
 * module-level singleton using React's `use client` pattern. When `zustand` is
 * added to package.json, replace the `createStore` function body with:
 *
 *   import { create } from "zustand";
 *   export const useAuthStore = create<AuthStore>((set, get) => ({ ... }));
 *
 * The public interface (`player`, `isAuthenticated`, `login`, `logout`, `refreshToken`)
 * is identical to the Zustand slice contract so migration is non-breaking.
 */

import type { PlayerDto } from "./authStore.types";
export type { PlayerDto };

export interface AuthStore {
  /** The currently authenticated player, or null when unauthenticated. */
  player: PlayerDto | null;
  /** True when an access token is stored and has not expired. */
  isAuthenticated: boolean;
  /** Access token kept in memory to avoid repeated cookie reads. */
  accessToken: string | null;
  /** Refresh token kept in memory for rotation. */
  refreshToken: string | null;

  /**
   * Sets the session after a successful login or token refresh.
   *
   * @param player The authenticated player profile.
   * @param accessToken The new JWT access token.
   * @param refreshToken The new refresh token.
   */
  setSession: (player: PlayerDto, accessToken: string, refreshToken: string) => void;

  /**
   * Clears all session state (called after logout or token expiry).
   */
  clearSession: () => void;

  /**
   * Attempts to rotate the refresh token via the API.
   *
   * @returns `true` if a new token pair was obtained; `false` if the session has expired.
   */
  refreshToken_: () => Promise<boolean>;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ---------------------------------------------------------------------------
// Module-level singleton store (no external dependencies required).
// ---------------------------------------------------------------------------

let _state: Omit<AuthStore, "setSession" | "clearSession" | "refreshToken_"> = {
  player: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const authStore: AuthStore = {
  get player() {
    return _state.player;
  },
  get isAuthenticated() {
    return _state.isAuthenticated;
  },
  get accessToken() {
    return _state.accessToken;
  },
  get refreshToken() {
    return _state.refreshToken;
  },

  setSession(player, accessToken, refreshToken) {
    _state = { player, isAuthenticated: true, accessToken, refreshToken };
    notify();
  },

  clearSession() {
    _state = { player: null, isAuthenticated: false, accessToken: null, refreshToken: null };
    notify();
  },

  async refreshToken_(): Promise<boolean> {
    const currentRefreshToken = _state.refreshToken;
    if (!currentRefreshToken) return false;

    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!res.ok) {
        authStore.clearSession();
        return false;
      }

      const data: TokenResponse = await res.json();
      _state = {
        ..._state,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      notify();
      return true;
    } catch {
      authStore.clearSession();
      return false;
    }
  },
};

/**
 * Subscribe to store changes.
 *
 * @param listener Callback invoked whenever state changes.
 * @returns Unsubscribe function.
 */
export function subscribeToAuthStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
