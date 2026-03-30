/**
 * Authentication state store backed by Zustand with localStorage persistence.
 *
 * Exposes the authenticated player profile, in-memory token pair, and session
 * lifecycle actions. The store persists `player`, `accessToken`, `refreshToken`,
 * and `isAuthenticated` to localStorage so that auth state survives client-side
 * navigation (Next.js App Router does not unmount the React tree between routes,
 * but a fresh tab or hard-refresh must also restore the session).
 *
 * The public interface is identical to the previous singleton contract so all
 * call sites are non-breaking.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PlayerDto } from "./authStore.types";
export type { PlayerDto };
import { useWalletStore } from "./walletStore";

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
   * True once the persist middleware has finished reading from localStorage.
   * Components that guard routes should wait for this before redirecting to
   * avoid a flash redirect on the initial render where state is still the
   * default (unauthenticated) value.
   */
  _hasHydrated: boolean;

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

  /** Internal: called by the persist middleware once rehydration completes. */
  _setHasHydrated: (value: boolean) => void;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      player: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,

      _setHasHydrated(value) {
        set({ _hasHydrated: value });
      },

      setSession(player, accessToken, refreshToken) {
        set({ player, isAuthenticated: true, accessToken, refreshToken });
        // Seed the wallet store with the server-authoritative balances from the player profile.
        useWalletStore.getState().setBalances(player.drawPointsBalance, player.revenuePointsBalance);
      },

      clearSession() {
        set({ player: null, isAuthenticated: false, accessToken: null, refreshToken: null });
      },

      async refreshToken_(): Promise<boolean> {
        const currentRefreshToken = get().refreshToken;
        if (!currentRefreshToken) return false;

        try {
          const res = await fetch("/api/v1/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: currentRefreshToken }),
          });

          if (!res.ok) {
            get().clearSession();
            return false;
          }

          const data: TokenResponse = await res.json();
          set((state) => ({
            ...state,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          }));
          return true;
        } catch {
          get().clearSession();
          return false;
        }
      },
    }),
    {
      name: "prizedraw-auth",
      storage: createJSONStorage(() =>
        // Guard against SSR where window/localStorage is not available.
        typeof window !== "undefined" ? window.localStorage : (undefined as never)
      ),
      // Only persist the token pair and player — _hasHydrated is always reset
      // to false on a fresh page load and set to true after rehydration.
      partialize: (state) => ({
        player: state.player,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    }
  )
);

/**
 * Legacy singleton-style accessor for code that has not migrated to the hook.
 * Prefer `useAuthStore` in React components.
 */
export const authStore = {
  get player() {
    return useAuthStore.getState().player;
  },
  get isAuthenticated() {
    return useAuthStore.getState().isAuthenticated;
  },
  get accessToken() {
    return useAuthStore.getState().accessToken;
  },
  get refreshToken() {
    return useAuthStore.getState().refreshToken;
  },
  setSession: (player: PlayerDto, accessToken: string, refreshToken: string) =>
    useAuthStore.getState().setSession(player, accessToken, refreshToken),
  clearSession: () => useAuthStore.getState().clearSession(),
  refreshToken_: () => useAuthStore.getState().refreshToken_(),
};

/**
 * Subscribe to store changes.
 *
 * @param listener Callback invoked whenever state changes.
 * @returns Unsubscribe function.
 */
export function subscribeToAuthStore(listener: () => void): () => void {
  return useAuthStore.subscribe(listener);
}

// Expose store on window in non-production for E2E testing (Playwright).
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__AUTH_STORE__ = useAuthStore;
}
