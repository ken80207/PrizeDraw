"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "超級管理員",
  ADMIN: "管理員",
  SUPPORT: "客服",
  FINANCE: "財務",
  READONLY: "唯讀",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  ADMIN: "bg-indigo-100 text-indigo-700",
  SUPPORT: "bg-blue-100 text-blue-700",
  FINANCE: "bg-green-100 text-green-700",
  READONLY: "bg-slate-100 text-slate-600",
};

const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: "總覽",
  campaigns: "活動管理",
  shipping: "出貨管理",
  withdrawals: "提領審核",
  support: "客服工單",
  players: "玩家管理",
  trade: "交易監控",
  prizes: "賞品管理",
  coupons: "優惠券",
  leaderboard: "排行榜",
  payments: "金流紀錄",
  staff: "人員管理",
  audit: "稽核紀錄",
  "feature-flags": "Feature Flags",
  settings: "系統設定",
  create: "新增",
};

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [staffName, setStaffName] = useState<string>("管理員");
  const [staffRole, setStaffRole] = useState<string>("ADMIN");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStaffName(sessionStorage.getItem("adminStaffName") ?? "管理員");
      setStaffRole(sessionStorage.getItem("adminRole") ?? "ADMIN");
    }
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: BREADCRUMB_MAP[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }
    router.push("/login");
  };

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Left: hamburger + breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <nav className="flex items-center gap-1 text-sm text-slate-500 overflow-hidden">
          <span className="hidden sm:block">PrizeDraw</span>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1 min-w-0">
              <span className="text-slate-300">/</span>
              {i === breadcrumbs.length - 1 ? (
                <span className="font-medium text-slate-700 truncate">{crumb.label}</span>
              ) : (
                <a href={crumb.href} className="hover:text-slate-700 truncate">
                  {crumb.label}
                </a>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notification bell */}
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* Staff info */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-slate-700 leading-none">{staffName}</p>
            <div className="mt-0.5">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  ROLE_COLORS[staffRole] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {ROLE_LABELS[staffRole] ?? staffRole}
              </span>
            </div>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white">
            {staffName.charAt(0)}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="hidden sm:flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
