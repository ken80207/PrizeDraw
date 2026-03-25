"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "超級管理員",
  ADMIN: "管理員",
  CUSTOMER_SERVICE: "客服專員",
  SUPPORT: "客服",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-indigo-100 text-indigo-700",
  CUSTOMER_SERVICE: "bg-sky-100 text-sky-700",
  SUPPORT: "bg-sky-100 text-sky-700",
};

function readSession(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return sessionStorage.getItem(key) ?? fallback;
}

export function CsTopBar() {
  const router = useRouter();
  const [staffName] = useState<string>(() => readSession("csStaffName", "客服人員"));
  const [staffRole] = useState<string>(() => readSession("csRole", "CUSTOMER_SERVICE"));
  const [unreadCount] = useState<number>(() => {
    const stored = readSession("csUnreadCount", "0");
    return Number(stored) || 0;
  });

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }
    router.push("/login");
  };

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-5">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          CS
        </div>
        <span className="hidden text-sm font-semibold text-slate-800 sm:block">
          PrizeDraw 客服系統
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Unread bell */}
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="未讀通知"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-xs font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Staff info */}
        <div className="flex items-center gap-2">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-medium leading-none text-slate-800">
              {staffName}
            </span>
            <span
              className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                ROLE_COLORS[staffRole] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {ROLE_LABELS[staffRole] ?? staffRole}
            </span>
          </div>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white">
            {staffName.charAt(0)}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 sm:flex transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          登出
        </button>
      </div>
    </header>
  );
}
