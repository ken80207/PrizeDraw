"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/authStore";

const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_CODE_LENGTH = 6;

/**
 * Phone binding page shown after OAuth login when a player has not yet bound a phone number.
 *
 * Flow:
 * 1. User enters E.164 phone number and taps "Send OTP".
 * 2. POSTs to /api/v1/auth/otp/send.
 * 3. A 60-second resend countdown starts.
 * 4. User enters the 6-digit OTP and taps "Verify".
 * 5. POSTs to /api/v1/auth/phone/bind with the Authorization header from the stored access token.
 * 6. On success redirects to the home page.
 */
export default function PhoneBindingPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [phone, setPhone] = useState("");
  const [countryCode] = useState("+886");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(OTP_RESEND_COOLDOWN_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendOtp() {
    if (!phone.trim()) {
      setError("Please enter a phone number in E.164 format (e.g. +886912345678)");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: `${countryCode}${phone}` }),
      });

      if (res.status === 429) {
        throw new Error("Too many OTP requests. Please wait before trying again.");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed to send OTP (${res.status})`);
      }

      setOtpSent(true);
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== OTP_CODE_LENGTH) {
      setError(`Please enter the ${OTP_CODE_LENGTH}-digit OTP code`);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/phone/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ phoneNumber: `${countryCode}${phone}`, otpCode: otp }),
      });

      if (res.status === 422) {
        throw new Error("Invalid or expired OTP code. Please try again.");
      }
      if (res.status === 409) {
        throw new Error("This phone number is already in use by another account.");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Verification failed (${res.status})`);
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#111125]">
      {/* Decorative blur blobs */}
      <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#ffc174]/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[#c0c1ff]/5 rounded-full blur-[100px] pointer-events-none z-0" />

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
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[#ffc174]">phone_iphone</span>
              <h2 className="font-headline text-xl font-bold text-[#e2e0fc]">{t("verifyPhone")}</h2>
            </div>
            <p className="text-sm text-[#d8c3ad] ml-9">
              {t("verifyDescDetail")}
            </p>
          </div>

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
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  disabled={loading || otpSent}
                  className="flex-1 bg-[#0c0c1f] border-none rounded-xl px-4 py-4 text-[#e2e0fc] placeholder:text-[#d8c3ad]/30 focus:outline-none focus:ring-1 focus:ring-[#ffc174] transition-all font-medium disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* OTP section — shown after OTP is sent */}
            {otpSent && (
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="font-body text-xs uppercase tracking-wider text-[#c0c1ff]/70 ml-1">
                    {t("verificationCode")}
                  </label>
                  <button
                    type="button"
                    onClick={() => { if (countdown <= 0) handleSendOtp(); }}
                    disabled={countdown > 0 || loading}
                    className="text-xs font-bold text-[#ffc174] hover:opacity-80 transition-opacity mb-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {countdown > 0 ? t("resendIn", { seconds: countdown }) : t("resendCode")}
                  </button>
                </div>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("codePlaceholder")}
                  maxLength={OTP_CODE_LENGTH}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH))}
                  disabled={loading}
                  className="w-full bg-[#0c0c1f] border-none rounded-xl px-4 py-4 text-[#e2e0fc] placeholder:text-[#d8c3ad]/30 tracking-[0.5em] text-center focus:outline-none focus:ring-1 focus:ring-[#ffc174] transition-all font-bold disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-center text-sm text-[#ffb4ab]">{error}</p>
            )}

            {/* CTA */}
            {!otpSent ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading || !phone.trim()}
                className="w-full h-16 rounded-xl amber-gradient text-[#472a00] font-headline font-bold text-lg shadow-[0_10px_25px_rgba(245,158,11,0.3)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.4)] transform hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#472a00] border-t-transparent" />
                ) : (
                  <>
                    <span>{t("sendCode")}</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                      send
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || otp.length !== OTP_CODE_LENGTH}
                className="w-full h-16 rounded-xl amber-gradient text-[#472a00] font-headline font-bold text-lg shadow-[0_10px_25px_rgba(245,158,11,0.3)] hover:shadow-[0_15px_30px_rgba(245,158,11,0.4)] transform hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#472a00] border-t-transparent" />
                ) : (
                  <>
                    <span>{t("activateAccount")}</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                      verified
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Footer link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#d8c3ad]">
              {t("alreadyHaveAccount")}{" "}
              <Link
                href="/login"
                className="text-[#ffc174] font-bold hover:underline decoration-[#ffc174]/30 underline-offset-4 ml-1"
              >
                {t("signIn")}
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
