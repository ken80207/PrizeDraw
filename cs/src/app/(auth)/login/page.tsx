"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/services/apiClient";

interface StaffLoginResponse {
  accessToken: string;
  staffId: string;
  name: string;
  role: string;
}

const ALLOWED_ROLES = new Set([
  "CUSTOMER_SERVICE",
  "SUPPORT",
  "ADMIN",
  "SUPER_ADMIN",
]);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Add STAFF_LOGIN = "/api/v1/auth/staff/login" to AuthEndpoints in api-contracts.
      const res = await apiClient.post<StaffLoginResponse>(
        "/api/v1/auth/staff/login",
        { email, password },
      );

      if (!ALLOWED_ROLES.has(res.role)) {
        setError("您的帳號沒有客服系統存取權限，請聯絡管理員。");
        return;
      }

      sessionStorage.setItem("csAccessToken", res.accessToken);
      sessionStorage.setItem("csStaffId", res.staffId);
      sessionStorage.setItem("csStaffName", res.name);
      sessionStorage.setItem("csRole", res.role);

      router.push("/tickets");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("電子郵件或密碼不正確，請再試一次。");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("您的帳號沒有客服系統存取權限。");
      } else {
        setError(
          err instanceof Error ? err.message : "登入失敗，請稍後再試。",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-bold shadow-lg">
            CS
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PrizeDraw 客服系統</h1>
          <p className="mt-1 text-sm text-slate-500">客服人員專用，請登入繼續</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="mt-0.5 flex-shrink-0 text-red-500">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              電子郵件
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cs@prizedraw.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              密碼
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                登入中...
              </span>
            ) : (
              "登入"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          僅限授權客服人員使用
        </p>
      </div>
    </div>
  );
}
