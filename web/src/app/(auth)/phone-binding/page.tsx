"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({ phoneNumber: phone }),
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
      // Read access token from cookie / store
      const accessToken = getStoredAccessToken();

      const res = await fetch("/api/v1/auth/phone/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ phoneNumber: phone, otpCode: otp }),
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Verify Your Phone
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500">
          We need your phone number to activate your account.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="phone"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+886912345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          {!otpSent ? (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading || !phone.trim()}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? <Spinner /> : "Send OTP"}
            </button>
          ) : (
            <>
              <div>
                <label
                  htmlFor="otp"
                  className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  maxLength={OTP_CODE_LENGTH}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH))}
                  disabled={loading}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || otp.length !== OTP_CODE_LENGTH}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {loading ? <Spinner /> : "Verify"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (countdown <= 0) handleSendOtp();
                }}
                disabled={countdown > 0 || loading}
                className="text-center text-sm text-zinc-500 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400"
              >
                {countdown > 0 ? `Resend OTP in ${countdown}s` : "Resend OTP"}
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
  );
}

/**
 * Returns the stored access token from a cookie or localStorage.
 *
 * TODO: replace with reading from httpOnly cookie via middleware or from authStore.
 */
function getStoredAccessToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)access_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
