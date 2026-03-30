"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/services/apiClient";
import type { PlayerDto } from "@/stores/authStore";

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
  const t = useTranslations("auth");
  const router = useRouter();
  const [loading, setLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [countryCode] = useState("+886");

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#111125]">
      {/* Background blurred collectible image */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111125]/80 via-[#1a1a2e]/90 to-[#111125]" />
      </div>

      {/* Decorative blur blobs */}
      <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#ffc174]/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[#c0c1ff]/5 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Login container */}
      <main className="relative z-10 w-full max-w-[480px]">
        {/* Brand section */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="mb-4">
            <span
              className="material-symbols-outlined text-[#ffc174] text-5xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              diamond
            </span>
          </div>
          <h1
            className="font-headline text-4xl font-black tracking-tighter uppercase"
            style={{
              background: "linear-gradient(135deg, #ffc174 0%, #f59e0b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Kuji Noir
          </h1>
          <p className="font-body text-[#c0c1ff] text-xs uppercase tracking-[0.2em] mt-2 opacity-80">
            The Illuminated Gallery
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-panel rounded-2xl p-8 md:p-10 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          {/* Dev Mode Login */}
          {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
            <DevLoginPanel />
          )}

          {/* Social login — 3 buttons in a row */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <SocialButton
              provider="GOOGLE"
              icon="google"
              loading={loading === "GOOGLE"}
              disabled={loading !== null}
              onClick={() => handleLogin("GOOGLE")}
            />
            <SocialButton
              provider="APPLE"
              icon="ios"
              loading={loading === "APPLE"}
              disabled={loading !== null}
              onClick={() => handleLogin("APPLE")}
            />
            <SocialButton
              provider="LINE"
              icon="chat_bubble"
              loading={loading === "LINE"}
              disabled={loading !== null}
              onClick={() => handleLogin("LINE")}
            />
          </div>

          {/* Divider */}
          <div className="relative flex items-center mb-10">
            <div className="flex-grow border-t border-[#534434] opacity-20" />
            <span className="flex-shrink mx-4 text-xs font-body text-[#d8c3ad] uppercase tracking-widest">
              {t("orContinueWithPhone")}
            </span>
            <div className="flex-grow border-t border-[#534434] opacity-20" />
          </div>

          {/* Phone login form */}
          <div className="space-y-6">
            {/* Phone number input */}
            <div className="space-y-2">
              <label className="font-body text-xs uppercase tracking-wider text-[#c0c1ff]/70 ml-1">
                {t("phoneNumber")}
              </label>
              <div className="flex gap-2">
                <div className="w-24 bg-[#0c0c1f] rounded-xl flex items-center justify-center px-3 cursor-pointer">
                  <span className="text-sm font-medium text-[#e2e0fc]">{countryCode}</span>
                  <span className="material-symbols-outlined text-xs ml-1 opacity-50 text-[#e2e0fc]">
                    expand_more
                  </span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  aria-label={t("phoneNumber")}
                  className="flex-1 bg-[#0c0c1f] border-none rounded-xl px-4 py-4 text-[#e2e0fc] placeholder:text-[#d8c3ad]/30 focus:outline-none focus:ring-1 focus:ring-[#ffc174] transition-all font-medium"
                />
              </div>
            </div>

            {/* OTP input */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="font-body text-xs uppercase tracking-wider text-[#c0c1ff]/70 ml-1">
                  {t("verificationCode")}
                </label>
                <button
                  type="button"
                  className="text-xs font-bold text-[#ffc174] hover:opacity-80 transition-opacity mb-1"
                >
                  {t("getCode")}
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("codePlaceholder")}
                  aria-label={t("verificationCode")}
                  className="w-full bg-[#0c0c1f] border-none rounded-xl px-4 py-4 text-[#e2e0fc] placeholder:text-[#d8c3ad]/30 tracking-[0.5em] text-center focus:outline-none focus:ring-1 focus:ring-[#ffc174] transition-all font-bold"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-center text-sm text-[#ffb4ab]">{error}</p>
            )}

            {/* Primary CTA */}
            <button
              type="button"
              className="w-full h-16 rounded-xl amber-gradient text-[#472a00] font-headline font-bold text-lg shadow-[0_10px_25px_rgba(245,158,11,0.3)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.4)] transform hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4"
            >
              <span>{t("enterGallery")}</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>
          </div>

          {/* Footer toggle */}
          <div className="mt-10 text-center">
            <p className="text-sm text-[#d8c3ad]">
              {t("newHere")}{" "}
              <Link
                href="/phone-binding"
                className="text-[#ffc174] font-bold hover:underline decoration-[#ffc174]/30 underline-offset-4 ml-1"
              >
                {t("registerWithPhone")}
              </Link>
            </p>
          </div>
        </div>

        {/* Links footer */}
        <footer className="mt-8 flex justify-center gap-6">
          <a
            href="#"
            className="text-[10px] uppercase tracking-[0.2em] text-[#d8c3ad]/50 hover:text-[#e2e0fc] transition-colors"
          >
            {t("termsOfService")}
          </a>
          <span className="w-1 h-1 rounded-full bg-[#534434] opacity-30 mt-1" />
          <a
            href="#"
            className="text-[10px] uppercase tracking-[0.2em] text-[#d8c3ad]/50 hover:text-[#e2e0fc] transition-colors"
          >
            {t("privacyPolicy")}
          </a>
        </footer>
      </main>
    </div>
  );
}

interface SocialButtonProps {
  provider: OAuthProvider;
  icon: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

function SocialButton({ provider, icon, loading, disabled, onClick }: SocialButtonProps) {
  const providerLabel = provider === "GOOGLE" ? "Google" : provider === "APPLE" ? "Apple" : "LINE";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${providerLabel} 登入`}
      className="flex items-center justify-center h-14 bg-[#28283d] rounded-full hover:bg-[#37374d] transition-colors group disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#d8c3ad] border-t-transparent" />
      ) : (
        <span className="material-symbols-outlined text-[#d8c3ad] group-hover:text-[#ffc174] transition-colors">
          {icon}
        </span>
      )}
    </button>
  );
}

const DEV_PLAYERS = [
  { id: "00000000-0000-0000-0000-000000000001", nickname: "玩家小明" },
  { id: "00000000-0000-0000-0000-000000000002", nickname: "玩家小花" },
  { id: "00000000-0000-0000-0000-000000000003", nickname: "觀戰者小王" },
];

function DevLoginPanel() {
  const router = useRouter();
  const [devLoading, setDevLoading] = useState<string | null>(null);

  async function handleDevLogin(playerId: string) {
    setDevLoading(playerId);
    try {
      const res = await fetch("/api/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      if (!res.ok) throw new Error("Dev login failed");
      const { accessToken, refreshToken } = await res.json();

      // Persist tokens in httpOnly cookies via the session route (same as the
      // production OAuth flow) so the session survives across navigation.
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, refreshToken }),
      });

      const playerRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/players/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!playerRes.ok) throw new Error("Failed to fetch player");
      const player: PlayerDto = await playerRes.json();

      // Update the Zustand store (also persisted to localStorage via persist middleware).
      useAuthStore.getState().setSession(player, accessToken, refreshToken);
      router.push("/");
    } catch (e) {
      console.error("Dev login error:", e);
    } finally {
      setDevLoading(null);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-dashed border-[#ffc174]/40 bg-[#ffc174]/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[#ffc174] text-sm">engineering</span>
        <span className="text-xs font-bold text-[#ffc174] uppercase tracking-wider">Dev Mode</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {DEV_PLAYERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleDevLogin(p.id)}
            disabled={devLoading !== null}
            className="px-4 py-2 rounded-lg bg-[#28283d] border border-[#ffc174]/30 text-sm font-medium text-[#e2e0fc] hover:bg-[#37374d] transition-colors disabled:opacity-50"
          >
            {devLoading === p.id ? "..." : p.nickname}
          </button>
        ))}
      </div>
    </div>
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
