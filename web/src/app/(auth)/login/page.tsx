"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OAuthProvider = "GOOGLE" | "APPLE" | "LINE";

interface LoginRequest {
  provider: OAuthProvider;
  idToken: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// TODO: needsPhoneBinding is a server extension not yet in TokenResponse DTO.
// Add it to api-contracts TokenResponse or a separate LoginResponse wrapper.
interface LoginApiResponse extends TokenResponse {
  needsPhoneBinding?: boolean;
}

/**
 * OAuth social login page.
 *
 * Presents three provider buttons (Google, Apple, LINE). On click:
 * 1. Obtains the provider's ID token via the platform OAuth SDK (TODO: implement per-provider).
 * 2. POSTs to /api/v1/auth/login with provider + idToken.
 * 3. Stores the token pair in httpOnly cookies via the /api/auth/session Next.js API route.
 * 4. If the server returns `needsPhoneBinding=true`, redirects to the phone-binding page.
 * 5. Otherwise redirects to the home page.
 */
export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(provider: OAuthProvider) {
    setLoading(provider);
    setError(null);

    try {
      // TODO: replace with real provider SDK calls
      // Google: use @react-oauth/google or Google Identity Services
      // Apple:  use Sign In with Apple JS SDK
      // LINE:   use LINE SDK for Web (LIFF)
      const idToken = await getProviderIdToken(provider);

      const request: LoginRequest = { provider, idToken };
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Login failed (${res.status})`);
      }

      const data: LoginApiResponse = await res.json();

      // Persist tokens in httpOnly cookies via a Next.js API route
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
        }),
      });

      // Redirect based on account state
      if (data.needsPhoneBinding) {
        router.push("/phone-binding");
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          PrizeDraw
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500">
          Sign in to start drawing prizes
        </p>

        <div className="flex flex-col gap-3">
          <OAuthButton
            provider="GOOGLE"
            label="Continue with Google"
            loading={loading === "GOOGLE"}
            disabled={loading !== null}
            onClick={() => handleLogin("GOOGLE")}
          />
          <OAuthButton
            provider="APPLE"
            label="Continue with Apple"
            loading={loading === "APPLE"}
            disabled={loading !== null}
            onClick={() => handleLogin("APPLE")}
          />
          <OAuthButton
            provider="LINE"
            label="Continue with LINE"
            loading={loading === "LINE"}
            disabled={loading !== null}
            onClick={() => handleLogin("LINE")}
          />
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

interface OAuthButtonProps {
  provider: OAuthProvider;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

function OAuthButton({ label, loading, disabled, onClick }: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      ) : (
        label
      )}
    </button>
  );
}

/**
 * Stub function that returns a fake ID token for each OAuth provider.
 *
 * TODO: replace with real provider SDK integration:
 * - Google: window.google.accounts.id.prompt() or @react-oauth/google
 * - Apple: AppleID.auth.signIn() from Sign In with Apple JS
 * - LINE: liff.login() from LIFF SDK
 */
async function getProviderIdToken(provider: OAuthProvider): Promise<string> {
  // Stub: returns a deterministic fake token for testing
  return `stub-${provider.toLowerCase()}-id-token`;
}
